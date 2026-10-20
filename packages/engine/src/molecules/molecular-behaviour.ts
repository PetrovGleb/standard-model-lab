/* Molecular behaviour in an environment: internal energy and heat capacity from rotations and Einstein vibrational modes, unimolecular thermal dissociation of each bond at its vibrational attempt rate times exp(−D/kT), collisional relaxation toward the gas temperature (hard spheres of the UFF Lennard-Jones diameters when a component names no cross section; the line widths of absorption keep the given cross sections), Debye orientational and resonant infrared absorption of radiation, and the fragments left when a bond breaks. */
import {
  ATOMIC_MASS_CONSTANT,
  AVOGADRO_CONSTANT,
  BOLTZMANN_CONSTANT,
  BOLTZMANN_CONSTANT_IN_EV_PER_KELVIN,
  REDUCED_PLANCK_CONSTANT,
  SPEED_OF_LIGHT_IN_VACUUM,
  VACUUM_ELECTRIC_PERMITTIVITY,
  atomName,
  formalChargeOf,
  moleculeName,
  moleculeStructureOf,
  restMassInGev,
} from '@standard-model/constants';
import type { MediumAspect, MediumComponent, ParticleName } from '@standard-model/contracts';
import { gevToAtomicMassUnits } from '@standard-model/utils';
import { lennardJonesDiameterInMeters } from '../environment/aggregate-state.js';
import type { MolecularStructure } from './molecular-structure.js';

const JOULES_PER_KILOCALORIE = 4184;
const SQUARE_METERS_PER_SQUARE_ANGSTROM = 1e-20;
const UFF_STIFFNESS_TO_SI =
  JOULES_PER_KILOCALORIE / AVOGADRO_CONSTANT.value / SQUARE_METERS_PER_SQUARE_ANGSTROM;
const LINEAR_ROTATIONAL_DEGREES = 2;
const NONLINEAR_ROTATIONAL_DEGREES = 3;
const HALF = 0.5;
const TEMPERATURE_SEARCH_STEPS = 64;
const HIGHEST_TEMPERATURE_IN_KELVIN = 1e6;
const HEATING_SUBSTEPS = 64;
const NEGLIGIBLE_HEATING_FRACTION = 1e-12;
const DOPPLER_FACTOR = 2 * Math.LN2;

export function internalEnergyInJoules(
  structure: MolecularStructure,
  temperatureInKelvin: number,
): number {
  if (temperatureInKelvin <= 0) {
    return 0;
  }
  const thermal = BOLTZMANN_CONSTANT.value * temperatureInKelvin;
  const rotational =
    (structure.linear ? LINEAR_ROTATIONAL_DEGREES : NONLINEAR_ROTATIONAL_DEGREES) * HALF * thermal;
  const vibrational = structure.normalModes.reduce((sum, mode) => {
    const quantum = REDUCED_PLANCK_CONSTANT.value * mode.angularFrequencyInRadiansPerSecond;
    return sum + quantum / Math.expm1(quantum / thermal);
  }, 0);
  return rotational + vibrational;
}

export function temperatureForEnergy(
  structure: MolecularStructure,
  energyInJoules: number,
): number {
  if (energyInJoules <= 0) {
    return 0;
  }
  let low = 0;
  let high = HIGHEST_TEMPERATURE_IN_KELVIN;
  for (let step = 0; step < TEMPERATURE_SEARCH_STEPS; step += 1) {
    const middle = (low + high) / 2;
    if (internalEnergyInJoules(structure, middle) < energyInJoules) {
      low = middle;
    } else {
      high = middle;
    }
  }
  return (low + high) / 2;
}

export function meanVibrationalQuanta(
  structure: MolecularStructure,
  temperatureInKelvin: number,
): number[] {
  return structure.normalModes.map((mode) => {
    if (temperatureInKelvin <= 0) {
      return 0;
    }
    const ratio =
      (REDUCED_PLANCK_CONSTANT.value * mode.angularFrequencyInRadiansPerSecond) /
      (BOLTZMANN_CONSTANT.value * temperatureInKelvin);
    return 1 / Math.expm1(ratio);
  });
}

