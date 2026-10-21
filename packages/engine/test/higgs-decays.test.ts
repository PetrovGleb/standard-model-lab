/* Checks the Higgs decay table and its sampling: the channels add up to one with gg and c c̄ among them, and the higgsDecays template draws b b̄, W W*, g g, τ τ, c c̄ and Z Z*
   at their Standard Model fractions within 5σ, every quark or gluon pair ending as hadrons in the detector. */
import { PARTICLE_CATALOG } from '@standard-model/constants';
import type { ParticleName } from '@standard-model/contracts';
import { statisticalTolerance } from '@standard-model/utils';
import { describe, expect, it } from 'vitest';
import { HIGGS_DECAYS_TEMPLATE, runExperiment } from '../src/index.js';

const SHOTS = 2000;
const SEED = 5;
const UNITY_TOLERANCE = 0.001;
const RUN_TIMEOUT_IN_MILLISECONDS = 120_000;
const CHANNELS: ReadonlyArray<readonly [string, (products: readonly string[]) => boolean]> = [
  ['bottom+antiBottom', (products) => products.join('+') === 'bottom+antiBottom'],
  ['wPlus+wMinus', (products) => products.includes('wPlus') || products.includes('wMinus')],
  ['gluon+gluon', (products) => products.join('+') === 'gluon+gluon'],
  ['tau+antiTau', (products) => products.join('+') === 'tau+antiTau'],
  ['charm+antiCharm', (products) => products.join('+') === 'charm+antiCharm'],
  ['zBoson+zBoson', (products) => products.length === 3 && products.includes('zBoson')],
];
const HADRONIC = ['bottom+antiBottom', 'gluon+gluon', 'charm+antiCharm'];

function fractionOf(key: string): number {
  return (
    PARTICLE_CATALOG.higgsBoson.decays.find(
      (channel) => [...channel.products].sort().join('+') === key.split('+').sort().join('+'),
    )?.branchingFraction.value ?? 0
  );
}

describe('Higgs decays', () => {
  it('lists the Standard Model channels, gluons and charm included, adding up to one', () => {
    const total = PARTICLE_CATALOG.higgsBoson.decays.reduce(
      (sum, channel) => sum + channel.branchingFraction.value,
      0,
    );
    expect(Math.abs(total - 1)).toBeLessThan(UNITY_TOLERANCE);
    expect(fractionOf('gluon+gluon')).toBeGreaterThan(0);
    expect(fractionOf('charm+antiCharm')).toBeGreaterThan(0);
  });

  it(
    'draws every channel at its fraction and turns the quark and gluon pairs into hadrons',
    () => {
      const result = runExperiment(HIGGS_DECAYS_TEMPLATE, {
        shots: SHOTS,
        seed: SEED,
        includeSystemReport: false,
      });
      const outcomes = Object.entries(result.outcomeCounts.decay ?? {}).map(
        ([key, count]) => [key.split('+') as readonly ParticleName[], count] as const,
      );
      CHANNELS.forEach(([key, matches]) => {
        const expected = fractionOf(key);
        const observed =
          outcomes
            .filter(([products]) => matches(products))
            .reduce((sum, [, count]) => sum + count, 0) / SHOTS;
        expect(Math.abs(observed - expected)).toBeLessThan(statisticalTolerance(expected, SHOTS));
      });
      const hadronic = outcomes
        .filter(([products]) => HADRONIC.includes(products.join('+')))
        .reduce((sum, [, count]) => sum + count, 0);
      expect(result.outcomeCounts.detector?.hadrons).toBe(hadronic);
    },
    RUN_TIMEOUT_IN_MILLISECONDS,
  );
});
