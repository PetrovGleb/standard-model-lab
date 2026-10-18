/* Checks the Markov transition matrix against the closed form of a two-state chain, including a stiff chain whose rates differ by twelve orders of magnitude, and the absorbing chain against
   the closed forms of one leaking state and of a fast pair leaking 10^35 times slower, plus the absorption time quantiles. */
import { describe, expect, it } from 'vitest';
import {
  absorbingMarkovTransition,
  absorptionTimeInSeconds,
  markovTransitionMatrix,
} from '../src/index.js';

const SOLAR_IONIZATION_PER_SECOND = 6e17;
const SOLAR_RECOMBINATION_PER_SECOND = 1.2e17;
const SOLAR_FUSION_PER_SECOND = 4.8e-18;
const AGE_OF_UNIVERSE_IN_SECONDS = 4.35e17;
const QUANTILES = [0.1, 0.5, 0.9];
const LADDER_RESOLUTION = 2 ** -50;

function leakingPairSurvival(
  upRate: number,
  downRate: number,
  leakRate: number,
  durationInSeconds: number,
): readonly number[] {
  const trace = upRate + downRate + leakRate;
  const root = Math.sqrt(trace * trace - 4 * upRate * leakRate);
  const slow = (-2 * upRate * leakRate) / (trace + root);
  const fast = -(trace + root) / 2;
  const decay = Math.exp(slow * durationInSeconds) / (slow - fast);
  const generator = [
    [-upRate, upRate],
    [downRate, -downRate - leakRate],
  ];
  return [0, 1].map(
    (column) => decay * ((generator[0]?.[column] ?? 0) - (column === 0 ? fast : 0)),
  );
}

function twoStateOccupation(upRate: number, downRate: number, durationInSeconds: number): number {
  return (upRate / (upRate + downRate)) * (1 - Math.exp(-(upRate + downRate) * durationInSeconds));
}

describe('markovTransitionMatrix', () => {
  it.each([
    [2, 3, 0.1],
    [2, 3, 10],
    [1e-3, 1e9, 1],
    [5e8, 4e8, 3e-9],
  ])(
    'matches the two-state closed form for up %d, down %d, time %d',
    (upRate, downRate, duration) => {
      const matrix = markovTransitionMatrix(
        [
          [-upRate, upRate],
          [downRate, -downRate],
        ],
        duration,
      );
      const expected = twoStateOccupation(upRate, downRate, duration);
      expect(Math.abs((matrix[0]?.[1] ?? 0) / expected - 1)).toBeLessThan(1e-9);
      expect((matrix[0]?.[0] ?? 0) + (matrix[0]?.[1] ?? 0)).toBeCloseTo(1, 12);
    },
  );

  it('returns the identity for no time', () => {
    expect(
      markovTransitionMatrix(
        [
          [-1, 1],
          [1, -1],
        ],
        0,
      ),
    ).toEqual([
      [1, 0],
      [0, 1],
    ]);
  });
});

