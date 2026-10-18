/* Checks meson hadronization: exact flavour-mixing weights, Lund strings that conserve four-momentum, charge and heavy flavour with hadrons on their mass shell, meson species at 5 sigma, spectator decays of B mesons and the cascade that leaves only long-lived particles. */
import { PARTICLE_CATALOG, STRING_FRAGMENTATION, particleSpec } from '@standard-model/constants';
import type { FourMomentumInGev, ParticleName } from '@standard-model/contracts';
import {
  createRandomSource,
  DEFAULT_MONTE_CARLO_SHOTS,
  frequency,
  invariantMassInGev,
  isWithinTolerance,
  statisticalTolerance,
} from '@standard-model/utils';
import { describe, expect, it } from 'vitest';
import {
  createEngine,
  diagonalMesonWeights,
  experiment,
  runExperiment,
  spectatorChannels,
  StringFragmentation,
} from '../src/index.js';

const SEED = 20261016;
const EXACT_DIGITS = 12;
const STRING_EVENTS = 200;
const DECAY_EVENTS = 200;
const CASCADE_SHOTS = 300;
const RELATIVE_TOLERANCE = 1e-9;
const DETECTOR_TIME_IN_SECONDS = 1e-9;
const PSEUDOSCALAR_SPIN = 0;
const VECTOR_SPIN = 1;
const Z_MASS_IN_GEV = PARTICLE_CATALOG.zBoson.massInGev.value;
const LIGHT_VECTOR_PROBABILITY =
  STRING_FRAGMENTATION.vectorToPseudoscalarRatios.light /
  (1 + STRING_FRAGMENTATION.vectorToPseudoscalarRatios.light);

function sumOf(momenta: readonly FourMomentumInGev[]): FourMomentumInGev {
  return momenta.reduce(
    (total, momentum) => ({
      energy: total.energy + momentum.energy,
      momentum: {
        x: total.momentum.x + momentum.momentum.x,
        y: total.momentum.y + momentum.momentum.y,
        z: total.momentum.z + momentum.momentum.z,
      },
    }),
    { energy: 0, momentum: { x: 0, y: 0, z: 0 } },
  );
}

function backToBack(flavor: ParticleName, energyInGev: number) {
  const half = energyInGev / 2;
  const mass = particleSpec(flavor).massInGev.value;
  const momentum = Math.sqrt(half * half - mass * mass);
  return {
    quark: { flavor, fourMomentumInGev: { energy: half, momentum: { x: 0, y: 0, z: momentum } } },
    antiquark: {
      flavor: particleSpec(flavor).antiparticleName,
      fourMomentumInGev: { energy: half, momentum: { x: 0, y: 0, z: -momentum } },
    },
  };
}

