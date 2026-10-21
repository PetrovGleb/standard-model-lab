/* Generates data/endf.generated.json from the ENDF/B-VIII.0 neutron and fission-yield sublibraries kept verbatim as the NNDC zip archives in data/endf: for every target nucleus the cross sections
   of total, elastic, inelastic, (n,2n), fission, capture, (n,p) and (n,α) (actinides with their Reich–Moore resolved resonances reconstructed down to 10⁻⁵ eV, others above the resonance
   parameters), elastic mean cosine, prompt and delayed neutrons per fission with the delayed groups and spectra, the prompt fission spectrum and the independent fission-product yields. */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';
import { parseResolvedRange, reconstruct, resonanceGrid } from './resonances.js';

const dataRoot = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const NEUTRON_ARCHIVE = 'endf/ENDF-B-VIII.0_neutrons.zip';
const YIELD_ARCHIVE = 'endf/ENDF-B-VIII.0_nfy.zip';
const OUTPUT = 'endf.generated.json';
const FIELD_WIDTH = 11;
const FIELDS_PER_LINE = 6;
const MAT_START = 66;
const MF_START = 70;
const MT_START = 72;
const MT_END = 75;
const HIGHEST_ENERGY_IN_EV = 2e7;
const THINNING_TOLERANCE = 0.005;
const SIGNIFICANT_DIGITS = 6;
const SPECTRUM_QUANTILES = 64;
const SMALLEST_YIELD = 1e-6;
const DEFLATE = 8;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const END_SIGNATURE = 0x06054b50;
const ZA_PROTON_FACTOR = 1000;
const REACTIONS: Readonly<Record<number, string>> = {
  1: 'total',
  2: 'elastic',
  4: 'inelastic',
  16: 'twoNeutrons',
  18: 'fission',
  102: 'capture',
  103: 'protonEmission',
  107: 'alphaEmission',
};
const TOTAL_NU = 452;
const DELAYED_NU = 455;
const RECONSTRUCTED_PROTONS = 90;
const STRONG_ABSORBER_IN_BARNS = 1000;
const THERMAL_ENERGY_IN_EV = 0.0253;
const RECONSTRUCTED_REACTIONS = ['elastic', 'capture', 'fission'] as const;
const EVAPORATION_LAW = 5;
const TABULATED_LAW = 1;
const PROMPT_NU = 456;
const ELASTIC = 2;
const FISSION = 18;
const INDEPENDENT_YIELDS = 454;

type Table = readonly [readonly number[], readonly number[]];

interface ZipMember {
  readonly name: string;
  readonly method: number;
  readonly compressedSize: number;
  readonly offset: number;
}

function zipMembers(archive: Buffer): readonly ZipMember[] {
  let end = archive.length - 22;
  while (end > 0 && archive.readUInt32LE(end) !== END_SIGNATURE) {
    end -= 1;
  }
  const count = archive.readUInt16LE(end + 10);
  let position = archive.readUInt32LE(end + 16);
  const members: ZipMember[] = [];
  for (let index = 0; index < count; index += 1) {
    if (archive.readUInt32LE(position) !== CENTRAL_DIRECTORY_SIGNATURE) {
      throw new Error('Broken zip central directory');
    }
    const method = archive.readUInt16LE(position + 10);
    const compressedSize = archive.readUInt32LE(position + 20);
    const nameLength = archive.readUInt16LE(position + 28);
    const extraLength = archive.readUInt16LE(position + 30);
    const commentLength = archive.readUInt16LE(position + 32);
    const offset = archive.readUInt32LE(position + 42);
    const name = archive.toString('utf8', position + 46, position + 46 + nameLength);
    members.push({ name, method, compressedSize, offset });
    position += 46 + nameLength + extraLength + commentLength;
  }
  return members;
}

function memberText(archive: Buffer, member: ZipMember): string {
  const nameLength = archive.readUInt16LE(member.offset + 26);
  const extraLength = archive.readUInt16LE(member.offset + 28);
  const start = member.offset + 30 + nameLength + extraLength;
  const data = archive.subarray(start, start + member.compressedSize);
  return (member.method === DEFLATE ? inflateRawSync(data) : data).toString('latin1');
}

