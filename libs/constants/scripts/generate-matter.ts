/* Generates data/matter.generated.json from verbatim sources: NUBASE2020 and AME2020 nuclides, NIST ASD ionization energies and isotopic compositions, Verner 1996 photoionization fits, UFF atom types (RDKit) and OpenStax bond energies. Run with pnpm generate:matter. */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dataRoot = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const read = (path: string): string => readFileSync(join(dataRoot, path), 'utf8');

const SECONDS_PER_UNIT: Readonly<Record<string, number>> = {
  ys: 1e-24,
  zs: 1e-21,
  as: 1e-18,
  fs: 1e-15,
  ps: 1e-12,
  ns: 1e-9,
  us: 1e-6,
  ms: 1e-3,
  s: 1,
  m: 60,
  h: 3600,
  d: 86_400,
  y: 31_556_926,
  ky: 31_556_926e3,
  My: 31_556_926e6,
  Gy: 31_556_926e9,
  Ty: 31_556_926e12,
  Py: 31_556_926e15,
  Ey: 31_556_926e18,
  Zy: 31_556_926e21,
  Yy: 31_556_926e24,
};

const field = (line: string, first: number, last: number): string =>
  line.slice(first - 1, last).trim();
const numeric = (text: string): number | null => {
  const cleaned = text.replace(/[#~<>]/g, '').trim();
  return cleaned === '' || Number.isNaN(Number(cleaned)) ? null : Number(cleaned);
};

interface DecayMode {
  readonly mode: string;
  readonly percent: number | null;
}

function decayModes(text: string): { modes: DecayMode[]; abundancePercent: number | null } {
  let abundancePercent: number | null = null;
  const modes: DecayMode[] = [];
  text
    .split(';')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '')
    .forEach((entry) => {
      const match =
        /^([0-9]*[A-Za-z][A-Za-z0-9+-]*?)\s*(\?)?\s*(?:[=~<>]+\s*([0-9.]+))?(?:\s.*)?$/.exec(entry);
      if (match === null) {
        return;
      }
      const [, mode = '', unknown, value] = match;
      const percent = unknown === '?' || value === undefined ? null : Number(value);
      if (mode === 'IS') {
        abundancePercent = percent;
        return;
      }
      modes.push({ mode, percent });
    });
  return { modes, abundancePercent };
}

const ameMassExcess = new Map<string, { value: number; uncertainty: number; estimated: boolean }>();
read('ame2020/mass_1.mas20.txt')
  .split('\n')
  .slice(36)
  .forEach((line) => {
    const protons = Number(field(line, 10, 14));
    const massNumber = Number(field(line, 15, 19));
    const raw = field(line, 29, 42);
    const value = numeric(raw);
    if (Number.isNaN(protons) || Number.isNaN(massNumber) || value === null) {
      return;
    }
    ameMassExcess.set(`${String(protons)}:${String(massNumber)}`, {
      value,
      uncertainty: numeric(field(line, 43, 54)) ?? 0,
      estimated: raw.includes('#'),
    });
  });

const nuclides = read('nubase2020/nubase_4.mas20.txt')
  .split('\n')
  .filter((line) => !line.startsWith('#') && line.length > 20 && line.charAt(7) === '0')
  .map((line) => {
    const massNumber = Number(field(line, 1, 3));
    const protons = Number(field(line, 5, 7));
    const symbol = field(line, 12, 16).replace(/^\d+/, '');
    const halfLifeText = field(line, 70, 78);
    const unit = field(line, 79, 80);
    const stable = halfLifeText === 'stbl';
    const halfLife = numeric(halfLifeText);
    const seconds = SECONDS_PER_UNIT[unit];
    const ame = ameMassExcess.get(`${String(protons)}:${String(massNumber)}`);
    const nubaseExcess = field(line, 19, 31);
    const { modes, abundancePercent } = decayModes(line.slice(119));
    const spinParity = field(line, 89, 102).replace(/[*#]/g, '').replace(/T=.*$/, '').trim();
    return {
      protons,
      massNumber,
      symbol,
      massExcessInKev: ame?.value ?? numeric(nubaseExcess) ?? 0,
      massExcessUncertaintyInKev: ame?.uncertainty ?? numeric(field(line, 32, 42)) ?? 0,
      fromSystematics: ame?.estimated ?? nubaseExcess.includes('#'),
      halfLifeInSeconds:
        stable || halfLife === null || seconds === undefined ? null : halfLife * seconds,
      stable,
      halfLifeText: stable ? 'stable' : `${halfLifeText} ${unit}`.trim(),
      spinParity: spinParity === '' ? null : spinParity,
      decayModes: modes,
      abundancePercent,
    };
  })
  .filter((nuclide) => nuclide.protons > 0 || nuclide.massNumber === 1);

const unquote = (cell: string): string => cell.replace(/^="?|"$/g, '').replace(/^"|"$/g, '');
const ionizationRows = read('nist-asd/ionization-energies.csv')
  .split('\n')
  .slice(1)
  .filter((line) => line.trim() !== '')
  .map((line) => (line.match(/"=""[^"]*"""/g) ?? []).map((cell) => cell.slice(4, -3).trim()))
  .filter((row) => (row[0] ?? '') !== '' && Number.isInteger(Number(row[0])));

const compositions = read('nist-asd/isotopic-compositions.txt')
  .split(/\n\s*\n/)
  .map((block) =>
    Object.fromEntries(
      block
        .split('\n')
        .map((line) => line.split(' = '))
        .filter((parts) => parts.length === 2)
        .map(([key = '', value = '']) => [key.trim(), value.trim()]),
    ),
  )
  .filter((record) => record['Atomic Number'] !== undefined);

const uncertain = (text: string): number | null => {
  const range = /^\[([0-9.]+),([0-9.]+)\]$/.exec(text);
  if (range !== null) {
    return (Number(range[1]) + Number(range[2])) / 2;
  }
  return numeric(text.replace(/\(.*\)/, '').replace(/[[\]]/g, ''));
};

const elementNumbers = [...new Set(ionizationRows.map((row) => Number(row[0])))].sort(
  (first, second) => first - second,
);
const elements = elementNumbers.map((protons) => {
  const rows = ionizationRows.filter((row) => Number(row[0]) === protons);
  const isotopes = compositions.filter((record) => Number(record['Atomic Number']) === protons);
  const weightText = isotopes[0]?.['Standard Atomic Weight'] ?? '';
  return {
    protons,
    symbol: unquote(rows[0]?.[1] ?? '').split(' ')[0] ?? '',
    name: rows[0]?.[3] ?? '',
    standardAtomicWeight: uncertain(weightText),
    isotopes: isotopes
      .map((record) => ({
        massNumber: Number(record['Mass Number']),
        abundance: uncertain(record['Isotopic Composition'] ?? ''),
      }))
      .filter((isotope) => isotope.abundance !== null && isotope.abundance > 0),
    stages: rows.map((row) => ({
      charge: Number((row[2] ?? '0').replace('+', '')),
      groundShells: row[5] ?? '',
      groundLevel: row[6] ?? '',
      ionizationEnergyInEv: numeric((row[9] ?? '').replace(/[()[\]]/g, '')),
      ionizationEnergyMethod:
        row[8] === '(' ? 'theory' : row[8] === '[' ? 'extrapolated' : 'measured',
    })),
  };
});

const fortran = read('verner1996/phfit2.f')
  .split('\n')
  .reduce<string[]>((statements, line) => {
    if (/^ {5}\S/.test(line) && statements.length > 0) {
      statements[statements.length - 1] += line.slice(6);
    } else {
      statements.push(line);
    }
    return statements;
  }, []);
const dataValues = (statement: string): number[] =>
  (statement.split('/')[1] ?? '').split(',').map((value) => Number(value.trim()));
const integerArray = (name: string): number[] => {
  const statement = fortran.find((line) => line.includes(`DATA (${name}(I),`));
  if (statement === undefined) {
    throw new Error(`No DATA for ${name}`);
  }
  return dataValues(statement);
};
const innerShellFits: Record<string, number[]> = {};
const outerShellFits: Record<string, number[]> = {};
fortran.forEach((statement) => {
  const first = /DATA \(PH1\(I,\s*(\d+),\s*(\d+),\s*(\d+)\)/.exec(statement);
  if (first !== null) {
    innerShellFits[`${first[1] ?? ''}:${first[2] ?? ''}:${first[3] ?? ''}`] = dataValues(statement);
  }
  const second = /DATA \(PH2\(I,\s*(\d+),\s*(\d+)\)/.exec(statement);
  if (second !== null) {
    outerShellFits[`${second[1] ?? ''}:${second[2] ?? ''}`] = dataValues(statement);
  }
});

const collisionalIonization = Object.fromEntries(
  [
    ...read('voronov1997/cfit.f').matchAll(/DATA\(CF\(I,\s*(\d+),\s*(\d+)\),I=1,5\)\/([^/]+)\//g),
  ].map((match) => {
    const [threshold, squareRoot, amplitude, offset, exponent] = (match[3] ?? '')
      .split(',')
      .map((value) => Number(value.trim()));
    return [
      `${match[1] ?? ''}:${match[2] ?? ''}`,
      {
        thresholdInEv: threshold,
        squareRootCoefficient: squareRoot,
        amplitudeInCubicCentimetersPerSecond: amplitude,
        denominatorOffset: offset,
        exponent,
      },
    ];
  }),
);

const uffSource = read('uff/Params.cpp');
const uffBlock = uffSource.slice(uffSource.indexOf('defaultParamData ='));
const uffRows = [...uffBlock.matchAll(/"([^"]*)"/g)]
  .map((match) => match[1] ?? '')
  .join('')
  .split('\\n')
  .filter((row) => row.trim() !== '' && !row.startsWith('#'))
  .map((row) => row.split('\t'));
const uffAtomTypes = uffRows.map(([atomType = '', ...values]) => {
  const [
    bondRadius,
    bondAngle,
    nonbondDistance,
    nonbondEnergy,
    nonbondScale,
    effectiveCharge,
    torsionSp3,
    torsionSp2,
    electronegativity,
    hardness,
    radius,
  ] = values.map(Number);
  return {
    atomType,
    bondRadiusInAngstrom: bondRadius,
    bondAngleInDegrees: bondAngle,
    nonbondDistanceInAngstrom: nonbondDistance,
    nonbondEnergyInKcalPerMole: nonbondEnergy,
    nonbondScale,
    effectiveCharge,
    torsionBarrierSp3InKcalPerMole: torsionSp3,
    torsionBarrierSp2InKcalPerMole: torsionSp2,
    electronegativity,
    hardness,
    radiusInAngstrom: radius,
  };
});

const bondPage = read('bond-energies/openstax-chemistry-2e-7-5.html');
const tables = bondPage.match(/<table[\s\S]*?<\/table>/g) ?? [];
const cellText = (cell: string): string =>
  cell
    .replace(/<annotation[\s\S]*?<\/annotation>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z]+;/g, '')
    .trim();
const rowsOf = (table: string): string[][] =>
  (table.match(/<tr[\s\S]*?<\/tr>/g) ?? []).map((row) =>
    (row.match(/<t[dh][\s\S]*?<\/t[dh]>/g) ?? []).map(cellText),
  );
const BOND_ORDERS: Readonly<Record<string, number>> = { '–': 1, '=': 2, '≡': 3 };
const parseBond = (text: string) => {
  const half =
    text.length % 2 === 0 && text.slice(0, text.length / 2) === text.slice(text.length / 2)
      ? text.slice(0, text.length / 2)
      : text;
  const match = /^([A-Z][a-z]?)([–=≡])([A-Z][a-z]?)$/.exec(half);
  return match === null
    ? null
    : { first: match[1] ?? '', second: match[3] ?? '', order: BOND_ORDERS[match[2] ?? ''] ?? 0 };
};
const bonds = new Map<
  string,
  {
    first: string;
    second: string;
    order: number;
    energyInKjPerMole: number;
    lengthInAngstrom: number | null;
  }
>();
rowsOf(tables[0] ?? '').forEach((row) => {
  for (let column = 0; column + 1 < row.length; column += 2) {
    const bond = parseBond(row[column] ?? '');
    const energy = Number(row[column + 1]);
    if (bond !== null && !Number.isNaN(energy)) {
      bonds.set(`${bond.first}${String(bond.order)}${bond.second}`, {
        ...bond,
        energyInKjPerMole: energy,
        lengthInAngstrom: null,
      });
    }
  }
});
rowsOf(tables[1] ?? '').forEach(([name = '', length = '', energy = '']) => {
  const bond = parseBond(name);
  if (bond !== null && !Number.isNaN(Number(energy))) {
    bonds.set(`${bond.first}${String(bond.order)}${bond.second}`, {
      ...bond,
      energyInKjPerMole: Number(energy),
      lengthInAngstrom: Number(length),
    });
  }
});

const ROMAN_STAGES: Readonly<Record<string, number>> = { I: 0, II: 1, III: 2 };
const csvCells = (line: string): string[] =>
  line.split(',').map((cell) =>
    cell
      .replace(/^"="+|"+$/g, '')
      .replace(/^"/, '')
      .trim(),
  );
const linesDirectory = join(dataRoot, 'nist-asd', 'lines');
const coolingTransitions = readdirSync(linesDirectory)
  .filter((file) => file.endsWith('.csv'))
  .map((file) => {
    const [symbol = '', stage = 'I'] = file.replace('.csv', '').split('-');
    const [header = '', ...rows] = readFileSync(join(linesDirectory, file), 'utf8')
      .split('\n')
      .filter((line) => line.trim() !== '');
    const columns = csvCells(header);
    const column = (row: readonly string[], name: string): string =>
      columns.includes(name) ? (row[columns.indexOf(name)] ?? '') : '';
    const best = rows
      .map(csvCells)
      .filter(
        (row) => Number(column(row, 'Ei(cm-1)')) === 0 && Number(column(row, 'Aki(s^-1)')) > 0,
      )
      .sort(
        (first, second) => Number(column(second, 'Aki(s^-1)')) - Number(column(first, 'Aki(s^-1)')),
      )[0];
    const element = elements.find((candidate) => candidate.symbol === symbol);
    if (best === undefined || element === undefined) {
      throw new Error(`No ground-state line in ${file}`);
    }
    const wavelength = ['ritz_wl_air(nm)', 'ritz_wl_vac(nm)', 'obs_wl_air(nm)', 'obs_wl_vac(nm)']
      .map((name) => Number.parseFloat(column(best, name)))
      .find((value) => !Number.isNaN(value));
    return {
      protons: element.protons,
      charge: ROMAN_STAGES[stage] ?? 0,
      wavelengthInNanometers: wavelength ?? 0,
      wavelengthMedium: columns.some((name) => name.includes('air')) ? 'air' : 'vacuum',
      einsteinCoefficientPerSecond: Number(column(best, 'Aki(s^-1)')),
      lowerLevel: `${column(best, 'conf_i')} ${column(best, 'term_i')}${column(best, 'J_i')}`,
      upperLevel: `${column(best, 'conf_k')} ${column(best, 'term_k')}${column(best, 'J_k')}`,
    };
  });

const output = {
  sources: {
    nuclides:
      'NUBASE2020 (Kondev et al., Chin. Phys. C45 030001) and AME2020 (Wang et al., Chin. Phys. C45 030003), IAEA AMDC',
    elements:
      'NIST Atomic Spectra Database ionization energies; NIST Atomic Weights and Isotopic Compositions',
    photoionization:
      'Verner, Ferland, Korista, Yakovlev 1996, ApJ 465, 487; Verner and Yakovlev 1995, A&AS 109, 125 (phfit2.f)',
    collisionalIonization:
      'Voronov 1997, Atomic Data and Nuclear Data Tables 65, 1 (cfit.f by D. A. Verner)',
    uff: 'Rappé et al. 1992, J. Am. Chem. Soc. 114, 10024, as tabulated in RDKit Code/ForceField/UFF/Params.cpp',
    bondEnergies: 'OpenStax Chemistry 2e, section 7.5, Tables 7.2 and 7.3',
    coolingTransitions:
      'NIST ASD lines: the strongest E1 line from the ground level of each laser-cooled species',
  },
  nuclides,
  elements,
  photoionization: {
    shellOrbitalQuantumNumbers: integerArray('L'),
    innerShellCount: integerArray('NINN'),
    totalShellCount: integerArray('NTOT'),
    innerShellFits,
    outerShellFits,
  },
  collisionalIonization,
  uffAtomTypes,
  bondEnergies: [...bonds.values()],
  coolingTransitions,
};

writeFileSync(join(dataRoot, 'matter.generated.json'), `${JSON.stringify(output)}\n`);
console.log(
  `nuclides ${String(nuclides.length)}, elements ${String(elements.length)}, photoionization fits ${String(Object.keys(innerShellFits).length)}+${String(Object.keys(outerShellFits).length)}, collisional ionization fits ${String(Object.keys(collisionalIonization).length)}, UFF types ${String(uffAtomTypes.length)}, bonds ${String(bonds.size)}`,
);