function reducedMassInKilograms(
  structure: MolecularStructure,
  first: number,
  second: number,
): number {
  const firstMass = structure.atoms[first]?.massInAtomicMassUnits ?? 1;
  const secondMass = structure.atoms[second]?.massInAtomicMassUnits ?? 1;
  return ((firstMass * secondMass) / (firstMass + secondMass)) * ATOMIC_MASS_CONSTANT.value;
}

export function bondAttemptFrequencyInHertz(
  structure: MolecularStructure,
  bondIndex: number,
): number {
  const bond = structure.bonds[bondIndex];
  if (bond === undefined) {
    return 0;
  }
  const stiffness = bond.forceConstantInKcalPerMolePerSquareAngstrom * UFF_STIFFNESS_TO_SI;
  return (
    Math.sqrt(stiffness / reducedMassInKilograms(structure, bond.first, bond.second)) /
    (2 * Math.PI)
  );
}

export function bondDissociationRatesPerSecond(
  structure: MolecularStructure,
  temperatureInKelvin: number,
): number[] {
  return structure.bonds.map((bond, bondIndex) => {
    if (temperatureInKelvin <= 0) {
      return 0;
    }
    return (
      bondAttemptFrequencyInHertz(structure, bondIndex) *
      Math.exp(
        -bond.dissociationEnergyInEv /
          (BOLTZMANN_CONSTANT_IN_EV_PER_KELVIN.value * temperatureInKelvin),
      )
    );
  });
}

export function fragmentsAfterBreaking(
  name: ParticleName,
  brokenBonds: readonly number[],
): ParticleName[] {
  const structure = moleculeStructureOf(name);
  const kept = structure.bonds.filter((unused, index) => !brokenBonds.includes(index));
  const component = new Array<number>(structure.atoms.length).fill(-1);
  let groups = 0;
  structure.atoms.forEach((unused, start) => {
    if ((component[start] ?? -1) >= 0) {
      return;
    }
    const stack = [start];
    component[start] = groups;
    while (stack.length > 0) {
      const atom = stack.pop() ?? 0;
      kept.forEach((bond) => {
        const other = bond.first === atom ? bond.second : bond.second === atom ? bond.first : -1;
        if (other >= 0 && (component[other] ?? -1) < 0) {
          component[other] = groups;
          stack.push(other);
        }
      });
    }
    groups += 1;
  });
  return Array.from({ length: groups }, (unused, group) => {
    const members = structure.atoms
      .map((atom, index) => ({ atom, index }))
      .filter((entry) => component[entry.index] === group);
    if (members.length === 1) {
      const only = members[0];
      return atomName(
        only?.atom.protons ?? 1,
        only?.atom.massNumber ?? 1,
        formalChargeOf(structure, only?.index ?? 0),
      );
    }
    const renumber = new Map(members.map((entry, position) => [entry.index, position]));
    return moleculeName({
      atoms: members.map((entry) => entry.atom),
      bonds: kept
        .filter((bond) => renumber.has(bond.first) && renumber.has(bond.second))
        .map((bond) => ({
          first: renumber.get(bond.first) ?? 0,
          second: renumber.get(bond.second) ?? 0,
          order: bond.order,
        })),
      charges: (structure.charges ?? []).flatMap((entry) => {
        const atom = renumber.get(entry.atom);
        return atom === undefined ? [] : [{ atom, charge: entry.charge }];
      }),
    });
  });
}

export function relaxedTemperature(
  current: number,
  target: number,
  ratePerSecond: number,
  durationInSeconds: number,
): number {
  return target + (current - target) * Math.exp(-ratePerSecond * durationInSeconds);
}

export function moleculeMassInKilograms(structure: MolecularStructure): number {
  return structure.massInAtomicMassUnits * ATOMIC_MASS_CONSTANT.value;
}

export function partnerMassInKilograms(species: ParticleName): number {
  return gevToAtomicMassUnits(restMassInGev(species)) * ATOMIC_MASS_CONSTANT.value;
}

function collisionRatePerSecond(
  structure: MolecularStructure,
  medium: MediumAspect,
  temperatureInKelvin: number,
  crossSectionOf: (component: MediumComponent) => number,
): number {
  const molecule = moleculeMassInKilograms(structure);
  return medium.components.reduce((sum, component) => {
    const other = partnerMassInKilograms(component.species);
    const reduced = (molecule * other) / (molecule + other);
    const relativeSpeed = Math.sqrt(
      (8 * BOLTZMANN_CONSTANT.value * Math.max(temperatureInKelvin, 0)) / (Math.PI * reduced),
    );
    return sum + component.numberDensityPerCubicMeter * crossSectionOf(component) * relativeSpeed;
  }, 0);
}