function endfNumber(field: string): number {
  const text = field.trim();
  if (text === '') {
    return 0;
  }
  if (/[eE]/.test(text)) {
    return Number(text);
  }
  const match = /^([+-]?[\d.]+)([+-])(\d+)$/.exec(text);
  return match === null
    ? Number(text)
    : Number(`${match[1] ?? ''}e${match[2] ?? ''}${match[3] ?? ''}`);
}

function fields(line: string): number[] {
  return Array.from({ length: FIELDS_PER_LINE }, (unused, index) =>
    endfNumber(line.slice(index * FIELD_WIDTH, (index + 1) * FIELD_WIDTH)),
  );
}

function sections(text: string): Map<string, string[]> {
  const result = new Map<string, string[]>();
  text.split(/\r?\n/).forEach((line) => {
    if (line.length < MT_END) {
      return;
    }
    const fileNumber = Number(line.slice(MF_START, MT_START));
    const reactionNumber = Number(line.slice(MT_START, MT_END));
    if (fileNumber === 0 || reactionNumber === 0 || Number(line.slice(MAT_START, MF_START)) <= 0) {
      return;
    }
    const key = `${String(fileNumber)}/${String(reactionNumber)}`;
    const lines = result.get(key) ?? [];
    lines.push(line);
    result.set(key, lines);
  });
  return result;
}

class Reader {
  private position = 0;

  constructor(private readonly lines: readonly string[]) {}

  get done(): boolean {
    return this.position >= this.lines.length;
  }

  record(): number[] {
    const line = this.lines[this.position] ?? '';
    this.position += 1;
    return fields(line);
  }

  values(count: number): number[] {
    const result: number[] = [];
    while (result.length < count) {
      result.push(...this.record());
    }
    return result.slice(0, count);
  }

  tab1(): { readonly head: number[]; readonly table: Table } {
    const head = this.record();
    const regions = head[4] ?? 0;
    const points = head[5] ?? 0;
    this.values(2 * regions);
    const pairs = this.values(2 * points);
    return {
      head,
      table: [
        pairs.filter((unused, index) => index % 2 === 0),
        pairs.filter((unused, index) => index % 2 === 1),
      ],
    };
  }

  list(): { readonly head: number[]; readonly items: number[] } {
    const head = this.record();
    return { head, items: this.values(head[4] ?? 0) };
  }

  tab2(): number[] {
    const head = this.record();
    this.values(2 * (head[4] ?? 0));
    return head;
  }
}

function rounded(value: number): number {
  return Number(value.toPrecision(SIGNIFICANT_DIGITS));
}

function thinned(table: Table, lowest: number): Table {
  const [energies, values] = table;
  const kept: number[] = [];
  const points = energies
    .map((energy, index) => ({ energy, value: values[index] ?? 0 }))
    .filter((point) => point.energy >= lowest && point.energy <= HIGHEST_ENERGY_IN_EV);
  let anchor = 0;
  kept.push(0);
  for (let index = 2; index < points.length; index += 1) {
    const start = points[anchor];
    const end = points[index];
    if (start === undefined || end === undefined) {
      continue;
    }
    const exact = points.slice(anchor + 1, index).every((point) => {
      const share =
        end.energy === start.energy
          ? 0
          : (point.energy - start.energy) / (end.energy - start.energy);
      const estimate = start.value + share * (end.value - start.value);
      return (
        Math.abs(estimate - point.value) <=
        THINNING_TOLERANCE * Math.max(Math.abs(point.value), 1e-30)
      );
    });
    if (!exact) {
      anchor = index - 1;
      kept.push(anchor);
    }
  }
  if (points.length > 1) {
    kept.push(points.length - 1);
  }
  const unique = [...new Set(kept)].flatMap((index) => {
    const point = points[index];
    return point === undefined ? [] : [point];
  });
  return [
    unique.map((point) => rounded(point.energy)),
    unique.map((point) => rounded(point.value)),
  ];
}

function resonanceBoundary(lines: readonly string[] | undefined): number {
  if (lines === undefined || lines.length < 3) {
    return 0;
  }
  const [low = 0, high = 0, kind = 0] = fields(lines[2] ?? '');
  void low;
  return kind > 0 ? high : 0;
}

function firstPositiveAfterZeros(table: Table): number {
  const [energies, values] = table;
  const firstZero = values.findIndex((value) => value === 0);
  if (firstZero !== 0) {
    return 0;
  }
  const firstPositive = values.findIndex((value) => value > 0);
  return firstPositive < 0 ? 0 : (energies[firstPositive] ?? 0);
}

