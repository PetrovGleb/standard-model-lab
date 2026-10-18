/* Generates data/reaclib.generated.json from the JINA REACLIB library file: every rate set is grouped into a reaction by chapter, reactants, products and evaluation label, nuclides are
   mapped onto NUBASE2020 names and reactions with a nuclide outside NUBASE or an isomer are dropped, so the engine gets a compact table it can hold in memory. */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dataRoot = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const LIBRARY_FILE = 'reaclib/reaclib_default2_20250330';
const NAME_FIELD_START = 5;
const NAME_FIELD_WIDTH = 5;
const NAMES_PER_LINE = 6;
const LABEL_START = 43;
const LABEL_END = 49;
const Q_START = 52;
const Q_END = 64;
const COEFFICIENT_WIDTH = 13;
const COEFFICIENTS_ON_FIRST_LINE = 4;
const COEFFICIENTS_ON_SECOND_LINE = 3;
const LINES_PER_SET = 4;
const REACTANT_COUNT_BY_CHAPTER: Readonly<Record<number, number>> = {
  1: 1,
  2: 1,
  3: 1,
  4: 2,
  5: 2,
  6: 2,
  7: 2,
  8: 3,
  9: 3,
  10: 4,
  11: 1,
};
const PRODUCT_COUNT_BY_CHAPTER: Readonly<Record<number, number>> = {
  1: 1,
  2: 2,
  3: 3,
  4: 1,
  5: 2,
  6: 3,
  7: 4,
  8: 1,
  9: 2,
  10: 2,
  11: 4,
};
const LIGHT_NAMES: Readonly<Record<string, readonly [number, number]>> = {
  n: [0, 1],
  p: [1, 1],
  d: [1, 2],
  t: [1, 3],
};

interface NuclideRecord {
  readonly protons: number;
  readonly massNumber: number;
  readonly symbol: string;
}

interface MatterData {
  readonly nuclides: readonly NuclideRecord[];
}

const matter = JSON.parse(
  readFileSync(join(dataRoot, 'matter.generated.json'), 'utf8'),
) as MatterData;
const protonsBySymbol = new Map(
  matter.nuclides.map((nuclide) => [nuclide.symbol.toLowerCase(), nuclide.protons]),
);
const known = new Set(
  matter.nuclides.map((nuclide) => `${String(nuclide.protons)}:${String(nuclide.massNumber)}`),
);

function nuclideKey(name: string): string | null {
  const light = LIGHT_NAMES[name];
  if (light !== undefined) {
    return `${String(light[0])}:${String(light[1])}`;
  }
  const match = /^([a-z]{1,2})(\d{1,3})$/.exec(name);
  if (match === null) {
    return null;
  }
  const protons = protonsBySymbol.get(match[1] ?? '');
  if (protons === undefined) {
    return null;
  }
  const key = `${String(protons)}:${match[2] ?? ''}`;
  return known.has(key) ? key : null;
}

const lines = readFileSync(join(dataRoot, LIBRARY_FILE), 'utf8').split('\n');
const nuclides: string[] = [];
const nuclideIndex = new Map<string, number>();
const indexOf = (key: string): number => {
  const existing = nuclideIndex.get(key);
  if (existing !== undefined) {
    return existing;
  }
  nuclides.push(key);
  nuclideIndex.set(key, nuclides.length - 1);
  return nuclides.length - 1;
};

interface Reaction {
  chapter: number;
  reactants: number[];
  products: number[];
  label: string;
  weak: 0 | 1 | 2;
  reverse: 0 | 1;
  qInMev: number;
  sets: number[][];
}

const reactions = new Map<string, Reaction>();
let dropped = 0;
let total = 0;
for (let line = 0; line + LINES_PER_SET - 1 < lines.length;) {
  const chapterText = (lines[line] ?? '').trim();
  if (chapterText === '') {
    line += 1;
    continue;
  }
  total += 1;
  const chapter = Number(chapterText);
  const head = lines[line + 1] ?? '';
  const names = Array.from({ length: NAMES_PER_LINE }, (ignored, position) =>
    head
      .slice(
        NAME_FIELD_START + NAME_FIELD_WIDTH * position,
        NAME_FIELD_START + NAME_FIELD_WIDTH * (position + 1),
      )
      .trim(),
  ).filter((name) => name !== '');
  const labelProperties = head.slice(LABEL_START, LABEL_END);
  const qInMev = Number(head.slice(Q_START, Q_END));
  const first = lines[line + 2] ?? '';
  const second = lines[line + 3] ?? '';
  const coefficients = [
    ...Array.from({ length: COEFFICIENTS_ON_FIRST_LINE }, (ignored, position) =>
      Number(first.slice(COEFFICIENT_WIDTH * position, COEFFICIENT_WIDTH * (position + 1))),
    ),
    ...Array.from({ length: COEFFICIENTS_ON_SECOND_LINE }, (ignored, position) =>
      Number(second.slice(COEFFICIENT_WIDTH * position, COEFFICIENT_WIDTH * (position + 1))),
    ),
  ];
  line += LINES_PER_SET;
  const reactantCount = REACTANT_COUNT_BY_CHAPTER[chapter];
  const productCount = PRODUCT_COUNT_BY_CHAPTER[chapter];
  const keys = names.map(nuclideKey);
  if (
    reactantCount === undefined ||
    productCount === undefined ||
    names.length !== reactantCount + productCount ||
    keys.some((key) => key === null) ||
    coefficients.some((value) => !Number.isFinite(value))
  ) {
    dropped += 1;
    continue;
  }
  const indices = keys.map((key) => indexOf(key ?? ''));
  const reactants = indices.slice(0, reactantCount);
  const products = indices.slice(reactantCount);
  const label = labelProperties.slice(0, 4).trim();
  const flag = labelProperties.charAt(4);
  const weak: 0 | 1 | 2 = flag === 'w' ? (label.includes('ec') ? 2 : 1) : 0;
  const reverse: 0 | 1 = labelProperties.charAt(5) === 'v' ? 1 : 0;
  const reactionKey = [chapter, reactants.join(','), products.join(','), label].join('|');
  const existing = reactions.get(reactionKey);
  if (existing === undefined) {
    reactions.set(reactionKey, {
      chapter,
      reactants,
      products,
      label,
      weak,
      reverse,
      qInMev,
      sets: [coefficients],
    });
  } else {
    existing.sets.push(coefficients);
  }
}

const output = {
  source:
    'JINA REACLIB (Cyburt et al. 2010, ApJS 189, 240), snapshot reaclib_default2_20250330 as distributed in the pynucastro 3.1.0 package; rate = sum over sets of exp(a0 + a1/T9 + a2/T9^(1/3) + a3 T9^(1/3) + a4 T9 + a5 T9^(5/3) + a6 ln T9), two-body rates in cm^3 mol^-1 s^-1, three-body in cm^6 mol^-2 s^-1, decays in s^-1, fits valid for 0.01 <= T9 <= 10; nuclides as protons:massNumber, only ground states present in NUBASE2020',
  temperatureValidityInGigakelvin: [0.01, 10],
  nuclides,
  reactions: [...reactions.values()].map((reaction) => [
    reaction.chapter,
    reaction.reactants,
    reaction.products,
    reaction.label,
    reaction.weak,
    reaction.reverse,
    reaction.qInMev,
    reaction.sets,
  ]),
};
writeFileSync(join(dataRoot, 'reaclib.generated.json'), `${JSON.stringify(output)}\n`);
console.log(
  `sets ${String(total)}, dropped ${String(dropped)}, reactions ${String(reactions.size)}, nuclides ${String(nuclides.length)}`,
);
