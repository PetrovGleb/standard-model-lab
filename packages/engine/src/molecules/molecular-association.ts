/* Formation of a chemical bond in a gas: a neutral atom or molecule meets an atom or molecule of the medium and, when both keep a free ordinary valence (octet or duet rule, so noble gases stay inert), they pair all the unpaired valences they can: the bond order is the smaller free valence, at most triple (C + O gives C=O, N + N gives N≡N). The rate follows from detailed balance with thermal dissociation of that bond:
   k_join = K(T)·k_break with K = Z_AB / (Z_A Z_B)·exp(D/kT) from translational, rotational, vibrational and electronic partition functions; the Boltzmann factors cancel, so k_join = attempt frequency × Z_AB / (Z_A Z_B). A cold gas assembles molecules, a hot one takes them apart. */
import {
  BOLTZMANN_CONSTANT,
  BOLTZMANN_CONSTANT_IN_EV_PER_KELVIN,
  ELECTRON_VOLT,
  REDUCED_PLANCK_CONSTANT,
  SPEED_OF_LIGHT_IN_VACUUM,
  groundStatisticalWeight,
  matterIdentity,
  ordinaryValence,
  moleculeName,
  moleculeStructureOf,
  particleSpec,
  type MoleculeStructure,
} from '@standard-model/constants';
import type { MediumAspect, ParticleName } from '@standard-model/contracts';
import { EV_PER_GEV } from '@standard-model/utils';
import { bondAttemptFrequencyInHertz } from './molecular-behaviour.js';
import { molecularStructure, validateMoleculeStructure } from './molecular-structure.js';

const SINGLE_BOND = 1;
const MAXIMUM_BOND_ORDER = 3;
const NEGLIGIBLE_MOMENT_FRACTION = 1e-6;

export interface AssociationChannel {
  readonly partner: ParticleName;
  readonly product: ParticleName;
  readonly bondIndex: number;
  readonly ratePerSecond: number;
}

export function bondingStructureOf(name: ParticleName): MoleculeStructure | null {
  if (name.startsWith('molecule:')) {
    return moleculeStructureOf(name);
  }
  const identity = matterIdentity(name);
  return identity !== null && identity.kind === 'atom' && identity.charge === 0
    ? { atoms: [{ protons: identity.protons, massNumber: identity.massNumber }], bonds: [] }
    : null;
}

export function freeValences(structure: MoleculeStructure): number[] {
  return structure.atoms.map(
    (atom, index) =>
      ordinaryValence(atom.protons) -
      structure.bonds
        .filter((bond) => bond.first === index || bond.second === index)
        .reduce((sum, bond) => sum + bond.order, 0),
  );
}

function massInKilograms(name: ParticleName): number {
  return (
    (particleSpec(name).massInGev.value * EV_PER_GEV * ELECTRON_VOLT.value) /
    SPEED_OF_LIGHT_IN_VACUUM.value ** 2
  );
}

export function rotationalPartition(
  moments: readonly number[],
  linear: boolean,
  thermal: number,
): number {
  const scale = (moment: number): number =>
    (2 * moment * thermal) / REDUCED_PLANCK_CONSTANT.value ** 2;
  const largest = Math.max(...moments);
  return linear
    ? scale(largest)
    : Math.sqrt(Math.PI) *
        moments
          .filter((moment) => moment > largest * NEGLIGIBLE_MOMENT_FRACTION)
          .reduce((product, moment) => product * Math.sqrt(scale(moment)), 1);
}

export function translationalPartitionPerCubicMeter(
  massInKilogramsOfSpecies: number,
  temperatureInKelvin: number,
): number {
  return (
    ((massInKilogramsOfSpecies * BOLTZMANN_CONSTANT.value * temperatureInKelvin) /
      (2 * Math.PI * REDUCED_PLANCK_CONSTANT.value ** 2)) **
    (3 / 2)
  );
}

export function speciesMassInKilograms(name: ParticleName): number {
  return massInKilograms(name);
}

export function rotationalPartitionOf(name: ParticleName, temperatureInKelvin: number): number {
  const structure = bondingStructureOf(name);
  if (structure === null || structure.bonds.length === 0) {
    return 1;
  }
  const built = molecularStructure(name);
  return rotationalPartition(
    built.momentsOfInertiaInKilogramSquareMeters,
    built.linear,
    BOLTZMANN_CONSTANT.value * temperatureInKelvin,
  );
}