function interpolatedAt(table: Table, energy: number): number {
  const [energies, values] = table;
  const upper = energies.findIndex((candidate) => candidate >= energy);
  if (upper <= 0) {
    return upper === 0 ? (values[0] ?? 0) : 0;
  }
  const low = energies[upper - 1] ?? 0;
  const high = energies[upper] ?? low;
  const share = high === low ? 0 : (energy - low) / (high - low);
  return (values[upper - 1] ?? 0) + share * ((values[upper] ?? 0) - (values[upper - 1] ?? 0));
}

function withResonances(
  all: Map<string, string[]>,
  protons: number,
  raw: Map<string, Table>,
): Map<string, Table> | null {
  const lines = all.get('2/151');
  if (lines === undefined) {
    return null;
  }
  const range = parseResolvedRange(lines, fields);
  if (
    range === null ||
    (protons < RECONSTRUCTED_PROTONS &&
      (reconstruct(range, [THERMAL_ENERGY_IN_EV]).capture[0] ?? 0) < STRONG_ABSORBER_IN_BARNS)
  ) {
    return null;
  }
  const grid = resonanceGrid(range);
  const resonant = reconstruct(range, grid);
  const merged = new Map(raw);
  RECONSTRUCTED_REACTIONS.forEach((name) => {
    const background = raw.get(name);
    const own = resonant[name];
    if (background === undefined && own.every((value) => value === 0)) {
      return;
    }
    const below = grid.map(
      (energy, index) =>
        (own[index] ?? 0) + (background === undefined ? 0 : interpolatedAt(background, energy)),
    );
    const [energies, values] = background ?? [[], []];
    const above = energies.flatMap((energy, index) =>
      energy >= range.highInEv ? [[energy, values[index] ?? 0] as const] : [],
    );
    merged.set(name, [
      [...grid, ...above.map(([energy]) => energy)],
      [...below, ...above.map(([, value]) => value)],
    ]);
  });
  return merged;
}

function delayedNeutrons(all: Map<string, string[]>) {
  const multiplicity = all.get(`1/${String(DELAYED_NU)}`);
  const spectra = all.get(`5/${String(DELAYED_NU)}`);
  if (multiplicity === undefined || spectra === undefined) {
    return null;
  }
  const reader = new Reader(multiplicity);
  const head = reader.record();
  if ((head[2] ?? 0) !== 0) {
    return null;
  }
  const decayConstants = reader.list().items;
  const perFission = (head[3] ?? 0) === 2 ? thinned(reader.tab1().table, 0) : null;
  if (perFission === null) {
    return null;
  }
  const spectrumReader = new Reader(spectra);
  const groupCount = spectrumReader.record()[4] ?? 0;
  const groups = [];
  for (let group = 0; group < groupCount; group += 1) {
    const probability = spectrumReader.tab1();
    const law = probability.head[3] ?? 0;
    let spectrum: Table | null = null;
    if (law === EVAPORATION_LAW) {
      const temperature = spectrumReader.tab1().table[1][0] ?? 1;
      const shape = spectrumReader.tab1().table;
      spectrum = [shape[0].map((ratio) => ratio * temperature), shape[1]];
    } else if (law === TABULATED_LAW) {
      const incident = spectrumReader.tab2();
      const entries = incident[5] ?? 0;
      for (let index = 0; index < entries; index += 1) {
        const { table } = spectrumReader.tab1();
        spectrum ??= table;
      }
    }
    if (spectrum === null) {
      return null;
    }
    groups.push({
      decayConstantPerSecond: rounded(decayConstants[group] ?? 0),
      abundance: rounded(probability.table[1][0] ?? 0),
      spectrumQuantilesInEv: quantiles(spectrum),
    });
  }
  return { perFission, groups };
}

function neutronsPerFission(lines: readonly string[] | undefined): Table | null {
  if (lines === undefined) {
    return null;
  }
  const reader = new Reader(lines);
  const head = reader.record();
  const representation = head[3] ?? 0;
  if (representation === 1) {
    const { items } = reader.list();
    const energies = [1e-5, 1e3, 1e5, 1e6, 5e6, 1e7, HIGHEST_ENERGY_IN_EV];
    return [
      energies,
      energies.map((energy) =>
        rounded(items.reduce((sum, coefficient, power) => sum + coefficient * energy ** power, 0)),
      ),
    ];
  }
  return thinned(reader.tab1().table, 0);
}

