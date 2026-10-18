/* MolecularStructure: UFF atom typing, bond lengths, stretch and bend constants (Rappé 1992), a geometry relaxed by energy minimization, harmonic normal modes of the mass-weighted Hessian with their infrared strengths, principal moments of inertia, QEq charges with Ohno–Klopman screening and the dipole moment. */
import {
  ATOMIC_MASS_CONSTANT,
  AVOGADRO_CONSTANT,
  ELEMENTARY_CHARGE,
  MATTER_DATA,
  PLANCK_CONSTANT,
  SPEED_OF_LIGHT_IN_VACUUM,
  VACUUM_ELECTRIC_PERMITTIVITY,
  bondEnergyInEv,
  electronAffinityInEv,
  elementSymbol,
  maximumValence,
  moleculeCharge,
  moleculeStructureOf,
  nuclideRecord,
  restMassInGev,
  atomName,
  type MoleculeStructure,
  type UffAtomType,
} from '@standard-model/constants';
import {
  LocalizedError,
  localizedText,
  type LocalizedText,
  type ParticleName,
  type Vector3,
} from '@standard-model/contracts';
import { gevToAtomicMassUnits } from '@standard-model/utils';
import { jacobiEigensystem } from '../quantum/linear-algebra.js';

const BOND_ORDER_CORRECTION = 0.1332;
const UFF_FORCE_CONSTANT_FACTOR = 664.12;
const LINEAR_ANGLE_THRESHOLD_IN_DEGREES = 179;
const DEGREES_PER_RADIAN = 180 / Math.PI;
const JOULES_PER_KILOCALORIE = 4184;
const METERS_PER_ANGSTROM = 1e-10;
const CENTIMETERS_PER_METER = 100;
const GIGAHERTZ = 1e9;
const DEBYE_IN_COULOMB_METERS = 1e-21 / SPEED_OF_LIGHT_IN_VACUUM.value;
const COULOMB_IN_EV_ANGSTROM =
  ELEMENTARY_CHARGE.value /
  (4 * Math.PI * VACUUM_ELECTRIC_PERMITTIVITY.value * METERS_PER_ANGSTROM);
const HARDNESS_TO_IDEMPOTENTIAL = 2;
const KILOCALORIE_PER_MOLE_IN_JOULES = JOULES_PER_KILOCALORIE / AVOGADRO_CONSTANT.value;
const MINIMIZATION_STEPS = 4000;
const MINIMIZATION_GRADIENT_TOLERANCE = 1e-7;
const INITIAL_STEP_IN_ANGSTROM = 0.02;
const STEP_GROWTH = 1.2;
const STEP_SHRINK = 0.5;
const SMALLEST_STEP_IN_ANGSTROM = 1e-9;
const HESSIAN_STEP_IN_ANGSTROM = 1e-4;
const DIPOLE_DERIVATIVE_STEP = 1e-3;
const LINEAR_INERTIA_RATIO = 1e-3;
const ROTATIONS_LINEAR = 5;
const ROTATIONS_NONLINEAR = 6;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const SEED_DIRECTIONS = 12;
const NO_SHIFT = [0, 0, 0];

export interface MolecularAtom {
  readonly protons: number;
  readonly massNumber: number;
  readonly symbol: string;
  readonly name: ParticleName;
  readonly atomType: UffAtomType;
  readonly massInAtomicMassUnits: number;
}

export interface MolecularBond {
  readonly first: number;
  readonly second: number;
  readonly order: number;
  readonly restLengthInAngstrom: number;
  readonly forceConstantInKcalPerMolePerSquareAngstrom: number;
  readonly dissociationEnergyInEv: number;
}

interface AngleTerm {
  readonly first: number;
  readonly center: number;
  readonly last: number;
  readonly forceConstant: number;
  readonly linear: boolean;
  readonly constant: number;
  readonly cosineCoefficient: number;
  readonly doubleCosineCoefficient: number;
}

interface NonbondTerm {
  readonly first: number;
  readonly second: number;
  readonly distanceInAngstrom: number;
  readonly wellDepthInKcalPerMole: number;
}

