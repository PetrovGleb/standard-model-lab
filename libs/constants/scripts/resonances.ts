/* Reconstruction of resolved resonances (ENDF-102 Appendix D) in barns: Reich–Moore (LRF=3) through the matrix K of the neutron and two fission channels per spin group (l, J), and single- or
   multi-level Breit–Wigner (LRF=1, 2) through level sums with the shift and penetrability of the neutron width; hard-sphere scattering for the J values without resonances, the wave number
   from CODATA, a grid dense across every resonance and logarithmic between them. */
import { ELECTRON_VOLT, NEUTRON_MASS, REDUCED_PLANCK_CONSTANT } from '../src/codata.generated.js';

const ENDF_LENGTH_IN_METERS = 1e-14;
const WAVE_NUMBER_PER_ROOT_EV =
  (Math.sqrt(2 * NEUTRON_MASS.value * ELECTRON_VOLT.value) / REDUCED_PLANCK_CONSTANT.value) *
  ENDF_LENGTH_IN_METERS;
const CHANNEL_RADIUS_SLOPE = 0.123;
const CHANNEL_RADIUS_OFFSET = 0.08;
const HALF = 0.5;
const LOWEST_ENERGY_IN_EV = 1e-5;
const THERMAL_ENERGY_IN_EV = 0.0253;
const BACKGROUND_POINTS_PER_DECADE = 60;
const WIDTH_OFFSETS = [-8, -4, -2, -1, -0.5, -0.25, 0, 0.25, 0.5, 1, 2, 4, 8];
const FIELDS_PER_RESONANCE = 6;

type Complex = readonly [number, number];
type FieldsOf = (line: string) => number[];

interface Resonance {
  readonly energyInEv: number;
  readonly neutronWidthInEv: number;
  readonly captureWidthInEv: number;
  readonly fissionWidthsInEv: readonly [number, number];
  readonly competitiveWidthInEv: number;
}

type Formalism = 'reichMoore' | 'breitWigner';

const FORMALISMS: Readonly<Record<number, Formalism>> = {
  1: 'breitWigner',
  2: 'breitWigner',
  3: 'reichMoore',
};

interface SpinGroup {
  readonly orbital: number;
  readonly totalSpin: number;
  readonly scatteringRadius: number;
  readonly resonances: readonly Resonance[];
}

export interface ResolvedRange {
  readonly formalism: Formalism;
  readonly lowInEv: number;
  readonly highInEv: number;
  readonly targetSpin: number;
  readonly channelRadius: number;
  readonly massRatio: number;
  readonly groups: readonly SpinGroup[];
}

export interface Reconstructed {
  readonly energiesInEv: readonly number[];
  readonly elastic: readonly number[];
  readonly capture: readonly number[];
  readonly fission: readonly number[];
}

function multiply(first: Complex, second: Complex): Complex {
  return [first[0] * second[0] - first[1] * second[1], first[0] * second[1] + first[1] * second[0]];
}

function divide(first: Complex, second: Complex): Complex {
  const norm = second[0] * second[0] + second[1] * second[1];
  return [
    (first[0] * second[0] + first[1] * second[1]) / norm,
    (first[1] * second[0] - first[0] * second[1]) / norm,
  ];
}

function subtract(first: Complex, second: Complex): Complex {
  return [first[0] - second[0], first[1] - second[1]];
}

function inverse(matrix: readonly (readonly Complex[])[]): Complex[][] {
  const size = matrix.length;
  const work = matrix.map((row, rowIndex) => [
    ...row,
    ...Array.from({ length: size }, (unused, column): Complex => [column === rowIndex ? 1 : 0, 0]),
  ]);
  for (let pivot = 0; pivot < size; pivot += 1) {
    const pivotRow = work[pivot] ?? [];
    const pivotValue = pivotRow[pivot] ?? [1, 0];
    for (let column = 0; column < 2 * size; column += 1) {
      pivotRow[column] = divide(pivotRow[column] ?? [0, 0], pivotValue);
    }
    for (let row = 0; row < size; row += 1) {
      if (row === pivot) {
        continue;
      }
      const target = work[row] ?? [];
      const factor = target[pivot] ?? [0, 0];
      for (let column = 0; column < 2 * size; column += 1) {
        target[column] = subtract(
          target[column] ?? [0, 0],
          multiply(factor, pivotRow[column] ?? [0, 0]),
        );
      }
    }
  }
  return work.map((row) => row.slice(size));
}