function quantiles(table: Table): number[] {
  const [energies, densities] = table;
  const cumulative = [0];
  for (let index = 1; index < energies.length; index += 1) {
    const width = (energies[index] ?? 0) - (energies[index - 1] ?? 0);
    cumulative.push(
      (cumulative[index - 1] ?? 0) +
        0.5 * width * ((densities[index] ?? 0) + (densities[index - 1] ?? 0)),
    );
  }
  const total = cumulative[cumulative.length - 1] ?? 1;
  return Array.from({ length: SPECTRUM_QUANTILES + 1 }, (unused, step) => {
    const target = (step / SPECTRUM_QUANTILES) * total;
    const upper = Math.max(
      1,
      cumulative.findIndex((value) => value >= target),
    );
    const low = cumulative[upper - 1] ?? 0;
    const high = cumulative[upper] ?? total;
    const share = high === low ? 0 : (target - low) / (high - low);
    return rounded(
      (energies[upper - 1] ?? 0) + share * ((energies[upper] ?? 0) - (energies[upper - 1] ?? 0)),
    );
  });
}

function fissionSpectrum(lines: readonly string[] | undefined) {
  if (lines === undefined) {
    return null;
  }
  const reader = new Reader(lines);
  const head = reader.record();
  const subsections = head[4] ?? 0;
  for (let subsection = 0; subsection < subsections; subsection += 1) {
    const probability = reader.tab1();
    const law = probability.head[3] ?? 0;
    if (law !== 1) {
      return null;
    }
    const incident = reader.tab2();
    const count = incident[5] ?? 0;
    const incidentEnergiesInEv: number[] = [];
    const quantilesInEv: number[][] = [];
    for (let index = 0; index < count; index += 1) {
      const { head: entry, table } = reader.tab1();
      incidentEnergiesInEv.push(rounded(entry[1] ?? 0));
      quantilesInEv.push(quantiles(table));
    }
    return { incidentEnergiesInEv, quantilesInEv };
  }
  return null;
}

function legendreMeanCosine(lines: readonly string[] | undefined): Table | null {
  if (lines === undefined) {
    return null;
  }
  const reader = new Reader(lines);
  const head = reader.record();
  const representation = head[3] ?? 0;
  reader.record();
  if (representation !== 1 && representation !== 3) {
    return null;
  }
  const incident = reader.tab2();
  const count = incident[5] ?? 0;
  const energies: number[] = [];
  const cosines: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const { head: entry, items } = reader.list();
    energies.push(entry[1] ?? 0);
    cosines.push(items[0] ?? 0);
  }
  return thinned([energies, cosines], 0);
}

function nuclideEntry(text: string) {
  const all = sections(text);
  const header = fields(all.get('1/451')?.[0] ?? '');
  const identity = Math.round(header[0] ?? 0);
  const ratio = header[1] ?? 0;
  const isomer = fields(all.get('1/451')?.[1] ?? '')[3] ?? 0;
  if (identity < ZA_PROTON_FACTOR || isomer !== 0) {
    return null;
  }
  const raw = new Map<string, Table>();
  Object.entries(REACTIONS).forEach(([reactionNumber, name]) => {
    const lines = all.get(`3/${reactionNumber}`);
    if (lines !== undefined) {
      const reader = new Reader(lines);
      reader.record();
      raw.set(name, reader.tab1().table);
    }
  });
  const total = raw.get('total');
  const resonant = withResonances(all, Math.floor(identity / ZA_PROTON_FACTOR), raw);
  const boundary =
    resonant === null
      ? Math.max(
          resonanceBoundary(all.get('2/151')),
          total === undefined ? 0 : firstPositiveAfterZeros(total),
        )
      : 0;
  const crossSections = Object.fromEntries(
    [...(resonant ?? raw).entries()].map(([name, table]) => [
      name,
      thinned(
        table,
        resonant !== null && name === 'total' ? resonanceBoundary(all.get('2/151')) : boundary,
      ),
    ]),
  );
  const delayed = raw.get('fission') === undefined ? null : delayedNeutrons(all);
  const prompt = neutronsPerFission(
    all.get(`1/${String(PROMPT_NU)}`) ?? all.get(`1/${String(TOTAL_NU)}`),
  );
  const spectrum = fissionSpectrum(all.get(`5/${String(FISSION)}`));
  const cosine = legendreMeanCosine(all.get(`4/${String(ELASTIC)}`));
  return {
    key: String(identity),
    entry: {
      protons: Math.floor(identity / ZA_PROTON_FACTOR),
      massNumber: identity % ZA_PROTON_FACTOR,
      atomicWeightRatio: rounded(ratio),
      resonanceBoundaryInEv: rounded(boundary),
      crossSectionsInBarns: crossSections,
      ...(cosine === null ? {} : { elasticMeanCosine: cosine }),
      ...(prompt === null || raw.get('fission') === undefined ? {} : { promptNeutrons: prompt }),
      ...(spectrum === null || raw.get('fission') === undefined
        ? {}
        : { fissionSpectrum: spectrum }),
      ...(delayed === null ? {} : { delayedNeutrons: delayed }),
    },
  };
}