describe('absorbingMarkovTransition', () => {
  it('splits one leaking state over its channels as rate over total times 1 − exp(−R t)', () => {
    const rates = [2e-3, 5e-4, 7e-5];
    const total = rates.reduce((sum, rate) => sum + rate, 0);
    [10, 1e3, 1e5].forEach((duration) => {
      const transition = absorbingMarkovTransition([[0]], [rates], duration);
      expect(transition.survivingProbabilities[0]?.[0]).toBeCloseTo(
        Math.exp(-total * duration),
        12,
      );
      rates.forEach((rate, index) => {
        const expected = (rate / total) * (1 - Math.exp(-total * duration));
        expect(
          Math.abs((transition.absorbedProbabilities[0]?.[index] ?? 0) / expected - 1),
        ).toBeLessThan(1e-12);
      });
    });
  });

  it('keeps a leak 10^35 times slower than the charge exchange of its state', () => {
    const transition = absorbingMarkovTransition(
      [
        [-SOLAR_IONIZATION_PER_SECOND, SOLAR_IONIZATION_PER_SECOND],
        [SOLAR_RECOMBINATION_PER_SECOND, -SOLAR_RECOMBINATION_PER_SECOND],
      ],
      [[0], [SOLAR_FUSION_PER_SECOND]],
      AGE_OF_UNIVERSE_IN_SECONDS,
    );
    const expected = leakingPairSurvival(
      SOLAR_IONIZATION_PER_SECOND,
      SOLAR_RECOMBINATION_PER_SECOND,
      SOLAR_FUSION_PER_SECOND,
      AGE_OF_UNIVERSE_IN_SECONDS,
    );
    expected.forEach((value, column) => {
      expect(
        Math.abs((transition.survivingProbabilities[0]?.[column] ?? 0) / value - 1),
      ).toBeLessThan(1e-9);
    });
    const absorbed = transition.absorbedProbabilities[0]?.[0] ?? 0;
    expect(Math.abs(absorbed - (1 - (expected[0] ?? 0) - (expected[1] ?? 0)))).toBeLessThan(1e-12);
    expect(absorbed).toBeGreaterThan(0.8);
  });

  it('agrees with the full transition matrix of a mild chain', () => {
    const generator = [
      [-3, 2, 1],
      [0.5, -1.5, 1],
      [0.2, 0.3, -0.5],
    ];
    const absorption = [
      [0.4, 0],
      [0, 0.25],
      [0.1, 0.1],
    ];
    const full = generator.map((row, index) => {
      const leaks = absorption[index] ?? [];
      const leak = leaks.reduce((sum, rate) => sum + rate, 0);
      return [...row.map((rate, column) => (column === index ? rate - leak : rate)), ...leaks];
    });
    const padded = [...full, [0, 0, 0, 0, 0], [0, 0, 0, 0, 0]];
    const reference = markovTransitionMatrix(padded, 1.7);
    const transition = absorbingMarkovTransition(generator, absorption, 1.7);
    [0, 1, 2].forEach((row) => {
      const actual = [
        ...(transition.survivingProbabilities[row] ?? []),
        ...(transition.absorbedProbabilities[row] ?? []),
      ];
      actual.forEach((value, column) => {
        expect(value).toBeCloseTo(reference[row]?.[column] ?? 0, 12);
      });
    });
  });
});

describe('absorptionTimeInSeconds', () => {
  it('inverts 1 − exp(−R t) of one leaking state', () => {
    const rate = 3e-4;
    const duration = 1e4;
    QUANTILES.forEach((quantile) => {
      const expected = -Math.log(1 - quantile * (1 - Math.exp(-rate * duration))) / rate;
      const time = absorptionTimeInSeconds([[0]], [[rate]], duration, 0, 0, quantile);
      expect(Math.abs(time - expected)).toBeLessThanOrEqual(duration * LADDER_RESOLUTION + 1e-9);
    });
  });

  it('times the slow leak of a fast pair', () => {
    const effectiveRate =
      (SOLAR_FUSION_PER_SECOND * SOLAR_IONIZATION_PER_SECOND) /
      (SOLAR_IONIZATION_PER_SECOND + SOLAR_RECOMBINATION_PER_SECOND);
    QUANTILES.forEach((quantile) => {
      const expected =
        -Math.log(1 - quantile * (1 - Math.exp(-effectiveRate * AGE_OF_UNIVERSE_IN_SECONDS))) /
        effectiveRate;
      const time = absorptionTimeInSeconds(
        [
          [-SOLAR_IONIZATION_PER_SECOND, SOLAR_IONIZATION_PER_SECOND],
          [SOLAR_RECOMBINATION_PER_SECOND, -SOLAR_RECOMBINATION_PER_SECOND],
        ],
        [[0], [SOLAR_FUSION_PER_SECOND]],
        AGE_OF_UNIVERSE_IN_SECONDS,
        0,
        0,
        quantile,
      );
      expect(Math.abs(time / expected - 1)).toBeLessThan(1e-9);
    });
  });
});
