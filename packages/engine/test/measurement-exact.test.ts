/* Exact-tier oracle: Born probabilities, repeated measurements, spin-1 projections and locality of a measurement inside a larger register. */
import { describe, expect, it } from 'vitest';
import { createEngine, X_DIRECTION, Z_DIRECTION } from '../src/index.js';

const SEED = 3;
const PRECISION = 12;

describe('single spin measurements', () => {
  it('gives 50/50 for spin up measured along x', () => {
    const engine = createEngine({ seed: SEED });
    const electron = engine.particles.create('electron');
    engine.quantum.prepare(electron, 'spin', 'up');
    const outcomes = engine.quantum.probabilities(electron, 'spin', X_DIRECTION);
    expect(outcomes.map((outcome) => outcome.eigenvalue)).toEqual([0.5, -0.5]);
    outcomes.forEach((outcome) => expect(outcome.probability).toBeCloseTo(0.5, PRECISION));
  });

  it.each([0, 30, 60, 90, 120, 180])(
    'gives cos squared of half the angle for spin up measured at %i degrees',
    (polarAngleDegrees) => {
      const engine = createEngine({ seed: SEED });
      const electron = engine.particles.create('electron');
      engine.quantum.prepare(electron, 'spin', 'up');
      const [plus] = engine.quantum.probabilities(electron, 'spin', {
        polarAngleDegrees,
        azimuthDegrees: 0,
      });
      const expected = Math.cos((polarAngleDegrees * Math.PI) / 360) ** 2;
      if (expected < 1e-15) {
        expect(plus?.eigenvalue).toBe(-0.5);
      } else {
        expect(plus?.probability).toBeCloseTo(expected, PRECISION);
      }
    },
  );

  it('repeats the same result with probability one on an immediate re-measurement', () => {
    const engine = createEngine({ seed: SEED });
    const electron = engine.particles.create('electron');
    engine.quantum.prepare(electron, 'spin', 'up');
    const first = engine.quantum.measure(electron, 'spin', X_DIRECTION);
    const repeated = engine.quantum.probabilities(electron, 'spin', X_DIRECTION);
    expect(repeated).toHaveLength(1);
    expect(repeated[0]?.eigenvalue).toBe(first.eigenvalue);
    expect(repeated[0]?.probability).toBeCloseTo(1, PRECISION);
    expect(engine.quantum.measure(electron, 'spin', X_DIRECTION).eigenvalue).toBe(first.eigenvalue);
  });

  it('measures a massive spin-1 state |1,1> along x with probabilities 1/4, 1/2, 1/4', () => {
    const engine = createEngine({ seed: SEED });
    const wBoson = engine.particles.create('wPlus');
    engine.quantum.prepare(wBoson, 'polarization', 0);
    const alongZ = engine.quantum.probabilities(wBoson, 'polarization', Z_DIRECTION);
    expect(alongZ).toHaveLength(1);
    expect(alongZ[0]?.eigenvalue).toBeCloseTo(1, PRECISION);
    const alongX = engine.quantum.probabilities(wBoson, 'polarization', X_DIRECTION);
    expect(alongX.map((outcome) => outcome.eigenvalue)).toEqual([1, 0, -1]);
    expect(alongX.map((outcome) => outcome.probability)).toEqual([
      expect.closeTo(0.25, PRECISION),
      expect.closeTo(0.5, PRECISION),
      expect.closeTo(0.25, PRECISION),
    ]);
  });

  it('prepares spin along an arbitrary direction and finds it there with certainty', () => {
    const engine = createEngine({ seed: SEED });
    const muon = engine.particles.create('muon');
    const direction = { polarAngleDegrees: 50, azimuthDegrees: 200 };
    engine.quantum.prepare(muon, 'spin', direction);
    const [plus] = engine.quantum.probabilities(muon, 'spin', direction);
    expect(plus?.eigenvalue).toBe(0.5);
    expect(plus?.probability).toBeCloseTo(1, PRECISION);
    expect(engine.quantum.expectation(muon, 'spin', direction)).toBeCloseTo(0.5, PRECISION);
  });
});

describe('measurement inside a larger register', () => {
  it('leaves the other particles of a three-slot register untouched', () => {
    const engine = createEngine({ seed: SEED });
    const electronA = engine.particles.create('electron');
    const electronB = engine.particles.create('electron');
    const photon = engine.particles.create('photon');
    const pair = engine.quantum.entangle([electronA, electronB], 'spin', 'spinSinglet');
    const photonRegister = engine.quantum.prepare(photon, 'polarization', 'plusX');
    const triple = engine.quantum.registers.merge(pair, photonRegister);
    expect(triple.dimensions).toEqual([2, 2, 2]);
    expect(photon.quantumSlot('polarization')?.slotIndex).toBe(2);
    engine.quantum.measure(photon, 'polarization', Z_DIRECTION);
    const reducedA = engine.quantum.reducedStateOf(electronA, 'spin');
    expect(reducedA.purity()).toBeCloseTo(0.5, PRECISION);
    const [plus] = engine.quantum.probabilities(electronB, 'spin', Z_DIRECTION);
    expect(plus?.probability).toBeCloseTo(0.5, PRECISION);
  });
});