function yieldEntry(text: string) {
  const all = sections(text);
  const lines = all.get(`8/${String(INDEPENDENT_YIELDS)}`);
  if (lines === undefined) {
    return null;
  }
  const reader = new Reader(lines);
  const head = reader.record();
  const identity = Math.round(head[0] ?? 0);
  const energies = head[2] ?? 0;
  const incidentEnergiesInEv: number[] = [];
  const fragments: number[][][] = [];
  for (let index = 0; index < energies; index += 1) {
    const { head: entry, items } = reader.list();
    incidentEnergiesInEv.push(rounded(entry[0] ?? 0));
    const merged = new Map<number, number>();
    for (let position = 0; position + 3 < items.length + 1; position += 4) {
      const fragment = Math.round(items[position] ?? 0);
      merged.set(fragment, (merged.get(fragment) ?? 0) + (items[position + 2] ?? 0));
    }
    fragments.push(
      [...merged.entries()]
        .filter(([, value]) => value >= SMALLEST_YIELD)
        .map(([fragment, value]) => [
          Math.floor(fragment / ZA_PROTON_FACTOR),
          fragment % ZA_PROTON_FACTOR,
          rounded(value),
        ]),
    );
  }
  return { key: String(identity), entry: { incidentEnergiesInEv, fragments } };
}

const neutronArchive = readFileSync(join(dataRoot, NEUTRON_ARCHIVE));
const nuclides: Record<string, unknown> = {};
zipMembers(neutronArchive)
  .filter((member) => member.name.endsWith('.endf'))
  .forEach((member) => {
    const parsed = nuclideEntry(memberText(neutronArchive, member));
    if (parsed !== null) {
      nuclides[parsed.key] = parsed.entry;
    }
  });
const yieldArchive = readFileSync(join(dataRoot, YIELD_ARCHIVE));
const fissionYields: Record<string, unknown> = {};
zipMembers(yieldArchive)
  .filter((member) => member.name.endsWith('.endf'))
  .forEach((member) => {
    const parsed = yieldEntry(memberText(yieldArchive, member));
    if (parsed !== null) {
      fissionYields[parsed.key] = parsed.entry;
    }
  });
writeFileSync(
  join(dataRoot, OUTPUT),
  `${JSON.stringify({
    source:
      'ENDF/B-VIII.0 (D. A. Brown et al., Nucl. Data Sheets 148, 1 (2018)), neutron and neutron fission yield sublibraries from the NNDC archives in data/endf, parsed by libs/constants/scripts/generate-endf.ts: MF3 cross sections in barns above the resolved-resonance boundary, with the MF2 Reich–Moore resolved resonances of the actinides (Z ≥ 90) reconstructed down to 1e-5 eV and added to the MF3 background, MF4 Legendre mean cosine of elastic scattering in the centre of mass, MF1 prompt neutrons per fission, MF1/MF5 MT455 delayed neutrons per fission with the decay constants, abundances and spectra (64 quantiles) of their precursor groups, MF5 tabulated prompt fission spectra as 64 quantiles, MF8 independent fission-product yields per incident energy; energies in eV, thinned to 0.5% under linear interpolation up to 20 MeV',
    nuclides,
    fissionYields,
  })}\n`,
);
console.log(
  `wrote ${String(Object.keys(nuclides).length)} nuclides and ${String(Object.keys(fissionYields).length)} yield sets`,
);
