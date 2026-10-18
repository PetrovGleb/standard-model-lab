/* Isospin bookkeeping for the catalog: Clebsch–Gordan coefficients from the Racah formula and the charge split of a two-body mode between isospin multiplets, such as Δ → Nπ or K* → Kπ. */
import type { DecayChannel, DecayProduct } from '@standard-model/contracts';
import { PDG_2026 } from '../pdg.js';

const HALF_UNITS = 2;
const EQUAL_TOLERANCE = 1e-9;

interface MultipletMember {
  readonly names: readonly string[];
  readonly isospinThirdComponent: number;
}

interface Multiplet {
  readonly isospin: number;
  readonly members: readonly MultipletMember[];
}

export interface IsospinMode {
  readonly isospinFamilies: readonly string[];
  readonly value: number;
  readonly uncertainty: number | null;
  readonly mode: string;
}

const MULTIPLETS = PDG_2026.isospinMultiplets as Readonly<Record<string, Multiplet>>;

function factorial(value: number): number {
  let product = 1;
  for (let factor = 2; factor <= value; factor += 1) {
    product *= factor;
  }
  return product;
}

function isInteger(value: number): boolean {
  return Math.abs(value - Math.round(value)) < EQUAL_TOLERANCE;
}

export function clebschGordan(
  firstSpin: number,
  firstProjection: number,
  secondSpin: number,
  secondProjection: number,
  totalSpin: number,
  totalProjection: number,
): number {
  if (
    Math.abs(firstProjection + secondProjection - totalProjection) > EQUAL_TOLERANCE ||
    totalSpin < Math.abs(firstSpin - secondSpin) - EQUAL_TOLERANCE ||
    totalSpin > firstSpin + secondSpin + EQUAL_TOLERANCE ||
    Math.abs(firstProjection) > firstSpin + EQUAL_TOLERANCE ||
    Math.abs(secondProjection) > secondSpin + EQUAL_TOLERANCE ||
    Math.abs(totalProjection) > totalSpin + EQUAL_TOLERANCE ||
    !isInteger(HALF_UNITS * (firstSpin + secondSpin + totalSpin)) ||
    !isInteger(firstSpin + secondSpin + totalSpin)
  ) {
    return 0;
  }
  const whole = (value: number): number => Math.round(value);
  const prefactor = Math.sqrt(
    ((2 * totalSpin + 1) *
      factorial(whole(totalSpin + firstSpin - secondSpin)) *
      factorial(whole(totalSpin - firstSpin + secondSpin)) *
      factorial(whole(firstSpin + secondSpin - totalSpin))) /
      factorial(whole(firstSpin + secondSpin + totalSpin + 1)),
  );
  const projections = Math.sqrt(
    factorial(whole(totalSpin + totalProjection)) *
      factorial(whole(totalSpin - totalProjection)) *
      factorial(whole(firstSpin - firstProjection)) *
      factorial(whole(firstSpin + firstProjection)) *
      factorial(whole(secondSpin - secondProjection)) *
      factorial(whole(secondSpin + secondProjection)),
  );
  let sum = 0;
  for (let step = 0; step <= whole(firstSpin + secondSpin + totalSpin); step += 1) {
    const terms = [
      step,
      whole(firstSpin + secondSpin - totalSpin) - step,
      whole(firstSpin - firstProjection) - step,
      whole(secondSpin + secondProjection) - step,
      whole(totalSpin - secondSpin + firstProjection) + step,
      whole(totalSpin - firstSpin - secondProjection) + step,
    ];
    if (terms.every((term) => term >= 0)) {
      sum +=
        (step % 2 === 0 ? 1 : -1) / terms.reduce((product, term) => product * factorial(term), 1);
    }
  }
  return prefactor * projections * sum;
}

export function isospinChannels(
  parentName: string,
  parentIsospin: number,
  parentThirdComponent: number,
  mode: IsospinMode,
): readonly DecayChannel[] {
  const [firstFamily, secondFamily] = mode.isospinFamilies.map((family) => {
    const multiplet = MULTIPLETS[family];
    if (multiplet === undefined) {
      throw new Error(`Unknown isospin multiplet ${family}`);
    }
    return multiplet;
  });
  if (firstFamily === undefined || secondFamily === undefined) {
    throw new Error(`${parentName}: an isospin mode needs two multiplets`);
  }
  return firstFamily.members.flatMap((first) =>
    secondFamily.members.flatMap((second) => {
      const amplitude = clebschGordan(
        firstFamily.isospin,
        first.isospinThirdComponent,
        secondFamily.isospin,
        second.isospinThirdComponent,
        parentIsospin,
        parentThirdComponent,
      );
      const share = amplitude * amplitude;
      if (share < EQUAL_TOLERANCE) {
        return [];
      }
      const splits = first.names.length * second.names.length;
      return first.names.flatMap((firstName) =>
        second.names.map((secondName) => ({
          products: [firstName, secondName] as readonly DecayProduct[],
          branchingFraction: {
            value: (mode.value * share) / splits,
            uncertainty: mode.uncertainty === null ? null : (mode.uncertainty * share) / splits,
            exact: false,
            unit: '',
            source: 'derived' as const,
            sourceName: `${parentName} → ${mode.mode} isospin share`,
          },
        })),
      );
    }),
  );
}
