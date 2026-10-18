/* Thermal helpers: Boltzmann weights in electron volts and the mean speed of a Maxwell-Boltzmann gas. */
import { BOLTZMANN_CONSTANT, BOLTZMANN_CONSTANT_IN_EV_PER_KELVIN } from '@standard-model/constants';

export function boltzmannWeight(energyInEv: number, temperatureInKelvin: number): number {
  if (temperatureInKelvin <= 0) {
    throw new Error('Boltzmann weights need a positive temperature');
  }
  return Math.exp(-energyInEv / (BOLTZMANN_CONSTANT_IN_EV_PER_KELVIN.value * temperatureInKelvin));
}

export function thermalMeanSpeedInMetersPerSecond(
  massInKilograms: number,
  temperatureInKelvin: number,
): number {
  return Math.sqrt(
    (8 * BOLTZMANN_CONSTANT.value * temperatureInKelvin) / (Math.PI * massInKilograms),
  );
}
