/* Checks light nuclei, fusion and atoms: Gamow constants and D–T reactivity against Bosch–Hale, hydrogen binding against NIST, Kramers photoionization at threshold, conservation in nuclear and atomic collisions, and the fusion rate of a test nucleus in a hot medium at 5 sigma. */
import {
  BOHR_RADIUS,
  BOLTZMANN_CONSTANT_IN_EV_PER_KELVIN,
  FINE_STRUCTURE_CONSTANT,
  NUCLEAR_DATA,
  PARTICLE_CATALOG,
  RYDBERG_CONSTANT_TIMES_PLANCK_CONSTANT_TIMES_SPEED_OF_LIGHT_IN_EV,
  particleSpec,
} from '@standard-model/constants';
import type { ParticleName } from '@standard-model/contracts';
import {
  binomialStandardError,
  DEFAULT_MONTE_CARLO_SHOTS,
  DEFAULT_SIGMA_MULTIPLIER,
} from '@standard-model/utils';
import { describe, expect, it } from 'vitest';
import {
  bindingEnergyInEv,
  createEngine,
  experiment,
  gamowConstantInSqrtKev,
  reactionChannels,
  reactivityInCubicMetersPerSecond,
  runExperiment,
} from '../src/index.js';

const SEED = 20261016;
const EXACT_DIGITS = 9;
const BOSCH_HALE_GAMOW_DEUTERIUM_TRITIUM = 34.3827;
const BOSCH_HALE_REACTIVITY_AT_TEN_KEV = 1.136e-22;
const REACTIVITY_TOLERANCE = 0.02;
const NIST_RELATIVISTIC_AND_QED_SHIFT_IN_EV = 2e-4;
const KELVIN_PER_KEV = 1e3 / BOLTZMANN_CONSTANT_IN_EV_PER_KELVIN.value;
const SQUARE_METERS_PER_BARN = 1e-28;
const KRAMERS_THRESHOLD_FACTOR = 64 / (3 * Math.sqrt(3));
const BARN_PER_NANOBARN = 1e-9;
const COLLISION_SHOTS = 200;
const KEV_PER_GEV = 1e6;
const GEV_PER_EV = 1e-9;
const NEAR_THRESHOLD_FACTOR = 1.01;
const RYDBERG_IN_EV = RYDBERG_CONSTANT_TIMES_PLANCK_CONSTANT_TIMES_SPEED_OF_LIGHT_IN_EV.value;

function momentumFor(particle: ParticleName, kineticInGev: number): number {
  const mass = particleSpec(particle).massInGev.value;
  return Math.sqrt((kineticInGev + mass) ** 2 - mass * mass);
}

describe('light nuclei and fusion', () => {
  it('builds nuclei and atoms from CODATA masses with charge and baryon number of their parts', () => {
    expect(PARTICLE_CATALOG.deuteron.baryonNumber).toBe(2);
    expect(PARTICLE_CATALOG.alphaParticle.electricChargeInElementaryUnits).toBe(2);
    expect(PARTICLE_CATALOG.heliumAtom.electricChargeInElementaryUnits).toBe(0);
    expect(PARTICLE_CATALOG.tritiumAtom.decays[0]?.products).toEqual([
      'heliumThreeIon',
      'electron',
      'electronAntineutrino',
    ]);
    expect(PARTICLE_CATALOG.antiHydrogenAtom.constituents).toEqual(['antiProton', 'positron']);
  });

  it('computes the Gamow constant from CODATA close to the Bosch–Hale value', () => {
    expect(
      Math.abs(
        gamowConstantInSqrtKev('deuteron', 'triton') / BOSCH_HALE_GAMOW_DEUTERIUM_TRITIUM - 1,
      ),
    ).toBeLessThan(1e-5);
  });

  it('reproduces the Bosch–Hale D–T reactivity at 10 keV within 2%', () => {
    const [channel] = reactionChannels('deuteron', 'triton');
    if (channel === undefined) {
      throw new Error('D–T channel expected');
    }
    const reactivity = reactivityInCubicMetersPerSecond(channel, 10 * KELVIN_PER_KEV);
    expect(Math.abs(reactivity / BOSCH_HALE_REACTIVITY_AT_TEN_KEV - 1)).toBeLessThan(
      REACTIVITY_TOLERANCE,
    );
  });

  it('conserves charge, baryon number and four-momentum in deuteron–triton collisions', () => {
    const engine = createEngine({ seed: SEED });
    for (let shot = 0; shot < COLLISION_SHOTS; shot += 1) {
      const deuteron = engine.particles.create('deuteron', {
        momentumInGev: { x: 0, y: 0, z: momentumFor('deuteron', 100 / KEV_PER_GEV) },
      });
      const triton = engine.particles.create('triton');
      const energyBefore =
        deuteron.kinematics.fourMomentumInGev.energy + triton.kinematics.fourMomentumInGev.energy;
      const event = engine.collisions.collide(deuteron, triton);
      const specs = event.products.map((product) => particleSpec(product.name));
      expect(specs.reduce((sum, spec) => sum + spec.electricChargeInElementaryUnits, 0)).toBe(2);
      expect(specs.reduce((sum, spec) => sum + spec.baryonNumber, 0)).toBe(5);
      const energyAfter = event.products.reduce(
        (sum, product) => sum + product.fourMomentumInGev.energy,
        0,
      );
      expect(energyAfter).toBeCloseTo(energyBefore, EXACT_DIGITS);
    }
  });

  it('fuses a deuteron in a tritium plasma at the rate n⟨σv⟩', () => {
    const densityPerCubicMeter = 1e20;
    const temperatureInKelvin = 15 * KELVIN_PER_KEV;
    const durationInSeconds = 1;
    const [channel] = reactionChannels('deuteron', 'triton');
    if (channel === undefined) {
      throw new Error('D–T channel expected');
    }
    const expected =
      1 -
      Math.exp(
        -densityPerCubicMeter *
          reactivityInCubicMetersPerSecond(channel, temperatureInKelvin) *
          durationInSeconds,
      );
    const plan = experiment('plasma')
      .create('deuteron', 'deuteron')
      .influence('setMedium', {
        species: 'triton',
        numberDensityPerCubicMeter: densityPerCubicMeter,
        temperatureInKelvin,
        crossSectionInSquareMeters: 0,
      })
      .evolve(durationInSeconds)
      .measureSystem('system')
      .report('frequency', ['system'], 'system')
      .build();
    const observed =
      runExperiment(plan, {
        shots: DEFAULT_MONTE_CARLO_SHOTS,
        seed: SEED,
        includeSystemReport: false,
      }).reportValues['system[alphaParticle+neutron]'] ?? 0;
    expect(Math.abs(observed - expected)).toBeLessThan(
      DEFAULT_SIGMA_MULTIPLIER * binomialStandardError(expected, DEFAULT_MONTE_CARLO_SHOTS),
    );
  });
});