function penetrability(orbital: number, waveRadius: number): number {
  const square = waveRadius * waveRadius;
  if (orbital === 0) {
    return waveRadius;
  }
  if (orbital === 1) {
    return (square * waveRadius) / (1 + square);
  }
  return (square * square * waveRadius) / (9 + 3 * square + square * square);
}

function shiftFactor(orbital: number, waveRadius: number): number {
  const square = waveRadius * waveRadius;
  if (orbital === 0) {
    return 0;
  }
  if (orbital === 1) {
    return -1 / (1 + square);
  }
  return -(18 + 3 * square) / (9 + 3 * square + square * square);
}

function hardSpherePhase(orbital: number, waveRadius: number): number {
  if (orbital === 0) {
    return waveRadius;
  }
  if (orbital === 1) {
    return waveRadius - Math.atan(waveRadius);
  }
  return waveRadius - Math.atan2(3 * waveRadius, 3 - waveRadius * waveRadius);
}

function signedRoot(width: number): number {
  return Math.sign(width) * Math.sqrt(Math.abs(width));
}

function statisticalWeight(totalSpin: number, targetSpin: number): number {
  return (2 * totalSpin + 1) / (2 * (2 * targetSpin + 1));
}

function resonanceFrom(values: readonly number[], index: number, formalism: Formalism): Resonance {
  const field = (offset: number): number => values[index + offset] ?? 0;
  if (formalism === 'reichMoore') {
    return {
      energyInEv: field(0),
      neutronWidthInEv: field(2),
      captureWidthInEv: field(3),
      fissionWidthsInEv: [field(4), field(5)],
      competitiveWidthInEv: 0,
    };
  }
  return {
    energyInEv: field(0),
    neutronWidthInEv: field(3),
    captureWidthInEv: field(4),
    fissionWidthsInEv: [field(5), 0],
    competitiveWidthInEv: Math.max(field(2) - field(3) - field(4) - field(5), 0),
  };
}

export function parseResolvedRange(
  lines: readonly string[],
  fieldsOf: FieldsOf,
): ResolvedRange | null {
  let position = 0;
  const next = (): number[] => fieldsOf(lines[(position += 1) - 1] ?? '');
  const head = next();
  const massRatio = head[1] ?? 0;
  next();
  const [low = 0, high = 0, kind = 0, formalism = 0, energyDependentRadius = 0, radiusFlag = 0] =
    next();
  const named = FORMALISMS[formalism];
  if (kind !== 1 || named === undefined || energyDependentRadius !== 0) {
    return null;
  }
  const [targetSpin = 0, radius = 0, , , orbitals = 0] = next();
  const groups: SpinGroup[] = [];
  for (let orbitalIndex = 0; orbitalIndex < orbitals; orbitalIndex += 1) {
    const listHead = next();
    const orbitalRadius = listHead[1] ?? 0;
    const orbital = listHead[2] ?? 0;
    const count = listHead[4] ?? 0;
    const values: number[] = [];
    while (values.length < count) {
      values.push(...next());
    }
    const byGroup = new Map<number, Resonance[]>();
    for (let index = 0; index + FIELDS_PER_RESONANCE <= count; index += FIELDS_PER_RESONANCE) {
      const totalSpin = Math.abs(values[index + 1] ?? 0);
      const resonances = byGroup.get(totalSpin) ?? [];
      resonances.push(resonanceFrom(values, index, named));
      byGroup.set(totalSpin, resonances);
    }
    byGroup.forEach((resonances, totalSpin) =>
      groups.push({
        orbital,
        totalSpin,
        scatteringRadius: named === 'reichMoore' && orbitalRadius > 0 ? orbitalRadius : radius,
        resonances,
      }),
    );
  }
  return {
    formalism: named,
    lowInEv: Math.max(low, LOWEST_ENERGY_IN_EV),
    highInEv: high,
    targetSpin,
    channelRadius:
      radiusFlag === 1
        ? radius
        : CHANNEL_RADIUS_SLOPE * Math.cbrt(massRatio) + CHANNEL_RADIUS_OFFSET,
    massRatio,
    groups,
  };
}