export function partitionFunctionPerCubicMeter(
  name: ParticleName,
  temperatureInKelvin: number,
): number {
  const thermal = BOLTZMANN_CONSTANT.value * temperatureInKelvin;
  const translational =
    ((massInKilograms(name) * thermal) / (2 * Math.PI * REDUCED_PLANCK_CONSTANT.value ** 2)) **
    (3 / 2);
  const structure = bondingStructureOf(name);
  if (structure === null || structure.bonds.length === 0) {
    const atom = structure?.atoms[0];
    return (
      translational * (atom === undefined ? 1 : (groundStatisticalWeight(atom.protons, 0) ?? 1))
    );
  }
  const built = molecularStructure(name);
  const vibrational = built.normalModes.reduce(
    (product, mode) =>
      product /
      -Math.expm1(
        -(REDUCED_PLANCK_CONSTANT.value * mode.angularFrequencyInRadiansPerSecond) / thermal,
      ),
    1,
  );
  const unpaired = freeValences(structure).reduce((sum, free) => sum + Math.max(free, 0), 0);
  return (
    translational *
    rotationalPartition(built.momentsOfInertiaInKilogramSquareMeters, built.linear, thermal) *
    vibrational *
    (unpaired + 1)
  );
}

export function joined(
  first: MoleculeStructure,
  second: MoleculeStructure,
  firstAtom: number,
  secondAtom: number,
  order: number,
): MoleculeStructure {
  const offset = first.atoms.length;
  return {
    atoms: [...first.atoms, ...second.atoms],
    bonds: [
      ...first.bonds,
      ...second.bonds.map((bond) => ({
        ...bond,
        first: bond.first + offset,
        second: bond.second + offset,
      })),
      { first: firstAtom, second: secondAtom + offset, order },
    ],
  };
}

export function signature(structure: MoleculeStructure): string {
  const symbolOf = (index: number): string => String(structure.atoms[index]?.protons ?? 0);
  return [
    structure.atoms
      .map((atom) => atom.protons)
      .sort((left, right) => left - right)
      .join(','),
    structure.bonds
      .map(
        (bond) =>
          [symbolOf(bond.first), symbolOf(bond.second)].sort().join('-') + `:${String(bond.order)}`,
      )
      .sort()
      .join(','),
  ].join(';');
}

function newBondIndex(product: ParticleName, firstAtom: number, secondAtom: number): number {
  return molecularStructure(product).bonds.findIndex(
    (bond) =>
      (bond.first === firstAtom && bond.second === secondAtom) ||
      (bond.first === secondAtom && bond.second === firstAtom),
  );
}

export function associationChannels(
  name: ParticleName,
  medium: MediumAspect,
): readonly AssociationChannel[] {
  const temperature = medium.temperatureInKelvin;
  const own = bondingStructureOf(name);
  if (own === null || !(temperature > 0)) {
    return [];
  }
  const ownFree = freeValences(own);
  const seen = new Set<string>();
  return medium.components.flatMap((component) => {
    const partner = bondingStructureOf(component.species);
    if (partner === null || !(component.numberDensityPerCubicMeter > 0)) {
      return [];
    }
    const partnerFree = freeValences(partner);
    return ownFree.flatMap((ownSpare, firstAtom) =>
      partnerFree.flatMap((partnerSpare, secondAtom) => {
        if (ownSpare < SINGLE_BOND || partnerSpare < SINGLE_BOND) {
          return [];
        }
        const order = Math.min(ownSpare, partnerSpare, MAXIMUM_BOND_ORDER);
        const structure = joined(own, partner, firstAtom, secondAtom, order);
        const key = `${component.species}|${signature(structure)}`;
        if (seen.has(key) || validateMoleculeStructure(structure) !== null) {
          return [];
        }
        seen.add(key);
        const product = moleculeName(structure);
        const bondIndex = newBondIndex(product, firstAtom, secondAtom + own.atoms.length);
        const ratio =
          partitionFunctionPerCubicMeter(product, temperature) /
          (partitionFunctionPerCubicMeter(name, temperature) *
            partitionFunctionPerCubicMeter(component.species, temperature));
        return [
          {
            partner: component.species,
            product,
            bondIndex,
            ratePerSecond:
              component.numberDensityPerCubicMeter *
              bondAttemptFrequencyInHertz(molecularStructure(product), bondIndex) *
              ratio,
          },
        ];
      }),
    );
  });
}

export function equilibriumConstantInCubicMeters(
  product: ParticleName,
  first: ParticleName,
  second: ParticleName,
  bondIndex: number,
  temperatureInKelvin: number,
): number {
  const bond = molecularStructure(product).bonds[bondIndex];
  return (
    (partitionFunctionPerCubicMeter(product, temperatureInKelvin) /
      (partitionFunctionPerCubicMeter(first, temperatureInKelvin) *
        partitionFunctionPerCubicMeter(second, temperatureInKelvin))) *
    Math.exp(
      (bond?.dissociationEnergyInEv ?? 0) /
        (BOLTZMANN_CONSTANT_IN_EV_PER_KELVIN.value * temperatureInKelvin),
    )
  );
}