export function moleculeCollisionRatePerSecond(
  structure: MolecularStructure,
  medium: MediumAspect,
  temperatureInKelvin: number,
): number {
  return collisionRatePerSecond(
    structure,
    medium,
    temperatureInKelvin,
    (component) => component.crossSectionInSquareMeters,
  );
}

export function heatExchangeRatePerSecond(
  structure: MolecularStructure,
  medium: MediumAspect,
  temperatureInKelvin: number,
): number {
  return collisionRatePerSecond(structure, medium, temperatureInKelvin, (component) =>
    collisionCrossSectionInSquareMeters(structure.name, component),
  );
}

export function collisionCrossSectionInSquareMeters(
  species: ParticleName,
  component: MediumComponent,
): number {
  if (component.crossSectionInSquareMeters > 0) {
    return component.crossSectionInSquareMeters;
  }
  const own = lennardJonesDiameterInMeters(species);
  const partner = lennardJonesDiameterInMeters(component.species);
  return own === null || partner === null ? 0 : Math.PI * ((own + partner) * HALF) ** 2;
}

export interface RadiationHeating {
  readonly rotationalWatts: number;
  readonly vibrationalWatts: number;
}

export function absorbedPower(
  structure: MolecularStructure,
  angularFrequency: number,
  intensityInWattsPerSquareMeter: number,
  temperatureInKelvin: number,
  collisionRate: number,
): RadiationHeating {
  const thermal = BOLTZMANN_CONSTANT.value * Math.max(temperatureInKelvin, 1);
  const fieldSquared =
    intensityInWattsPerSquareMeter /
    (SPEED_OF_LIGHT_IN_VACUUM.value * VACUUM_ELECTRIC_PERMITTIVITY.value);
  const relaxation = collisionRate > 0 ? 1 / collisionRate : Number.POSITIVE_INFINITY;
  const debye = Number.isFinite(relaxation)
    ? (angularFrequency ** 2 * relaxation) / (1 + (angularFrequency * relaxation) ** 2)
    : 0;
  const rotationalWatts =
    ((structure.dipoleMomentInCoulombMeters ** 2 * fieldSquared) / (3 * thermal)) * debye;
  const massEnergy = moleculeMassInKilograms(structure) * SPEED_OF_LIGHT_IN_VACUUM.value ** 2;
  const vibrationalWatts = structure.normalModes.reduce((sum, mode) => {
    const center = mode.angularFrequencyInRadiansPerSecond;
    const radiative =
      (center ** 2 * mode.infraredStrengthInSquareMetersPerSecond) /
      (Math.PI ** 2 * SPEED_OF_LIGHT_IN_VACUUM.value ** 2);
    const doppler = center * Math.sqrt((DOPPLER_FACTOR * thermal) / massEnergy);
    const halfWidth = Math.max(radiative / 2, doppler, collisionRate / 2);
    const profile = halfWidth / Math.PI / ((angularFrequency - center) ** 2 + halfWidth ** 2);
    return (
      sum + mode.infraredStrengthInSquareMetersPerSecond * profile * intensityInWattsPerSquareMeter
    );
  }, 0);
  return { rotationalWatts, vibrationalWatts };
}

export function heatedTemperature(
  structure: MolecularStructure,
  startInKelvin: number,
  durationInSeconds: number,
  power: (temperatureInKelvin: number) => number,
): number {
  const startEnergy = internalEnergyInJoules(structure, startInKelvin);
  const scale = Math.max(startEnergy, BOLTZMANN_CONSTANT.value);
  if (power(startInKelvin) * durationInSeconds < NEGLIGIBLE_HEATING_FRACTION * scale) {
    return startInKelvin;
  }
  let temperature = startInKelvin;
  const step = durationInSeconds / HEATING_SUBSTEPS;
  for (let index = 0; index < HEATING_SUBSTEPS; index += 1) {
    const energy = internalEnergyInJoules(structure, temperature) + power(temperature) * step;
    temperature = temperatureForEnergy(structure, energy);
  }
  return temperature;
}