export function resonanceGrid(range: ResolvedRange): readonly number[] {
  const decades = Math.log10(range.highInEv / range.lowInEv);
  const background = Array.from(
    { length: Math.ceil(decades * BACKGROUND_POINTS_PER_DECADE) + 1 },
    (unused, index) => range.lowInEv * 10 ** (index / BACKGROUND_POINTS_PER_DECADE),
  );
  const around = range.groups.flatMap((group) =>
    group.resonances.flatMap((resonance) => {
      const width =
        resonance.neutronWidthInEv +
        resonance.captureWidthInEv +
        resonance.competitiveWidthInEv +
        Math.abs(resonance.fissionWidthsInEv[0]) +
        Math.abs(resonance.fissionWidthsInEv[1]);
      return WIDTH_OFFSETS.map((offset) => resonance.energyInEv + offset * HALF * width);
    }),
  );
  return [...new Set([...background, ...around, THERMAL_ENERGY_IN_EV])]
    .filter((energy) => energy >= range.lowInEv && energy < range.highInEv)
    .sort((first, second) => first - second);
}

function waveNumber(range: ResolvedRange, energyInEv: number): number {
  return (
    WAVE_NUMBER_PER_ROOT_EV * (range.massRatio / (range.massRatio + 1)) * Math.sqrt(energyInEv)
  );
}

function possibleWeight(orbital: number): number {
  return 2 * orbital + 1;
}

interface GroupCrossSections {
  readonly total: number;
  readonly elastic: number;
  readonly fission: number;
}

function breitWignerGroup(
  range: ResolvedRange,
  group: SpinGroup,
  energy: number,
  unit: number,
): GroupCrossSections {
  const wave = waveNumber(range, energy);
  const weight = statisticalWeight(group.totalSpin, range.targetSpin);
  const waveRadius = wave * range.channelRadius;
  const phase = hardSpherePhase(group.orbital, wave * group.scatteringRadius);
  let amplitude: Complex = [0, 0];
  let absorption = 0;
  let fission = 0;
  group.resonances.forEach((resonance) => {
    const resonanceWaveRadius =
      waveNumber(range, Math.abs(resonance.energyInEv)) * range.channelRadius;
    const penetrationAtResonance = penetrability(group.orbital, resonanceWaveRadius);
    if (!(penetrationAtResonance > 0)) {
      return;
    }
    const neutronWidth =
      (resonance.neutronWidthInEv * penetrability(group.orbital, waveRadius)) /
      penetrationAtResonance;
    const shiftedEnergy =
      resonance.energyInEv +
      (resonance.neutronWidthInEv *
        (shiftFactor(group.orbital, resonanceWaveRadius) -
          shiftFactor(group.orbital, waveRadius))) /
        (2 * penetrationAtResonance);
    const fissionWidth = resonance.fissionWidthsInEv[0];
    const totalWidth =
      neutronWidth + resonance.captureWidthInEv + fissionWidth + resonance.competitiveWidthInEv;
    const detuning = shiftedEnergy - energy;
    const denominator = detuning ** 2 + (HALF * totalWidth) ** 2;
    const lorentzian = (neutronWidth * weight * unit) / denominator;
    absorption += lorentzian * (resonance.captureWidthInEv + fissionWidth);
    fission += lorentzian * fissionWidth;
    amplitude = [
      amplitude[0] - (neutronWidth * HALF * totalWidth) / denominator,
      amplitude[1] + (neutronWidth * detuning) / denominator,
    ];
  });
  const rotation: Complex = [Math.cos(2 * phase), -Math.sin(2 * phase)];
  const collision = multiply(rotation, [1 + amplitude[0], amplitude[1]]);
  const elastic = unit * weight * ((1 - collision[0]) ** 2 + collision[1] ** 2);
  return { total: elastic + absorption, elastic, fission };
}

