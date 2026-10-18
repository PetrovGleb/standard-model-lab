/* Typed access to data/reaclib.generated.json: JINA REACLIB thermonuclear reaction rates grouped by reaction, nuclides turned into catalog names, with the validity window of the fits. */
import type { ParticleName } from '@standard-model/contracts';
import reaclibJson from '../data/reaclib.generated.json' with { type: 'json' };
import { nucleusName } from './particles/matter.js';

export type ReaclibWeakKind = 'none' | 'beta' | 'electronCapture';

export interface ReaclibReaction {
  readonly chapter: number;
  readonly reactants: readonly ParticleName[];
  readonly products: readonly ParticleName[];
  readonly label: string;
  readonly weak: ReaclibWeakKind;
  readonly reverse: boolean;
  readonly qInMev: number;
  readonly sets: readonly (readonly number[])[];
}

type ReactionRow = readonly [
  number,
  readonly number[],
  readonly number[],
  string,
  number,
  number,
  number,
  readonly (readonly number[])[],
];

interface ReaclibFile {
  readonly source: string;
  readonly temperatureValidityInGigakelvin: readonly [number, number];
  readonly nuclides: readonly string[];
  readonly reactions: readonly ReactionRow[];
}

const WEAK_KINDS: readonly ReaclibWeakKind[] = ['none', 'beta', 'electronCapture'];
const file = reaclibJson as unknown as ReaclibFile;

export const REACLIB_SOURCE = file.source;
export const REACLIB_TEMPERATURE_VALIDITY_IN_GIGAKELVIN = file.temperatureValidityInGigakelvin;

function nameOf(key: string): ParticleName {
  const [protons = 0, massNumber = 0] = key.split(':').map(Number);
  return nucleusName(protons, massNumber);
}

let decoded: readonly ReaclibReaction[] | null = null;

export function reaclibReactions(): readonly ReaclibReaction[] {
  if (decoded === null) {
    const names = file.nuclides.map(nameOf);
    decoded = file.reactions.map(
      ([chapter, reactants, products, label, weak, reverse, qInMev, sets]) => ({
        chapter,
        reactants: reactants.map((index) => names[index] ?? 'neutron'),
        products: products.map((index) => names[index] ?? 'neutron'),
        label,
        weak: WEAK_KINDS[weak] ?? 'none',
        reverse: reverse === 1,
        qInMev,
        sets,
      }),
    );
  }
  return decoded;
}
