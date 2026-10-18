/* A medium of finite size fills a ball of diameter thicknessInMeters around the origin: its volume, its heat capacity (Dulong–Petit 3k per atom when condensed, 3/2 k plus rotations and Einstein
   vibrations of each molecule in a gas or plasma), heating by absorbed energy, the photon attenuation coefficient from photoionization and Compton cross sections of its components, the Bethe
   stopping power and range of charged particles with the Bloch mean excitation energy, and the distance from a point to the edge of the ball along a direction. */
import {
  BOLTZMANN_CONSTANT,
  CLASSICAL_ELECTRON_RADIUS,
  ELECTRON_MASS_ENERGY_EQUIVALENT_IN_MEV,
  ionizationEnergyInEv,
  matterIdentity,
  moleculeStructureOf,
  particleSpec,
} from '@standard-model/constants';
import type {
  MediumAspect,
  MediumComponent,
  ParticleName,
  Vector3,
} from '@standard-model/contracts';
import { EV_PER_GEV } from '@standard-model/utils';
import { internalEnergyInJoules } from '../molecules/molecular-behaviour.js';
import { molecularStructure } from '../molecules/molecular-structure.js';
import {
  comptonCrossSectionInSquareMeters,
  photoionizationCrossSectionInSquareMeters,
} from '../radiation/photon-absorption.js';
import { aggregateState, idealGasPressureInPascals } from './aggregate-state.js';

const BALL_VOLUME_FACTOR = Math.PI / 6;
const HALF = 0.5;
const CONDENSED_DEGREES_PER_ATOM = 3;
const TRANSLATIONAL_DEGREES = 1.5;
const HEATING_SUBSTEPS = 32;
const TEMPERATURE_STEP_FRACTION = 1e-3;
const BLOCH_EXCITATION_PER_PROTON_IN_EV = 10;
const EV_PER_MEV = 1e6;
const METERS_PER_FEMTOMETER = 1e-15;
const RANGE_STEPS = 200;
const RELATIVE_PRECISION = 1e-9;

export function mediumVolumeInCubicMeters(medium: MediumAspect): number | null {
  const thickness = medium.thicknessInMeters;
  return thickness === undefined || !(thickness > 0) ? null : BALL_VOLUME_FACTOR * thickness ** 3;
}

interface Composition {
  readonly atoms: readonly number[];
  readonly molecule: boolean;
}

function compositionOf(species: ParticleName): Composition {
  if (species.startsWith('molecule:')) {
    return {
      atoms: moleculeStructureOf(species).atoms.map((atom) => atom.protons),
      molecule: true,
    };
  }
  const identity = matterIdentity(species);
  return { atoms: identity === null ? [] : [identity.protons], molecule: false };
}

function electronsOf(species: ParticleName): number {
  const spec = particleSpec(species);
  return spec.leptonNumbers.electron > 0 && spec.family !== 'chargedLepton'
    ? spec.leptonNumbers.electron
    : species === 'electron'
      ? 1
      : 0;
}

function particleHeatCapacityInJoulesPerKelvin(
  component: MediumComponent,
  temperatureInKelvin: number,
  pressureInPascals: number,
): number {
  const { atoms, molecule } = compositionOf(component.species);
  const phase = aggregateState(component.species, temperatureInKelvin, pressureInPascals).phase;
  if ((phase === 'solid' || phase === 'liquid') && atoms.length > 0) {
    return CONDENSED_DEGREES_PER_ATOM * atoms.length * BOLTZMANN_CONSTANT.value;
  }
  const translational = TRANSLATIONAL_DEGREES * BOLTZMANN_CONSTANT.value;
  if (!molecule) {
    return translational;
  }
  const structure = molecularStructure(component.species);
  const step = Math.max(temperatureInKelvin * TEMPERATURE_STEP_FRACTION, TEMPERATURE_STEP_FRACTION);
  return (
    translational +
    (internalEnergyInJoules(structure, temperatureInKelvin + step) -
      internalEnergyInJoules(structure, Math.max(temperatureInKelvin - step, 0))) /
      (temperatureInKelvin + step - Math.max(temperatureInKelvin - step, 0))
  );
}

