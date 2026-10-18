/* Seeded random reproducibility plus the Monte Carlo test pattern: sampled frequencies inside a statistical tolerance. */
import { describe, expect, it } from 'vitest';
import { createRandomSource } from '../src/random.js';
import {
  sampleExponentialTime,
  sampleIndexByWeights,
  sampleIsotropicDirection,
} from '../src/sampling.js';
import {
  DEFAULT_MONTE_CARLO_SHOTS,
  frequency,
  isWithinTolerance,
  statisticalTolerance,
} from '../src/statistics.js';

const SEED = 20261015;
const SAMPLE_SIZE = 1000;
const UNIFORM_MEAN = 0.5;
const UNIFORM_STANDARD_DEVIATION = Math.sqrt(1 / 12);
const DEFAULT_SIGMA_MULTIPLIER = 5;

describe('createRandomSource', () => {
  it('is reproducible for the same seed and differs across seeds', () => {
    const first = createRandomSource(SEED);
    const second = createRandomSource(SEED);
    const other = createRandomSource(SEED + 1);
    const firstDraws = Array.from({ length: SAMPLE_SIZE }, () => first.nextUnit());
    const secondDraws = Array.from({ length: SAMPLE_SIZE }, () => second.nextUnit());
    const otherDraws = Array.from({ length: SAMPLE_SIZE }, () => other.nextUnit());
    expect(firstDraws).toEqual(secondDraws);
    expect(firstDraws).not.toEqual(otherDraws);
  });

  it('draws uniformly in [0, 1)', () => {
    const random = createRandomSource(SEED);
    const draws = Array.from({ length: DEFAULT_MONTE_CARLO_SHOTS }, () => random.nextUnit());
    draws.forEach((draw) => {
      expect(draw).toBeGreaterThanOrEqual(0);
      expect(draw).toBeLessThan(1);
    });
    const mean = draws.reduce((sum, draw) => sum + draw, 0) / draws.length;
    const tolerance =
      (DEFAULT_SIGMA_MULTIPLIER * UNIFORM_STANDARD_DEVIATION) / Math.sqrt(draws.length);
    expect(isWithinTolerance(mean, UNIFORM_MEAN, tolerance)).toBe(true);
  });
});

describe('sampling', () => {
  it('picks weighted indices with the right frequency over many shots', () => {
    const random = createRandomSource(SEED);
    const weights = [1, 3];
    const expectedProbability = 0.75;
    let heavyCount = 0;
    for (let shot = 0; shot < DEFAULT_MONTE_CARLO_SHOTS; shot += 1) {
      if (sampleIndexByWeights(weights, random) === 1) {
        heavyCount += 1;
      }
    }
    const observed = frequency(heavyCount, DEFAULT_MONTE_CARLO_SHOTS);
    const tolerance = statisticalTolerance(expectedProbability, DEFAULT_MONTE_CARLO_SHOTS);
    expect(isWithinTolerance(observed, expectedProbability, tolerance)).toBe(true);
  });

  it('samples exponential times with the requested mean', () => {
    const random = createRandomSource(SEED);
    const meanTime = 2.2e-6;
    let total = 0;
    for (let shot = 0; shot < DEFAULT_MONTE_CARLO_SHOTS; shot += 1) {
      total += sampleExponentialTime(meanTime, random);
    }
    const observedMean = total / DEFAULT_MONTE_CARLO_SHOTS;
    const tolerance = (DEFAULT_SIGMA_MULTIPLIER * meanTime) / Math.sqrt(DEFAULT_MONTE_CARLO_SHOTS);
    expect(isWithinTolerance(observedMean, meanTime, tolerance)).toBe(true);
  });

  it('samples unit-length directions with an unbiased z component', () => {
    const random = createRandomSource(SEED);
    let sumZ = 0;
    for (let shot = 0; shot < DEFAULT_MONTE_CARLO_SHOTS; shot += 1) {
      const direction = sampleIsotropicDirection(random);
      const length = Math.hypot(direction.x, direction.y, direction.z);
      expect(length).toBeCloseTo(1, 12);
      sumZ += direction.z;
    }
    const uniformOnMinusOneToOneStandardDeviation = Math.sqrt(1 / 3);
    const tolerance =
      (DEFAULT_SIGMA_MULTIPLIER * uniformOnMinusOneToOneStandardDeviation) /
      Math.sqrt(DEFAULT_MONTE_CARLO_SHOTS);
    expect(isWithinTolerance(sumZ / DEFAULT_MONTE_CARLO_SHOTS, 0, tolerance)).toBe(true);
  });
});

describe('statisticalTolerance', () => {
  it('is five binomial sigmas with an absolute floor', () => {
    expect(statisticalTolerance(0.5, DEFAULT_MONTE_CARLO_SHOTS)).toBeCloseTo(0.025, 12);
    expect(statisticalTolerance(0, DEFAULT_MONTE_CARLO_SHOTS)).toBe(1e-3);
  });
});

describe('createRandomSource first draw', () => {
  it('is uniform across seeds instead of starting near one', () => {
    const firstDraws = Array.from({ length: DEFAULT_MONTE_CARLO_SHOTS }, (ignored, seed) =>
      createRandomSource(seed).nextUnit(),
    );
    const mean = firstDraws.reduce((sum, draw) => sum + draw, 0) / firstDraws.length;
    const uniformStandardDeviation = Math.sqrt(1 / 12);
    const tolerance =
      (DEFAULT_SIGMA_MULTIPLIER * uniformStandardDeviation) / Math.sqrt(DEFAULT_MONTE_CARLO_SHOTS);
    expect(isWithinTolerance(mean, 0.5, tolerance)).toBe(true);
  });
});