export interface NormalMode {
  readonly wavenumberInInverseCentimeters: number;
  readonly angularFrequencyInRadiansPerSecond: number;
  readonly infraredStrengthInSquareMetersPerSecond: number;
}

export interface MolecularStructure {
  readonly name: ParticleName;
  readonly atoms: readonly MolecularAtom[];
  readonly bonds: readonly MolecularBond[];
  readonly positionsInAngstrom: readonly Vector3[];
  readonly bondLengthsInAngstrom: readonly number[];
  readonly normalModes: readonly NormalMode[];
  readonly momentsOfInertiaInKilogramSquareMeters: readonly number[];
  readonly rotationalConstantsInGigahertz: readonly number[];
  readonly linear: boolean;
  readonly partialCharges: readonly number[];
  readonly dipoleMomentInDebye: number;
  readonly dipoleMomentInCoulombMeters: number;
  readonly totalBindingInEv: number;
  readonly massInAtomicMassUnits: number;
}

function elementTypes(symbol: string): readonly UffAtomType[] {
  return MATTER_DATA.uffAtomTypes.filter(
    (type) => type.atomType.replace(/[_\d].*$/, '').replace(/\+.*$/, '') === symbol,
  );
}

function chooseAtomType(symbol: string, orders: readonly number[]): UffAtomType {
  const candidates = elementTypes(symbol);
  const doubles = orders.filter((order) => order === 2).length;
  const hybrid = orders.includes(3) || doubles >= 2 ? '1' : doubles === 1 ? '2' : '3';
  const chosen =
    candidates.find((type) => type.atomType === `${symbol}_${hybrid}`) ??
    candidates.find((type) => type.atomType.startsWith(`${symbol}_${hybrid}`)) ??
    candidates.find((type) => type.atomType === `${symbol}_`) ??
    candidates[0];
  if (chosen === undefined) {
    throw new Error(`UFF has no atom type for ${symbol}`);
  }
  return chosen;
}

export function validateMoleculeStructure(structure: MoleculeStructure): LocalizedText | null {
  const count = structure.atoms.length;
  for (const atom of structure.atoms) {
    if (nuclideRecord(atom.protons, atom.massNumber) === null) {
      return localizedText(
        `в NUBASE2020 нет нуклида ${elementSymbol(atom.protons)}-${String(atom.massNumber)}`,
        `no nuclide ${elementSymbol(atom.protons)}-${String(atom.massNumber)} in NUBASE2020`,
      );
    }
    if (elementTypes(elementSymbol(atom.protons)).length === 0) {
      return localizedText(
        `у ${elementSymbol(atom.protons)} нет параметров UFF для связей`,
        `${elementSymbol(atom.protons)} has no UFF parameters for bonding`,
      );
    }
  }
  for (const { atom: index, charge } of structure.charges ?? []) {
    const atom = structure.atoms[index];
    const possible =
      atom !== undefined &&
      Number.isInteger(charge) &&
      (charge > 0
        ? charge < atom.protons
        : charge === -1 && electronAffinityInEv(atom.protons) !== null);
    if (!possible) {
      return localizedText(
        `заряд ${String(charge)} на атоме ${String(index)} невозможен: катиону нужен хотя бы один электрон, анион с зарядом −1 — известное сродство к электрону`,
        `charge ${String(charge)} on atom ${String(index)} is impossible: a cation needs at least one electron, a −1 anion a known electron affinity`,
      );
    }
  }
  const seen = new Set<string>();
  for (const bond of structure.bonds) {
    if (bond.first === bond.second || bond.first >= count || bond.second >= count) {
      return localizedText(
        `связь ${String(bond.first)}–${String(bond.second)} должна соединять два разных атома молекулы`,
        `bond ${String(bond.first)}–${String(bond.second)} must join two different atoms of the molecule`,
      );
    }
    const key = [bond.first, bond.second].sort((left, right) => left - right).join('-');
    if (seen.has(key)) {
      return localizedText(
        `атомы ${key} связаны дважды; оставьте одну связь нужного порядка`,
        `atoms ${key} are bonded twice; set one bond with the order you need`,
      );
    }
    seen.add(key);
  }
  for (let index = 0; index < count; index += 1) {
    const atom = structure.atoms[index];
    if (atom === undefined) {
      continue;
    }
    const used = structure.bonds
      .filter((bond) => bond.first === index || bond.second === index)
      .reduce((sum, bond) => sum + bond.order, 0);
    const allowed = maximumValence(atom.protons);
    if (used > allowed) {
      return localizedText(
        `у атома ${String(index)} (${elementSymbol(atom.protons)}) связей ${String(used)}, а валентность не больше ${String(allowed)}`,
        `atom ${String(index)} (${elementSymbol(atom.protons)}) has ${String(used)} bonds but its valence is at most ${String(allowed)}`,
      );
    }
  }
  const reached = new Set<number>([0]);
  let grew = true;
  while (grew) {
    grew = false;
    structure.bonds.forEach((bond) => {
      if (reached.has(bond.first) !== reached.has(bond.second)) {
        reached.add(bond.first);
        reached.add(bond.second);
        grew = true;
      }
    });
  }
  return reached.size === count
    ? null
    : localizedText(
        'не все атомы соединены связями; молекула должна быть одним целым',
        'some atoms are not connected by bonds; a molecule has to be one connected piece',
      );
}