export function mediumHeatCapacityInJoulesPerKelvin(medium: MediumAspect): number | null {
  const volume = mediumVolumeInCubicMeters(medium);
  if (volume === null) {
    return null;
  }
  const pressure =
    medium.pressureInPascals ??
    idealGasPressureInPascals(medium.components, medium.temperatureInKelvin);
  return medium.components.reduce(
    (sum, component) =>
      sum +
      component.numberDensityPerCubicMeter *
        volume *
        particleHeatCapacityInJoulesPerKelvin(component, medium.temperatureInKelvin, pressure),
    0,
  );
}

export function heatedMedium(medium: MediumAspect, energyInJoules: number): MediumAspect {
  if (mediumVolumeInCubicMeters(medium) === null || !(energyInJoules > 0)) {
    return medium;
  }
  const idealBefore = idealGasPressureInPascals(medium.components, medium.temperatureInKelvin);
  const followsIdealGas =
    medium.pressureInPascals === undefined ||
    Math.abs(medium.pressureInPascals - idealBefore) <= RELATIVE_PRECISION * idealBefore;
  let temperature = medium.temperatureInKelvin;
  for (let step = 0; step < HEATING_SUBSTEPS; step += 1) {
    const capacity =
      mediumHeatCapacityInJoulesPerKelvin({ ...medium, temperatureInKelvin: temperature }) ?? 0;
    temperature += capacity > 0 ? energyInJoules / HEATING_SUBSTEPS / capacity : 0;
  }
  const idealAfter = idealGasPressureInPascals(medium.components, temperature);
  return {
    ...medium,
    temperatureInKelvin: temperature,
    ...(followsIdealGas
      ? { pressureInPascals: idealAfter }
      : { pressureInPascals: Math.max(medium.pressureInPascals ?? 0, idealAfter) }),
    absorbedEnergyInJoules: (medium.absorbedEnergyInJoules ?? 0) + energyInJoules,
  };
}

export function photonCrossSectionInSquareMeters(
  species: ParticleName,
  photonEnergyInEv: number,
): number {
  const { atoms } = compositionOf(species);
  const photoelectric = atoms.reduce((sum, protons) => {
    const binding = ionizationEnergyInEv(protons, 0);
    return binding === null
      ? sum
      : sum +
          photoionizationCrossSectionInSquareMeters(protons, protons, photonEnergyInEv, binding);
  }, 0);
  return photoelectric + electronsOf(species) * comptonCrossSectionInSquareMeters(photonEnergyInEv);
}

export function photonAttenuationPerMeter(medium: MediumAspect, photonEnergyInEv: number): number {
  return medium.components.reduce(
    (sum, component) =>
      sum +
      component.numberDensityPerCubicMeter *
        photonCrossSectionInSquareMeters(component.species, photonEnergyInEv),
    0,
  );
}

function electronDensityPerCubicMeter(medium: MediumAspect): number {
  return medium.components.reduce(
    (sum, component) => sum + component.numberDensityPerCubicMeter * electronsOf(component.species),
    0,
  );
}

function meanExcitationInEv(medium: MediumAspect): number {
  const weights = medium.components.flatMap((component) =>
    compositionOf(component.species).atoms.map((protons) => ({
      electrons: protons * component.numberDensityPerCubicMeter,
      logarithm: Math.log(BLOCH_EXCITATION_PER_PROTON_IN_EV * protons),
    })),
  );
  const total = weights.reduce((sum, weight) => sum + weight.electrons, 0);
  return total > 0
    ? Math.exp(
        weights.reduce((sum, weight) => sum + weight.electrons * weight.logarithm, 0) / total,
      )
    : BLOCH_EXCITATION_PER_PROTON_IN_EV;
}

