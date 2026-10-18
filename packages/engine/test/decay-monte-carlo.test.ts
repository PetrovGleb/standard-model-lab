/* Monte Carlo tier for decays: mean life, branching frequencies, the Michel spectrum mean and isotropy within statistical tolerance. */
import { PARTICLE_CATALOG } from '@standard-model/constants';
import {
  DEFAULT_MONTE_CARLO_SHOTS,
  DEFAULT_SIGMA_MULTIPLIER,
  frequency,
  isWithinTolerance,
  statisticalTolerance,
} from '@standard-model/utils';
import { describe, expect, it } from 'vitest';
import { createEngine } from '../src/index.js';

const SEED = 20261015;
const MICHEL_MEAN_ENERGY_FRACTION = 0.7;
const MICHEL_ENERGY_FRACTION_STANDARD_DEVIATION = Math.sqrt(0.5333333333 - 0.49);
const ISOTROPIC_COSINE_STANDARD_DEVIATION = Math.sqrt(1 / 3);

describe('decay statistics', () => {
  it('reproduces the muon mean life', () => {
    const engine = createEngine({ seed: SEED });
    const muon = engine.particles.create('muon');
    const meanLife = PARTICLE_CATALOG.muon.meanLifeInSeconds?.value ?? 0;
    let total = 0;
    for (let shot = 0; shot < DEFAULT_MONTE_CARLO_SHOTS; shot += 1) {
      total += engine.decays.sampleProperDecayTime(muon);
    }
    const observedMean = total / DEFAULT_MONTE_CARLO_SHOTS;
    const tolerance = (DEFAULT_SIGMA_MULTIPLIER * meanLife) / Math.sqrt(DEFAULT_MONTE_CARLO_SHOTS);
    expect(isWithinTolerance(observedMean, meanLife, tolerance)).toBe(true);
  });

  it('picks Z to e+ e- at the PDG branching fraction', () => {
    const engine = createEngine({ seed: SEED });
    let electronPairs = 0;
    for (let shot = 0; shot < DEFAULT_MONTE_CARLO_SHOTS; shot += 1) {
      const event = engine.decays.decay(engine.particles.create('zBoson'));
      if (event.products[0]?.name === 'electron') {
        electronPairs += 1;
      }
    }
    const expected =
      engine.decays.channelProbabilities(engine.particles.create('zBoson'))[0]?.probability ?? 0;
    const observed = frequency(electronPairs, DEFAULT_MONTE_CARLO_SHOTS);
    expect(
      isWithinTolerance(
        observed,
        expected,
        statisticalTolerance(expected, DEFAULT_MONTE_CARLO_SHOTS),
      ),
    ).toBe(true);
  });

  it('gives the Michel mean electron energy of 0.7 times half the muon mass', () => {
    const engine = createEngine({ seed: SEED });
    const halfMuonMass = PARTICLE_CATALOG.muon.massInGev.value / 2;
    let total = 0;
    let maximum = 0;
    for (let shot = 0; shot < DEFAULT_MONTE_CARLO_SHOTS; shot += 1) {
      const event = engine.decays.decay(engine.particles.create('muon'));
      const electronEnergy = event.products[0]?.fourMomentumInGev?.energy ?? 0;
      total += electronEnergy / halfMuonMass;
      maximum = Math.max(maximum, electronEnergy / halfMuonMass);
    }
    const observedMean = total / DEFAULT_MONTE_CARLO_SHOTS;
    const tolerance =
      (DEFAULT_SIGMA_MULTIPLIER * MICHEL_ENERGY_FRACTION_STANDARD_DEVIATION) /
      Math.sqrt(DEFAULT_MONTE_CARLO_SHOTS);
    expect(isWithinTolerance(observedMean, MICHEL_MEAN_ENERGY_FRACTION, tolerance)).toBe(true);
    expect(observedMean).toBeGreaterThan(2 / 3 + tolerance);
    expect(maximum).toBeLessThanOrEqual(1 + 1e-4);
  });

  it('emits two-body products isotropically', () => {
    const engine = createEngine({ seed: SEED });
    let cosineSum = 0;
    for (let shot = 0; shot < DEFAULT_MONTE_CARLO_SHOTS; shot += 1) {
      const event = engine.decays.decay(engine.particles.create('wPlus'), { channelIndex: 0 });
      const momentum = event.products[0]?.fourMomentumInGev?.momentum;
      if (momentum === undefined || momentum === null) {
        throw new Error('product momentum expected');
      }
      cosineSum += momentum.z / Math.hypot(momentum.x, momentum.y, momentum.z);
    }
    const tolerance =
      (DEFAULT_SIGMA_MULTIPLIER * ISOTROPIC_COSINE_STANDARD_DEVIATION) /
      Math.sqrt(DEFAULT_MONTE_CARLO_SHOTS);
    expect(isWithinTolerance(cosineSum / DEFAULT_MONTE_CARLO_SHOTS, 0, tolerance)).toBe(true);
  });
});