export function uffBondStiffnessInKcalPerMolePerSquareAngstrom(
  first: UffAtomType,
  second: UffAtomType,
  lengthInAngstrom: number,
): number {
  return (
    (UFF_FORCE_CONSTANT_FACTOR * first.effectiveCharge * second.effectiveCharge) /
    lengthInAngstrom ** 3
  );
}

export function restLength(first: UffAtomType, second: UffAtomType, order: number): number {
  const radii = first.bondRadiusInAngstrom + second.bondRadiusInAngstrom;
  const orderCorrection = -BOND_ORDER_CORRECTION * radii * Math.log(order);
  const electronegativityCorrection =
    (first.bondRadiusInAngstrom *
      second.bondRadiusInAngstrom *
      (Math.sqrt(first.electronegativity) - Math.sqrt(second.electronegativity)) ** 2) /
    (first.electronegativity * first.bondRadiusInAngstrom +
      second.electronegativity * second.bondRadiusInAngstrom);
  return radii + orderCorrection - electronegativityCorrection;
}

type Coordinates = Float64Array;

function distance(coordinates: Coordinates, first: number, second: number): number {
  return Math.hypot(
    (coordinates[3 * first] ?? 0) - (coordinates[3 * second] ?? 0),
    (coordinates[3 * first + 1] ?? 0) - (coordinates[3 * second + 1] ?? 0),
    (coordinates[3 * first + 2] ?? 0) - (coordinates[3 * second + 2] ?? 0),
  );
}

function difference(
  coordinates: Coordinates,
  origin: number,
  target: number,
): [number, number, number] {
  return [
    (coordinates[3 * target] ?? 0) - (coordinates[3 * origin] ?? 0),
    (coordinates[3 * target + 1] ?? 0) - (coordinates[3 * origin + 1] ?? 0),
    (coordinates[3 * target + 2] ?? 0) - (coordinates[3 * origin + 2] ?? 0),
  ];
}

function addTo(
  gradient: Float64Array,
  atom: number,
  vector: readonly number[],
  factor: number,
): void {
  for (let axis = 0; axis < 3; axis += 1) {
    gradient[3 * atom + axis] = (gradient[3 * atom + axis] ?? 0) + factor * (vector[axis] ?? 0);
  }
}

class ForceField {
  constructor(
    private readonly bonds: readonly MolecularBond[],
    private readonly angles: readonly AngleTerm[],
    private readonly nonbonds: readonly NonbondTerm[],
  ) {}