export function stoppingPowerInEvPerMeter(
  medium: MediumAspect,
  chargeInElementaryUnits: number,
  massInGev: number,
  kineticEnergyInEv: number,
): number {
  const restInEv = massInGev * EV_PER_GEV;
  const lorentzFactor = 1 + kineticEnergyInEv / restInEv;
  const betaSquared = 1 - 1 / lorentzFactor ** 2;
  const electronRestInEv = ELECTRON_MASS_ENERGY_EQUIVALENT_IN_MEV.value * EV_PER_MEV;
  const logarithm = Math.log(
    (2 * electronRestInEv * betaSquared * lorentzFactor ** 2) / meanExcitationInEv(medium),
  );
  if (!(betaSquared > 0) || logarithm <= betaSquared) {
    return 0;
  }
  return (
    (4 *
      Math.PI *
      electronDensityPerCubicMeter(medium) *
      chargeInElementaryUnits ** 2 *
      CLASSICAL_ELECTRON_RADIUS.value ** 2 *
      electronRestInEv *
      (logarithm - betaSquared)) /
    betaSquared
  );
}

export function rangeInMeters(
  medium: MediumAspect,
  chargeInElementaryUnits: number,
  massInGev: number,
  kineticEnergyInEv: number,
): number {
  if (chargeInElementaryUnits === 0 || !(kineticEnergyInEv > 0)) {
    return Number.POSITIVE_INFINITY;
  }
  const floor = meanExcitationInEv(medium);
  if (kineticEnergyInEv <= floor) {
    return 0;
  }
  const ratio = (kineticEnergyInEv / floor) ** (1 / RANGE_STEPS);
  let range = 0;
  let lower = floor;
  for (let step = 0; step < RANGE_STEPS; step += 1) {
    const upper = lower * ratio;
    const middle = Math.sqrt(lower * upper);
    const stopping = stoppingPowerInEvPerMeter(medium, chargeInElementaryUnits, massInGev, middle);
    range += stopping > 0 ? (upper - lower) / stopping : 0;
    lower = upper;
  }
  return range;
}

export function energyAfterPathInEv(
  medium: MediumAspect,
  chargeInElementaryUnits: number,
  massInGev: number,
  kineticEnergyInEv: number,
  pathInMeters: number,
): number {
  const total = rangeInMeters(medium, chargeInElementaryUnits, massInGev, kineticEnergyInEv);
  if (!(total > pathInMeters)) {
    return 0;
  }
  let low = 0;
  let high = kineticEnergyInEv;
  for (let step = 0; step < RANGE_STEPS; step += 1) {
    const middle = HALF * (low + high);
    if (rangeInMeters(medium, chargeInElementaryUnits, massInGev, middle) < total - pathInMeters) {
      low = middle;
    } else {
      high = middle;
    }
  }
  return HALF * (low + high);
}

export function distanceToEdgeInMeters(
  medium: MediumAspect,
  positionInFemtometers: Vector3,
  direction: Vector3,
): number {
  const thickness = medium.thicknessInMeters;
  if (thickness === undefined) {
    return Number.POSITIVE_INFINITY;
  }
  const radius = HALF * thickness;
  const position = {
    x: positionInFemtometers.x * METERS_PER_FEMTOMETER,
    y: positionInFemtometers.y * METERS_PER_FEMTOMETER,
    z: positionInFemtometers.z * METERS_PER_FEMTOMETER,
  };
  const length = Math.hypot(direction.x, direction.y, direction.z);
  const unit =
    length > 0
      ? { x: direction.x / length, y: direction.y / length, z: direction.z / length }
      : { x: 0, y: 0, z: 1 };
  const along = position.x * unit.x + position.y * unit.y + position.z * unit.z;
  const squared = position.x ** 2 + position.y ** 2 + position.z ** 2;
  const discriminant = along ** 2 - (squared - radius ** 2);
  return discriminant < 0 ? 0 : Math.max(0, -along + Math.sqrt(discriminant));
}