describe('meson hadronization', () => {
  it('mixes u ū, d d̄ and s s̄ into π⁰, η, η′ and ρ⁰, φ, ω with unit total weight', () => {
    (['up', 'down', 'strange'] as const).forEach((flavor) => {
      [PSEUDOSCALAR_SPIN, VECTOR_SPIN].forEach((spin) => {
        const total = diagonalMesonWeights(flavor, spin).reduce(
          (sum, candidate) => sum + candidate.weight,
          0,
        );
        expect(total).toBeCloseTo(1, EXACT_DIGITS);
      });
    });
    expect(diagonalMesonWeights('up', PSEUDOSCALAR_SPIN)[0]?.weight).toBeCloseTo(
      1 / 2,
      EXACT_DIGITS,
    );
    expect(diagonalMesonWeights('strange', VECTOR_SPIN)[0]?.weight).toBeCloseTo(0, EXACT_DIGITS);
  });

  it('breaks strings into on-shell hadrons that conserve four-momentum, charge, baryon number and heavy flavour', () => {
    const fragmentation = new StringFragmentation(createRandomSource(SEED));
    (['up', 'strange', 'charm', 'bottom'] as const).forEach((flavor) => {
      for (let event = 0; event < STRING_EVENTS; event += 1) {
        const hadrons = fragmentation.fragment(backToBack(flavor, Z_MASS_IN_GEV)) ?? [];
        expect(hadrons.length).toBeGreaterThan(1);
        const total = sumOf(hadrons.map((hadron) => hadron.fourMomentumInGev));
        expect(Math.abs(total.energy - Z_MASS_IN_GEV)).toBeLessThan(
          RELATIVE_TOLERANCE * Z_MASS_IN_GEV,
        );
        expect(Math.hypot(total.momentum.x, total.momentum.y, total.momentum.z)).toBeLessThan(
          RELATIVE_TOLERANCE * Z_MASS_IN_GEV,
        );
        const specs = hadrons.map((hadron) => particleSpec(hadron.name));
        expect(specs.every((spec) => spec.family === 'meson' || spec.family === 'baryon')).toBe(
          true,
        );
        expect(specs.reduce((sum, spec) => sum + spec.baryonNumber, 0)).toBeCloseTo(
          0,
          EXACT_DIGITS,
        );
        expect(
          specs.reduce((sum, spec) => sum + spec.electricChargeInElementaryUnits, 0),
        ).toBeCloseTo(0, EXACT_DIGITS);
        expect(specs.reduce((sum, spec) => sum + spec.flavorNumbers.charm, 0)).toBe(0);
        expect(specs.reduce((sum, spec) => sum + spec.flavorNumbers.bottomness, 0)).toBe(0);
        hadrons.forEach((hadron) => {
          expect(
            Math.abs(
              invariantMassInGev(hadron.fourMomentumInGev) -
                particleSpec(hadron.name).massInGev.value,
            ),
          ).toBeLessThan(RELATIVE_TOLERANCE * Z_MASS_IN_GEV);
        });
      }
    });
  });

  it('collapses a light u ū string into π⁰, η and ω at the mixing, spin and suppression odds', () => {
    const fragmentation = new StringFragmentation(createRandomSource(SEED));
    const suppression: Partial<Record<string, number>> = {
      etaMeson: STRING_FRAGMENTATION.etaSuppression,
      etaPrimeMeson: STRING_FRAGMENTATION.etaPrimeSuppression,
    };
    const weights = [
      ...diagonalMesonWeights('up', PSEUDOSCALAR_SPIN).map((candidate) => ({
        ...candidate,
        weight:
          (1 - LIGHT_VECTOR_PROBABILITY) * candidate.weight * (suppression[candidate.name] ?? 1),
      })),
      ...diagonalMesonWeights('up', VECTOR_SPIN).map((candidate) => ({
        ...candidate,
        weight: LIGHT_VECTOR_PROBABILITY * candidate.weight,
      })),
    ];
    const normalization = weights.reduce((sum, candidate) => sum + candidate.weight, 0);
    const counts = new Map<string, number>();
    const string = backToBack('up', 2 * PARTICLE_CATALOG.up.massInGev.value + 1e-6);
    for (let shot = 0; shot < DEFAULT_MONTE_CARLO_SHOTS; shot += 1) {
      const name = fragmentation.collapse(string)?.name ?? 'none';
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    (['pionZero', 'etaMeson', 'omegaMeson'] as const).forEach((name) => {
      const expected =
        (weights.find((candidate) => candidate.name === name)?.weight ?? 0) / normalization;
      const observed = frequency(counts.get(name) ?? 0, DEFAULT_MONTE_CARLO_SHOTS);
      expect(
        isWithinTolerance(
          observed,
          expected,
          statisticalTolerance(expected, DEFAULT_MONTE_CARLO_SHOTS),
        ),
      ).toBe(true);
    });
  });

  it('decays B⁺ through b̄ → c̄ W⁺* into hadrons and leptons that conserve charge', () => {
    const channels = spectatorChannels(PARTICLE_CATALOG.bPlus);
    expect(channels.reduce((sum, channel) => sum + channel.branchingFraction.value, 0)).toBeCloseTo(
      1,
      EXACT_DIGITS,
    );
    expect(channels.every((channel) => channel.products.at(-1) === 'up')).toBe(true);
    const engine = createEngine({ seed: SEED });
    for (let event = 0; event < DECAY_EVENTS; event += 1) {
      const decay = engine.decays.decay(engine.particles.create('bPlus'));
      const specs = decay.products.map((product) => particleSpec(product.name as ParticleName));
      expect(specs.some((spec) => spec.family === 'quark')).toBe(false);
      expect(
        specs.reduce((sum, spec) => sum + spec.electricChargeInElementaryUnits, 0),
      ).toBeCloseTo(1, EXACT_DIGITS);
      expect(specs.reduce((sum, spec) => sum + spec.flavorNumbers.bottomness, 0)).toBe(0);
    }
  });

  it('lets every short-lived hadron of a Z decay decay within a nanosecond and keeps charge zero', () => {
    const beam = Z_MASS_IN_GEV / 2;
    const plan = experiment('zCascade')
      .create('electron', 'electron', { momentumInGev: { x: 0, y: 0, z: beam } })
      .create('positron', 'positron', { momentumInGev: { x: 0, y: 0, z: -beam } })
      .collide(['electron', 'positron'], 'collision', 'bottom+antiBottom')
      .evolve(DETECTOR_TIME_IN_SECONDS)
      .measureSystem('detector')
      .report('frequency', ['detector'], 'detector')
      .report('mean', ['detector.count.pionZero'], 'pionZero')
      .report('mean', ['detector.count.rhoZero'], 'rhoZero')
      .report('mean', ['detector.count.dZero'], 'dZero')
      .report('mean', ['detector.count.bZero'], 'bZero')
      .report('mean', ['detector.count.pionPlus'], 'pionPlus')
      .build();
    const result = runExperiment(plan, { shots: CASCADE_SHOTS, seed: SEED });
    expect(result.reportValues['pionZero']).toBe(0);
    expect(result.reportValues['rhoZero']).toBe(0);
    expect(result.reportValues['dZero']).toBe(0);
    expect(result.reportValues['bZero']).toBe(0);
    expect(result.reportValues['pionPlus'] ?? 0).toBeGreaterThan(1);
    const frames = result.systemReport?.frames ?? [];
    expect(frames.at(-1)?.totals.chargeInElementaryUnits).toBeCloseTo(0, 9);
    expect(frames.at(-1)?.totals.baryonNumber).toBeCloseTo(0, 9);
  });
});