  energyAndGradient(coordinates: Coordinates): { energy: number; gradient: Float64Array } {
    const gradient = new Float64Array(coordinates.length);
    let energy = 0;
    this.bonds.forEach((bond) => {
      const vector = difference(coordinates, bond.second, bond.first);
      const length = Math.hypot(...vector);
      const stretch = length - bond.restLengthInAngstrom;
      energy += 0.5 * bond.forceConstantInKcalPerMolePerSquareAngstrom * stretch * stretch;
      const factor = (bond.forceConstantInKcalPerMolePerSquareAngstrom * stretch) / length;
      addTo(gradient, bond.first, vector, factor);
      addTo(gradient, bond.second, vector, -factor);
    });
    this.angles.forEach((angle) => {
      const first = difference(coordinates, angle.center, angle.first);
      const last = difference(coordinates, angle.center, angle.last);
      const firstLength = Math.hypot(...first);
      const lastLength = Math.hypot(...last);
      const cosine =
        (first[0] * last[0] + first[1] * last[1] + first[2] * last[2]) / (firstLength * lastLength);
      const slope = angle.linear
        ? angle.forceConstant
        : angle.forceConstant *
          (angle.cosineCoefficient + 4 * angle.doubleCosineCoefficient * cosine);
      energy += angle.linear
        ? angle.forceConstant * (1 + cosine)
        : angle.forceConstant *
          (angle.constant +
            angle.cosineCoefficient * cosine +
            angle.doubleCosineCoefficient * (2 * cosine * cosine - 1));
      const towardFirst = first.map(
        (component, axis) =>
          (last[axis] ?? 0) / (firstLength * lastLength) - (cosine * component) / firstLength ** 2,
      );
      const towardLast = last.map(
        (component, axis) =>
          (first[axis] ?? 0) / (firstLength * lastLength) - (cosine * component) / lastLength ** 2,
      );
      addTo(gradient, angle.first, towardFirst, slope);
      addTo(gradient, angle.last, towardLast, slope);
      addTo(gradient, angle.center, towardFirst, -slope);
      addTo(gradient, angle.center, towardLast, -slope);
    });
    this.nonbonds.forEach((pair) => {
      const vector = difference(coordinates, pair.second, pair.first);
      const length = Math.hypot(...vector);
      const ratio = pair.distanceInAngstrom / length;
      const sixth = ratio ** 6;
      energy += pair.wellDepthInKcalPerMole * (sixth * sixth - 2 * sixth);
      const slope = (pair.wellDepthInKcalPerMole * (-12 * sixth * sixth + 12 * sixth)) / length;
      addTo(gradient, pair.first, vector, slope / length);
      addTo(gradient, pair.second, vector, -slope / length);
    });
    return { energy, gradient };
  }
}

function seedCoordinates(atomCount: number, bonds: readonly MolecularBond[]): Coordinates {
  const coordinates = new Float64Array(3 * atomCount);
  const placed = new Set<number>([0]);
  const queue = [0];
  const directions = Array.from({ length: SEED_DIRECTIONS }, (unused, index) => {
    const height = 1 - (2 * (index + 0.5)) / SEED_DIRECTIONS;
    const radius = Math.sqrt(1 - height * height);
    return [
      radius * Math.cos(GOLDEN_ANGLE * index),
      height,
      radius * Math.sin(GOLDEN_ANGLE * index),
    ];
  });
  while (queue.length > 0) {
    const current = queue.shift() ?? 0;
    let used = 0;
    bonds
      .filter((bond) => bond.first === current || bond.second === current)
      .forEach((bond) => {
        const neighbor = bond.first === current ? bond.second : bond.first;
        if (placed.has(neighbor)) {
          return;
        }
        const direction = directions[(current * 5 + used) % SEED_DIRECTIONS] ?? [1, 0, 0];
        used += 1;
        for (let axis = 0; axis < 3; axis += 1) {
          coordinates[3 * neighbor + axis] =
            (coordinates[3 * current + axis] ?? 0) +
            bond.restLengthInAngstrom * (direction[axis] ?? 0);
        }
        placed.add(neighbor);
        queue.push(neighbor);
      });
  }
  return coordinates;
}

function minimize(field: ForceField, start: Coordinates): Coordinates {
  let coordinates = start;
  let current = field.energyAndGradient(coordinates);
  let step = INITIAL_STEP_IN_ANGSTROM;
  for (let iteration = 0; iteration < MINIMIZATION_STEPS; iteration += 1) {
    const norm = Math.hypot(...current.gradient);
    if (norm < MINIMIZATION_GRADIENT_TOLERANCE || step < SMALLEST_STEP_IN_ANGSTROM) {
      break;
    }
    const trial = coordinates.map(
      (value, index) => value - (step * (current.gradient[index] ?? 0)) / norm,
    );
    const next = field.energyAndGradient(trial);
    if (next.energy < current.energy) {
      coordinates = trial;
      current = next;
      step *= STEP_GROWTH;
    } else {
      step *= STEP_SHRINK;
    }
  }
  return coordinates;
}

