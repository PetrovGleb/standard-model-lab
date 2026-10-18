/* Unit conversions between natural units (GeV) and SI or particle-physics units, built only from exact CODATA factors. */
import {
  ATOMIC_MASS_UNIT_IN_MEV,
  ELECTRON_VOLT_TO_KILOGRAM_RELATIONSHIP,
  ELEMENTARY_CHARGE,
  PLANCK_CONSTANT_IN_EV_PER_HERTZ,
  REDUCED_PLANCK_CONSTANT_IN_EV_SECOND,
  SPEED_OF_LIGHT,
} from '@standard-model/constants';

export const GEV_PER_MEV = 1e-3;
export const MEV_PER_GEV = 1e3;
export const EV_PER_GEV = 1e9;
export const NANOMETERS_PER_METER = 1e9;
export const METERS_PER_FEMTOMETER = 1e-15;
export const FEMTOMETERS_PER_METER = 1e15;

const PLANCK_CONSTANT_TIMES_SPEED_OF_LIGHT_IN_EV_NANOMETERS =
  PLANCK_CONSTANT_IN_EV_PER_HERTZ.value * SPEED_OF_LIGHT.value * NANOMETERS_PER_METER;

export function mevToGev(energyInMev: number): number {
  return energyInMev * GEV_PER_MEV;
}

export function gevToMev(energyInGev: number): number {
  return energyInGev * MEV_PER_GEV;
}

export function gevToKilograms(massInGev: number): number {
  return massInGev * EV_PER_GEV * ELECTRON_VOLT_TO_KILOGRAM_RELATIONSHIP.value;
}

export function gevToAtomicMassUnits(massInGev: number): number {
  return gevToMev(massInGev) / ATOMIC_MASS_UNIT_IN_MEV.value;
}

export function photonWavelengthInNanometers(photonEnergyInEv: number): number {
  return PLANCK_CONSTANT_TIMES_SPEED_OF_LIGHT_IN_EV_NANOMETERS / photonEnergyInEv;
}

export function widthInGevToMeanLifeInSeconds(widthInGev: number): number {
  return REDUCED_PLANCK_CONSTANT_IN_EV_SECOND.value / (widthInGev * EV_PER_GEV);
}

export function meanLifeInSecondsToWidthInGev(meanLifeInSeconds: number): number {
  return REDUCED_PLANCK_CONSTANT_IN_EV_SECOND.value / (meanLifeInSeconds * EV_PER_GEV);
}

export function meanLifeToHalfLife(meanLife: number): number {
  return meanLife * Math.LN2;
}

export function decayLengthInMeters(meanLifeInSeconds: number): number {
  return meanLifeInSeconds * SPEED_OF_LIGHT.value;
}

export function momentumSiToGev(momentumInKilogramMetersPerSecond: number): number {
  const momentumTimesLightInJoules = momentumInKilogramMetersPerSecond * SPEED_OF_LIGHT.value;
  return momentumTimesLightInJoules / ELEMENTARY_CHARGE.value / EV_PER_GEV;
}

export function angularFrequencyToEnergyInEv(angularFrequencyInRadiansPerSecond: number): number {
  return REDUCED_PLANCK_CONSTANT_IN_EV_SECOND.value * angularFrequencyInRadiansPerSecond;
}

export function energyInEvToAngularFrequency(energyInEv: number): number {
  return energyInEv / REDUCED_PLANCK_CONSTANT_IN_EV_SECOND.value;
}