export function reconstruct(range: ResolvedRange, energies: readonly number[]): Reconstructed {
  const elastic: number[] = [];
  const capture: number[] = [];
  const fission: number[] = [];
  const orbitals = [...new Set(range.groups.map((group) => group.orbital))];
  energies.forEach((energy) => {
    const wave = waveNumber(range, energy);
    const unit = Math.PI / (wave * wave);
    let total = 0;
    let scattering = 0;
    let fissionSum = 0;
    orbitals.forEach((orbital) => {
      const groups = range.groups.filter((group) => group.orbital === orbital);
      const present = groups.reduce(
        (sum, group) => sum + statisticalWeight(group.totalSpin, range.targetSpin),
        0,
      );
      const missing = Math.max(possibleWeight(orbital) - present, 0);
      const phase = hardSpherePhase(orbital, wave * (groups[0]?.scatteringRadius ?? 0));
      const potential = 4 * unit * missing * Math.sin(phase) ** 2;
      total += potential;
      scattering += potential;
      groups.forEach((group) => {
        if (range.formalism === 'breitWigner') {
          const own = breitWignerGroup(range, group, energy, unit);
          total += own.total;
          scattering += own.elastic;
          fissionSum += own.fission;
          return;
        }
        const weight = statisticalWeight(group.totalSpin, range.targetSpin);
        const groupPhase = hardSpherePhase(orbital, wave * group.scatteringRadius);
        const penetrationHere = penetrability(orbital, wave * range.channelRadius);
        const channels = [
          true,
          group.resonances.some((resonance) => resonance.fissionWidthsInEv[0] !== 0),
          group.resonances.some((resonance) => resonance.fissionWidthsInEv[1] !== 0),
        ];
        const used = channels.flatMap((open, index) => (open ? [index] : []));
        const matrix: Complex[][] = used.map((row) =>
          used.map((column): Complex => [row === column ? 1 : 0, 0]),
        );
        group.resonances.forEach((resonance) => {
          const penetrationAtResonance = penetrability(
            orbital,
            waveNumber(range, Math.abs(resonance.energyInEv)) * range.channelRadius,
          );
          const neutronWidth =
            penetrationAtResonance > 0
              ? (resonance.neutronWidthInEv * penetrationHere) / penetrationAtResonance
              : 0;
          const amplitudes = [
            Math.sqrt(Math.max(neutronWidth, 0)),
            signedRoot(resonance.fissionWidthsInEv[0]),
            signedRoot(resonance.fissionWidthsInEv[1]),
          ];
          const denominator: Complex = [
            resonance.energyInEv - energy,
            -HALF * resonance.captureWidthInEv,
          ];
          const pole = divide([0, HALF], denominator);
          used.forEach((row, rowIndex) =>
            used.forEach((column, columnIndex) => {
              const product = (amplitudes[row] ?? 0) * (amplitudes[column] ?? 0);
              const entry = matrix[rowIndex]?.[columnIndex] ?? [0, 0];
              const target = matrix[rowIndex];
              if (target !== undefined) {
                target[columnIndex] = [entry[0] - product * pole[0], entry[1] - product * pole[1]];
              }
            }),
          );
        });
        const inverted = inverse(matrix);
        const neutronNeutron = inverted[0]?.[0] ?? [1, 0];
        const rotation: Complex = [Math.cos(2 * groupPhase), -Math.sin(2 * groupPhase)];
        const collision = multiply(rotation, [2 * neutronNeutron[0] - 1, 2 * neutronNeutron[1]]);
        total += 2 * unit * weight * (1 - collision[0]);
        scattering += unit * weight * ((1 - collision[0]) ** 2 + collision[1] ** 2);
        used.slice(1).forEach((unused, index) => {
          const element = inverted[0]?.[index + 1] ?? [0, 0];
          fissionSum += 4 * unit * weight * (element[0] ** 2 + element[1] ** 2);
        });
      });
    });
    elastic.push(scattering);
    fission.push(fissionSum);
    capture.push(Math.max(total - scattering - fissionSum, 0));
  });
  return { energiesInEv: energies, elastic, capture, fission };
}