function centerOfMass(
  coordinates: Coordinates,
  masses: readonly number[],
): [number, number, number] {
  const total = masses.reduce((sum, mass) => sum + mass, 0);
  const center: [number, number, number] = [0, 0, 0];
  masses.forEach((mass, atom) => {
    for (let axis = 0; axis < 3; axis += 1) {
      center[axis] = (center[axis] ?? 0) + (mass * (coordinates[3 * atom + axis] ?? 0)) / total;
    }
  });
  return center;
}

function principalMoments(coordinates: Coordinates, masses: readonly number[]): number[] {
  const center = centerOfMass(coordinates, masses);
  const tensor = new Float64Array(9);
  masses.forEach((mass, atom) => {
    const position = [0, 1, 2].map(
      (axis) => (coordinates[3 * atom + axis] ?? 0) - (center[axis] ?? 0),
    );
    const squared = position.reduce((sum, value) => sum + value * value, 0);
    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < 3; column += 1) {
        tensor[3 * row + column] =
          (tensor[3 * row + column] ?? 0) +
          mass * ((row === column ? squared : 0) - (position[row] ?? 0) * (position[column] ?? 0));
      }
    }
  });
  return [...jacobiEigensystem(tensor, 3).values].sort((first, second) => first - second);
}

function equilibrateCharges(
  atoms: readonly MolecularAtom[],
  coordinates: Coordinates,
  totalCharge: number,
): number[] {
  const count = atoms.length;
  const size = count + 1;
  const matrix = Array.from({ length: size }, () => new Array<number>(size + 1).fill(0));
  atoms.forEach((atom, row) => {
    const rowEntries = matrix[row] ?? [];
    atoms.forEach((other, column) => {
      const ownHardness = HARDNESS_TO_IDEMPOTENTIAL * atom.atomType.hardness;
      const otherHardness = HARDNESS_TO_IDEMPOTENTIAL * other.atomType.hardness;
      const screening = COULOMB_IN_EV_ANGSTROM / ((ownHardness + otherHardness) / 2);
      rowEntries[column] =
        row === column
          ? ownHardness
          : COULOMB_IN_EV_ANGSTROM /
            Math.sqrt(distance(coordinates, row, column) ** 2 + screening ** 2);
    });
    rowEntries[count] = 1;
    rowEntries[size] = -atom.atomType.electronegativity;
  });
  const constraint = matrix[count] ?? [];
  for (let column = 0; column < count; column += 1) {
    constraint[column] = 1;
  }
  constraint[size] = totalCharge;
  for (let pivot = 0; pivot < size; pivot += 1) {
    let best = pivot;
    for (let row = pivot + 1; row < size; row += 1) {
      if (Math.abs(matrix[row]?.[pivot] ?? 0) > Math.abs(matrix[best]?.[pivot] ?? 0)) {
        best = row;
      }
    }
    [matrix[pivot], matrix[best]] = [matrix[best] ?? [], matrix[pivot] ?? []];
    const pivotRow = matrix[pivot] ?? [];
    const pivotValue = pivotRow[pivot] ?? 1;
    for (let row = 0; row < size; row += 1) {
      if (row === pivot) {
        continue;
      }
      const target = matrix[row] ?? [];
      const factor = (target[pivot] ?? 0) / pivotValue;
      for (let column = pivot; column <= size; column += 1) {
        target[column] = (target[column] ?? 0) - factor * (pivotRow[column] ?? 0);
      }
    }
  }
  return atoms.map((unused, row) => (matrix[row]?.[size] ?? 0) / (matrix[row]?.[row] ?? 1));
}

function dipoleVector(
  atoms: readonly MolecularAtom[],
  coordinates: Coordinates,
  totalCharge: number,
  origin: readonly number[],
): [number, number, number] {
  const charges = equilibrateCharges(atoms, coordinates, totalCharge);
  const dipole: [number, number, number] = [0, 0, 0];
  charges.forEach((charge, atom) => {
    for (let axis = 0; axis < 3; axis += 1) {
      dipole[axis] =
        (dipole[axis] ?? 0) + charge * ((coordinates[3 * atom + axis] ?? 0) - (origin[axis] ?? 0));
    }
  });
  return dipole;
}

