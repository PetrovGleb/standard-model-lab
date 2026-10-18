/* Checks a medium of finite size: the ball volume, Dulong–Petit heat capacity of liquid water (9k per molecule) and heating by ΔT = E/C, photons leaving a lead ball with probability exp(−μ·r) at
   5 sigma, the Bethe range of a 5 MeV alpha in water against the NIST ASTAR CSDA range within 30%, and an X-ray beam leaving P·t·(1 − exp(−μ·d)) in a water ball. */
import { BOLTZMANN_CONSTANT, particleSpec } from '@standard-model/constants';
import type { MediumAspect, ParticleName } from '@standard-model/contracts';
import { statisticalTolerance } from '@standard-model/utils';
import { describe, expect, it } from 'vitest';
import {
  EXPERIMENT_TEMPLATES,
  heatedMedium,
  mediumHeatCapacityInJoulesPerKelvin,
  mediumVolumeInCubicMeters,
  photonAttenuationPerMeter,
  rangeInMeters,
  runExperiment,
} from '../src/index.js';

const WATER: ParticleName = 'molecule:8-16,1-1,1-1;0-1-1,0-2-1';
const WATER_DENSITY = 3.34e28;
const LEAD_DENSITY = 3.3e28;
const DIAMETER_IN_METERS = 0.01;
const ROOM_TEMPERATURE_IN_KELVIN = 293;
const ATMOSPHERE_IN_PASCALS = 101325;
const DEGREES_PER_WATER_MOLECULE = 9;
const SMALL_ENERGY_IN_JOULES = 1;
const PRECISION = 1e-9;
const SHOTS = 2000;
const PHOTONS = 100;
const GAMMA_ENERGY_IN_EV = 1e6;
const ALPHA_KINETIC_ENERGY_IN_EV = 5e6;
const ASTAR_RANGE_IN_METERS = 3.623e-5;
const RANGE_TOLERANCE = 0.3;
const XRAY_ENERGY_IN_EV = 1e4;
const XRAY_POWER_IN_WATTS = 100;

function ball(species: ParticleName, density: number, diameter: number): MediumAspect {
  return {
    components: [{ species, numberDensityPerCubicMeter: density, crossSectionInSquareMeters: 0 }],
    temperatureInKelvin: ROOM_TEMPERATURE_IN_KELVIN,
    pressureInPascals: ATMOSPHERE_IN_PASCALS,
    bulkVelocityInMetersPerSecond: { x: 0, y: 0, z: 0 },
    reactionMode: 'oneReactionPerStep',
    thicknessInMeters: diameter,
  };
}

function template(name: string) {
  const plan = EXPERIMENT_TEMPLATES[name];
  if (plan === undefined) {
    throw new Error(`${name} template expected`);
  }
  return plan;
}

describe('a medium of finite size', () => {
  const water = ball(WATER, WATER_DENSITY, DIAMETER_IN_METERS);

  it('fills a ball, holds 9k per liquid water molecule and warms by E/C', () => {
    const volume = (Math.PI / 6) * DIAMETER_IN_METERS ** 3;
    expect(mediumVolumeInCubicMeters(water)).toBeCloseTo(volume, 18);
    const capacity = DEGREES_PER_WATER_MOLECULE * BOLTZMANN_CONSTANT.value * WATER_DENSITY * volume;
    expect(Math.abs((mediumHeatCapacityInJoulesPerKelvin(water) ?? 0) / capacity - 1)).toBeLessThan(
      1e-12,
    );
    const warmed = heatedMedium(water, SMALL_ENERGY_IN_JOULES);
    expect(
      Math.abs(
        (warmed.temperatureInKelvin - ROOM_TEMPERATURE_IN_KELVIN) /
          (SMALL_ENERGY_IN_JOULES / capacity) -
          1,
      ),
    ).toBeLessThan(PRECISION);
    expect(warmed.absorbedEnergyInJoules).toBe(SMALL_ENERGY_IN_JOULES);
  });

  it('stops a 5 MeV alpha in water near the ASTAR range', () => {
    const helium = particleSpec('alphaParticle');
    const range = rangeInMeters(
      water,
      helium.electricChargeInElementaryUnits,
      helium.massInGev.value,
      ALPHA_KINETIC_ENERGY_IN_EV,
    );
    expect(Math.abs(range / ASTAR_RANGE_IN_METERS - 1)).toBeLessThan(RANGE_TOLERANCE);
  });

  it('lets gamma photons out of a lead ball with probability exp(−μ·r), Monte Carlo', () => {
    const lead = ball('atom:82:208:0', LEAD_DENSITY, 2 * DIAMETER_IN_METERS);
    const survival = Math.exp(
      -photonAttenuationPerMeter(lead, GAMMA_ENERGY_IN_EV) * DIAMETER_IN_METERS,
    );
    const values = runExperiment(template('gammaShield'), {
      shots: SHOTS,
      includeSystemReport: false,
    }).reportValues;
    const observed = (values['Квантов вылетело из шара'] ?? 0) / PHOTONS;
    expect(Math.abs(observed - survival)).toBeLessThanOrEqual(
      statisticalTolerance(survival, SHOTS * PHOTONS),
    );
  });

  it('leaves P·t·(1 − exp(−μ·d)) of an X-ray beam in a water ball', () => {
    const absorbed =
      XRAY_POWER_IN_WATTS *
      -Math.expm1(-photonAttenuationPerMeter(water, XRAY_ENERGY_IN_EV) * DIAMETER_IN_METERS);
    const values = runExperiment(template('xrayHeatsWater'), {
      shots: 1,
      includeSystemReport: false,
    }).reportValues;
    expect(Math.abs((values['Поглощенная энергия, Дж'] ?? 0) / absorbed - 1)).toBeLessThan(1e-9);
    expect(values['Температура воды после, К']).toBeGreaterThan(ROOM_TEMPERATURE_IN_KELVIN);
  });
});
