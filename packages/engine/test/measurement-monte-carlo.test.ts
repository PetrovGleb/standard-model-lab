/* Monte Carlo tier: seeded sampled frequencies for Stern-Gerlach, the singlet at 120 degrees and CHSH, inside statistical tolerance. */
import {
  DEFAULT_MONTE_CARLO_SHOTS,
  DEFAULT_SIGMA_MULTIPLIER,
  frequency,
  isWithinTolerance,
  statisticalTolerance,
} from '@standard-model/utils';
import { describe, expect, it } from 'vitest';
import { createEngine, X_DIRECTION, type Engine } from '../src/index.js';

const SEED = 20261015;

function inPlane(polarAngleDegrees: number): { polarAngleDegrees: number; azimuthDegrees: number } {
  return { polarAngleDegrees, azimuthDegrees: 0 };
}

function sampledSingletCorrelation(
  engine: Engine,
  first: number,
  second: number,
  shots: number,
): number {
  const electronA = engine.particles.create('electron');
  const electronB = engine.particles.create('electron');
  let productSum = 0;
  for (let shot = 0; shot < shots; shot += 1) {
    engine.quantum.entangle([electronA, electronB], 'spin', 'spinSinglet');
    const signA = Math.sign(engine.quantum.measure(electronA, 'spin', inPlane(first)).eigenvalue);
    const signB = Math.sign(engine.quantum.measure(electronB, 'spin', inPlane(second)).eigenvalue);
    productSum += signA * signB;
    engine.quantum.release(electronA, 'spin');
  }
  return productSum / shots;
}

describe('Monte Carlo measurements', () => {
  it('splits spin up along x into halves within tolerance', () => {
    const engine = createEngine({ seed: SEED });
    const electron = engine.particles.create('electron');
    let plusCount = 0;
    for (let shot = 0; shot < DEFAULT_MONTE_CARLO_SHOTS; shot += 1) {
      engine.quantum.prepare(electron, 'spin', 'up');
      if (engine.quantum.measure(electron, 'spin', X_DIRECTION).eigenvalue > 0) {
        plusCount += 1;
      }
      engine.quantum.release(electron, 'spin');
    }
    const observed = frequency(plusCount, DEFAULT_MONTE_CARLO_SHOTS);
    expect(
      isWithinTolerance(observed, 0.5, statisticalTolerance(0.5, DEFAULT_MONTE_CARLO_SHOTS)),
    ).toBe(true);
    expect(engine.quantum.registers.size).toBe(0);
  });

  it('gives same signs about three quarters of the time at 120 degrees', () => {
    const engine = createEngine({ seed: SEED });
    const sampledCorrelation = sampledSingletCorrelation(engine, 0, 120, DEFAULT_MONTE_CARLO_SHOTS);
    const probabilitySame = (1 + sampledCorrelation) / 2;
    const tolerance = statisticalTolerance(0.75, DEFAULT_MONTE_CARLO_SHOTS);
    expect(isWithinTolerance(probabilitySame, 0.75, tolerance)).toBe(true);
    expect(probabilitySame).toBeGreaterThan(2 / 3);
  });

  it('violates the CHSH bound with sampled correlations', () => {
    const engine = createEngine({ seed: SEED });
    const shots = DEFAULT_MONTE_CARLO_SHOTS;
    const settings: ReadonlyArray<readonly [number, number, number]> = [
      [0, 45, 1],
      [0, 135, -1],
      [90, 45, 1],
      [90, 135, 1],
    ];
    const chsh = settings.reduce(
      (sum, [first, second, sign]) =>
        sum + sign * sampledSingletCorrelation(engine, first, second, shots),
      0,
    );
    const expectedCorrelationMagnitude = Math.SQRT1_2;
    const correlationStandardError = Math.sqrt((1 - expectedCorrelationMagnitude ** 2) / shots);
    const tolerance =
      DEFAULT_SIGMA_MULTIPLIER * Math.sqrt(settings.length) * correlationStandardError;
    expect(isWithinTolerance(Math.abs(chsh), 2 * Math.SQRT2, tolerance)).toBe(true);
    expect(Math.abs(chsh)).toBeGreaterThan(2);
  });
});