function normalModes(
  field: ForceField,
  atoms: readonly MolecularAtom[],
  coordinates: Coordinates,
  linear: boolean,
  totalCharge: number,
): NormalMode[] {
  const size = coordinates.length;
  const masses = atoms.flatMap((atom) => [
    atom.massInAtomicMassUnits,
    atom.massInAtomicMassUnits,
    atom.massInAtomicMassUnits,
  ]);
  const hessian = new Float64Array(size * size);
  for (let column = 0; column < size; column += 1) {
    const forward = Float64Array.from(coordinates);
    const backward = Float64Array.from(coordinates);
    forward[column] = (forward[column] ?? 0) + HESSIAN_STEP_IN_ANGSTROM;
    backward[column] = (backward[column] ?? 0) - HESSIAN_STEP_IN_ANGSTROM;
    const ahead = field.energyAndGradient(forward).gradient;
    const behind = field.energyAndGradient(backward).gradient;
    for (let row = 0; row < size; row += 1) {
      hessian[row * size + column] =
        ((ahead[row] ?? 0) - (behind[row] ?? 0)) /
        (2 * HESSIAN_STEP_IN_ANGSTROM) /
        Math.sqrt((masses[row] ?? 1) * (masses[column] ?? 1));
    }
  }
  for (let row = 0; row < size; row += 1) {
    for (let column = row + 1; column < size; column += 1) {
      const average =
        ((hessian[row * size + column] ?? 0) + (hessian[column * size + row] ?? 0)) / 2;
      hessian[row * size + column] = average;
      hessian[column * size + row] = average;
    }
  }
  const { values, vectors } = jacobiEigensystem(hessian, size);
  const toSiEigenvalue =
    KILOCALORIE_PER_MOLE_IN_JOULES / (METERS_PER_ANGSTROM ** 2 * ATOMIC_MASS_CONSTANT.value);
  const order = [...values.keys()].sort(
    (first, second) => (values[second] ?? 0) - (values[first] ?? 0),
  );
  const vibrations = Math.max(0, size - (linear ? ROTATIONS_LINEAR : ROTATIONS_NONLINEAR));
  const dipoleUnit = ELEMENTARY_CHARGE.value * METERS_PER_ANGSTROM;
  const coordinateUnit = Math.sqrt(ATOMIC_MASS_CONSTANT.value) * METERS_PER_ANGSTROM;
  return order.slice(0, vibrations).map((index) => {
    const angularFrequency = Math.sqrt(Math.max(0, (values[index] ?? 0) * toSiEigenvalue));
    const shifted = (sign: number): Float64Array =>
      coordinates.map(
        (value, row) =>
          value +
          (sign * DIPOLE_DERIVATIVE_STEP * (vectors[row * size + index] ?? 0)) /
            Math.sqrt(masses[row] ?? 1),
      );
    const ahead = dipoleVector(atoms, shifted(1), totalCharge, NO_SHIFT);
    const behind = dipoleVector(atoms, shifted(-1), totalCharge, NO_SHIFT);
    const derivativeSquared = [0, 1, 2].reduce(
      (sum, axis) =>
        sum + (((ahead[axis] ?? 0) - (behind[axis] ?? 0)) / (2 * DIPOLE_DERIVATIVE_STEP)) ** 2,
      0,
    );
    const derivativeSquaredSi = derivativeSquared * (dipoleUnit / coordinateUnit) ** 2;
    return {
      wavenumberInInverseCentimeters:
        angularFrequency / (2 * Math.PI * SPEED_OF_LIGHT_IN_VACUUM.value * CENTIMETERS_PER_METER),
      angularFrequencyInRadiansPerSecond: angularFrequency,
      infraredStrengthInSquareMetersPerSecond:
        (Math.PI * derivativeSquaredSi) /
        (6 * VACUUM_ELECTRIC_PERMITTIVITY.value * SPEED_OF_LIGHT_IN_VACUUM.value),
    };
  });
}