describe('atoms', () => {
  it('binds hydrogen within the relativistic and QED shift of the NIST ionization energy', () => {
    expect(
      Math.abs(
        bindingEnergyInEv('hydrogenAtom') - NUCLEAR_DATA.ionizationEnergiesInEv.hydrogen.value,
      ),
    ).toBeLessThan(NIST_RELATIVISTIC_AND_QED_SHIFT_IN_EV);
    expect(bindingEnergyInEv('heliumAtom')).toBeCloseTo(
      NUCLEAR_DATA.ionizationEnergiesInEv.heliumNeutral.value,
      6,
    );
  });

  it('photoionizes hydrogen near threshold with the Kramers cross section', () => {
    const engine = createEngine({ seed: SEED });
    const threshold = bindingEnergyInEv('hydrogenAtom');
    const photonEnergyInEv = threshold * NEAR_THRESHOLD_FACTOR;
    const atom = engine.particles.create('hydrogenAtom');
    const photon = engine.particles.create('photon', {
      momentumInGev: { x: 0, y: 0, z: photonEnergyInEv * GEV_PER_EV },
    });
    const event = engine.collisions.collide(atom, photon, 'proton+electron');
    const atomMass = PARTICLE_CATALOG.hydrogenAtom.massInGev.value;
    const centerOfMassPhotonInEv = photonEnergyInEv * (atomMass / event.centerOfMassEnergyInGev);
    const expected =
      ((KRAMERS_THRESHOLD_FACTOR *
        Math.PI *
        FINE_STRUCTURE_CONSTANT.value *
        BOHR_RADIUS.value ** 2) /
        SQUARE_METERS_PER_BARN) *
      (threshold / centerOfMassPhotonInEv) ** 3 *
      (RYDBERG_IN_EV / threshold);
    const crossSection = event.channelCrossSectionsInNanobarns['proton+electron'] ?? 0;
    expect(Math.abs((crossSection * BARN_PER_NANOBARN) / expected - 1)).toBeLessThan(1e-6);
  });

  it('recombines an antiproton and a positron into antihydrogen with exact conservation', () => {
    const engine = createEngine({ seed: SEED });
    const antiproton = engine.particles.create('antiProton');
    const positron = engine.particles.create('positron', {
      momentumInGev: { x: 0, y: 0, z: momentumFor('positron', GEV_PER_EV) },
    });
    const energyBefore =
      antiproton.kinematics.fourMomentumInGev.energy + positron.kinematics.fourMomentumInGev.energy;
    const event = engine.collisions.collide(antiproton, positron, 'antiHydrogenAtom+photon');
    expect(event.products.map((product) => product.name)).toEqual(['antiHydrogenAtom', 'photon']);
    const energyAfter = event.products.reduce(
      (sum, product) => sum + product.fourMomentumInGev.energy,
      0,
    );
    expect(energyAfter).toBeCloseTo(energyBefore, 12);
  });
});