function buildStructure(name: ParticleName): MolecularStructure {
  const structure = moleculeStructureOf(name);
  const problem = validateMoleculeStructure(structure);
  if (problem !== null) {
    throw new LocalizedError(problem);
  }
  const totalCharge = moleculeCharge(structure);
  const atoms: MolecularAtom[] = structure.atoms.map((atom, index) => {
    const orders = structure.bonds
      .filter((bond) => bond.first === index || bond.second === index)
      .map((bond) => bond.order);
    const symbol = elementSymbol(atom.protons);
    const identity = atomName(atom.protons, atom.massNumber, 0);
    return {
      protons: atom.protons,
      massNumber: atom.massNumber,
      symbol,
      name: identity,
      atomType: chooseAtomType(symbol, orders),
      massInAtomicMassUnits: gevToAtomicMassUnits(restMassInGev(identity)),
    };
  });
  const typeOf = (index: number): UffAtomType => {
    const atom = atoms[index];
    if (atom === undefined) {
      throw new Error(`No atom ${String(index)}`);
    }
    return atom.atomType;
  };
  const bonds: MolecularBond[] = structure.bonds.map((bond) => {
    const length = restLength(typeOf(bond.first), typeOf(bond.second), bond.order);
    return {
      first: bond.first,
      second: bond.second,
      order: bond.order,
      restLengthInAngstrom: length,
      forceConstantInKcalPerMolePerSquareAngstrom: uffBondStiffnessInKcalPerMolePerSquareAngstrom(
        typeOf(bond.first),
        typeOf(bond.second),
        length,
      ),
      dissociationEnergyInEv: bondEnergyInEv(
        atoms[bond.first]?.protons ?? 0,
        atoms[bond.second]?.protons ?? 0,
        bond.order,
      ),
    };
  });
  const neighbors = atoms.map((unused, index) =>
    bonds.flatMap((bond) =>
      bond.first === index
        ? [{ atom: bond.second, bond }]
        : bond.second === index
          ? [{ atom: bond.first, bond }]
          : [],
    ),
  );
  const angles: AngleTerm[] = neighbors.flatMap((around, center) =>
    around.flatMap((first, firstIndex) =>
      around.slice(firstIndex + 1).map((last) => {
        const centerType = typeOf(center);
        const restAngle = centerType.bondAngleInDegrees / DEGREES_PER_RADIAN;
        const cosineRest = Math.cos(restAngle);
        const firstLength = first.bond.restLengthInAngstrom;
        const lastLength = last.bond.restLengthInAngstrom;
        const outerSquared =
          firstLength ** 2 + lastLength ** 2 - 2 * firstLength * lastLength * cosineRest;
        const forceConstant =
          ((UFF_FORCE_CONSTANT_FACTOR *
            typeOf(first.atom).effectiveCharge *
            typeOf(last.atom).effectiveCharge) /
            Math.sqrt(outerSquared) ** 5) *
          (3 * firstLength * lastLength * (1 - cosineRest ** 2) - outerSquared * cosineRest);
        const linear = centerType.bondAngleInDegrees > LINEAR_ANGLE_THRESHOLD_IN_DEGREES;
        const doubleCosine = linear ? 0 : 1 / (4 * Math.sin(restAngle) ** 2);
        return {
          first: first.atom,
          center,
          last: last.atom,
          forceConstant,
          linear,
          constant: doubleCosine * (2 * cosineRest ** 2 + 1),
          cosineCoefficient: -4 * doubleCosine * cosineRest,
          doubleCosineCoefficient: doubleCosine,
        };
      }),
    ),
  );
  const closeBy = new Set<string>();
  neighbors.forEach((around, center) => {
    around.forEach((first) => {
      closeBy.add(
        `${String(Math.min(center, first.atom))}:${String(Math.max(center, first.atom))}`,
      );
      around.forEach((last) => {
        if (first.atom !== last.atom) {
          closeBy.add(
            `${String(Math.min(first.atom, last.atom))}:${String(Math.max(first.atom, last.atom))}`,
          );
        }
      });
    });
  });
  const nonbonds: NonbondTerm[] = atoms.flatMap((atom, first) =>
    atoms.slice(first + 1).flatMap((other, offset) => {
      const second = first + 1 + offset;
      return closeBy.has(`${String(first)}:${String(second)}`)
        ? []
        : [
            {
              first,
              second,
              distanceInAngstrom: Math.sqrt(
                atom.atomType.nonbondDistanceInAngstrom * other.atomType.nonbondDistanceInAngstrom,
              ),
              wellDepthInKcalPerMole: Math.sqrt(
                atom.atomType.nonbondEnergyInKcalPerMole *
                  other.atomType.nonbondEnergyInKcalPerMole,
              ),
            },
          ];
    }),
  );
  const field = new ForceField(bonds, angles, nonbonds);
  const coordinates = minimize(field, seedCoordinates(atoms.length, bonds));
  const masses = atoms.map((atom) => atom.massInAtomicMassUnits);
  const momentsInAmuSquareAngstrom = principalMoments(coordinates, masses);
  const largest = momentsInAmuSquareAngstrom[2] ?? 0;
  const linear = (momentsInAmuSquareAngstrom[0] ?? 0) < LINEAR_INERTIA_RATIO * largest;
  const moments = momentsInAmuSquareAngstrom.map(
    (moment) => moment * ATOMIC_MASS_CONSTANT.value * METERS_PER_ANGSTROM ** 2,
  );
  const center = centerOfMass(coordinates, masses);
  const dipole = dipoleVector(
    atoms,
    coordinates,
    totalCharge,
    totalCharge === 0 ? NO_SHIFT : center,
  );
  const dipoleInCoulombMeters =
    Math.hypot(...dipole) * ELEMENTARY_CHARGE.value * METERS_PER_ANGSTROM;
  return {
    name,
    atoms,
    bonds,
    positionsInAngstrom: atoms.map((unused, atom) => ({
      x: (coordinates[3 * atom] ?? 0) - center[0],
      y: (coordinates[3 * atom + 1] ?? 0) - center[1],
      z: (coordinates[3 * atom + 2] ?? 0) - center[2],
    })),
    bondLengthsInAngstrom: bonds.map((bond) => distance(coordinates, bond.first, bond.second)),
    normalModes: normalModes(field, atoms, coordinates, linear, totalCharge),
    momentsOfInertiaInKilogramSquareMeters: moments,
    rotationalConstantsInGigahertz: moments
      .filter((moment) => moment > LINEAR_INERTIA_RATIO * (moments[2] ?? 0))
      .map((moment) => PLANCK_CONSTANT.value / (8 * Math.PI ** 2 * moment) / GIGAHERTZ),
    linear,
    partialCharges: equilibrateCharges(atoms, coordinates, totalCharge),
    dipoleMomentInDebye: dipoleInCoulombMeters / DEBYE_IN_COULOMB_METERS,
    dipoleMomentInCoulombMeters: dipoleInCoulombMeters,
    totalBindingInEv: bonds.reduce((sum, bond) => sum + bond.dissociationEnergyInEv, 0),
    massInAtomicMassUnits: masses.reduce((sum, mass) => sum + mass, 0),
  };
}

const STRUCTURES = new Map<ParticleName, MolecularStructure>();

export function molecularStructure(name: ParticleName): MolecularStructure {
  const cached = STRUCTURES.get(name);
  if (cached !== undefined) {
    return cached;
  }
  const built = buildStructure(name);
  STRUCTURES.set(name, built);
  return built;
}

export function bondAngleInDegrees(
  structure: MolecularStructure,
  first: number,
  center: number,
  last: number,
): number {
  const position = (atom: number): Vector3 =>
    structure.positionsInAngstrom[atom] ?? { x: 0, y: 0, z: 0 };
  const start = position(first);
  const middle = position(center);
  const end = position(last);
  const toFirst = [start.x - middle.x, start.y - middle.y, start.z - middle.z];
  const toLast = [end.x - middle.x, end.y - middle.y, end.z - middle.z];
  const dot = toFirst.reduce((sum, value, axis) => sum + value * (toLast[axis] ?? 0), 0);
  return Math.acos(dot / (Math.hypot(...toFirst) * Math.hypot(...toLast))) * DEGREES_PER_RADIAN;
}

export type { MoleculeStructure };
