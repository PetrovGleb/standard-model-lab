/* Exact-tier oracle for entanglement: singlet and triplet correlations, CHSH, no-signalling, reduced states and concurrence. */
import { describe, expect, it } from 'vitest';
import {
  createEngine,
  entangledState,
  frobeniusNorm,
  identityMatrix,
  observableOperator,
  scaleMatrix,
  StateVector,
  subtractMatrices,
  twoQubitConcurrence,
  type Engine,
} from '../src/index.js';

const SEED = 5;
const PRECISION = 12;
const TSIRELSON_BOUND = 2 * Math.SQRT2;

function inPlane(polarAngleDegrees: number): { polarAngleDegrees: number; azimuthDegrees: number } {
  return { polarAngleDegrees, azimuthDegrees: 0 };
}

function singletPair(engine: Engine) {
  const electronA = engine.particles.create('electron');
  const electronB = engine.particles.create('electron');
  engine.quantum.entangle([electronA, electronB], 'spin', 'spinSinglet');
  return { electronA, electronB };
}

function correlation(
  engine: Engine,
  pair: ReturnType<typeof singletPair>,
  first: number,
  second: number,
): number {
  return engine.quantum.correlation([
    { particle: pair.electronA, observable: 'spin', direction: inPlane(first) },
    { particle: pair.electronB, observable: 'spin', direction: inPlane(second) },
  ]);
}

describe('spin singlet', () => {
  it('always gives opposite signs along the same axis', () => {
    const engine = createEngine({ seed: SEED });
    const pair = singletPair(engine);
    const first = engine.quantum.measure(pair.electronA, 'spin', inPlane(0));
    const [remaining] = engine.quantum.probabilities(pair.electronB, 'spin', inPlane(0));
    expect(remaining?.eigenvalue).toBe(-first.eigenvalue);
    expect(remaining?.probability).toBeCloseTo(1, PRECISION);
  });

  it.each([0, 45, 90, 120, 180])(
    'has E = -cos(theta) and P(same) = sin^2(theta/2) at %i degrees',
    (angle) => {
      const engine = createEngine({ seed: SEED });
      const pair = singletPair(engine);
      const radians = (angle * Math.PI) / 180;
      expect(correlation(engine, pair, 0, angle)).toBeCloseTo(-Math.cos(radians), PRECISION);
      expect((1 + correlation(engine, pair, 0, angle)) / 2).toBeCloseTo(
        Math.sin(radians / 2) ** 2,
        PRECISION,
      );
    },
  );

  it('gives exactly 3/4 for same signs at 120 degrees, above the 2/3 local bound', () => {
    const engine = createEngine({ seed: SEED });
    const pair = singletPair(engine);
    const probabilitySame = (1 + correlation(engine, pair, 0, 120)) / 2;
    expect(probabilitySame).toBeCloseTo(0.75, PRECISION);
    expect(probabilitySame).toBeGreaterThan(2 / 3);
  });

  it('reaches the Tsirelson bound in CHSH with the optimal angles', () => {
    const engine = createEngine({ seed: SEED });
    const pair = singletPair(engine);
    const chsh =
      correlation(engine, pair, 0, 45) -
      correlation(engine, pair, 0, 135) +
      correlation(engine, pair, 90, 45) +
      correlation(engine, pair, 90, 135);
    expect(Math.abs(chsh)).toBeCloseTo(TSIRELSON_BOUND, PRECISION);
  });

  it('cannot signal: the marginal of B averaged over outcomes of A is independent of A setting', () => {
    const engine = createEngine({ seed: SEED });
    const pair = singletPair(engine);
    const register = engine.quantum.registers.registerOf(pair.electronA, 'spin');
    const slotA = register.slotIndexOf(pair.electronA.id, 'spin');
    const spinObservable = { name: 'spin', dimension: 2 } as const;
    [30, 80, 170].forEach((settingA) => {
      const singlet = register.state;
      const candidates = engine.quantum.measurement.candidates(
        register,
        slotA,
        observableOperator(spinObservable, inPlane(settingA)),
      );
      const averagedPlusB = candidates.reduce((sum, candidate) => {
        register.setState(candidate.postMeasurementState);
        const [plusB] = engine.quantum.probabilities(pair.electronB, 'spin', inPlane(70));
        return sum + candidate.probability * (plusB?.probability ?? 0);
      }, 0);
      register.setState(singlet);
      expect(averagedPlusB).toBeCloseTo(0.5, PRECISION);
    });
  });
});

describe('product and triplet states', () => {
  it('keeps CHSH within 2 for a product state', () => {
    const engine = createEngine({ seed: SEED });
    const electronA = engine.particles.create('electron');
    const electronB = engine.particles.create('electron');
    const registerA = engine.quantum.prepare(electronA, 'spin', 'up');
    const registerB = engine.quantum.prepare(electronB, 'spin', 'plusX');
    engine.quantum.registers.merge(registerA, registerB);
    const pair = { electronA, electronB };
    const chsh =
      correlation(engine, pair, 0, 45) -
      correlation(engine, pair, 0, 135) +
      correlation(engine, pair, 90, 45) +
      correlation(engine, pair, 90, 135);
    expect(Math.abs(chsh)).toBeLessThanOrEqual(2 + 1e-12);
  });

  it('gives E = +cos(theta) for the triplet phi plus in the x-z plane', () => {
    const engine = createEngine({ seed: SEED });
    const electronA = engine.particles.create('electron');
    const electronB = engine.particles.create('electron');
    engine.quantum.entangle([electronA, electronB], 'spin', 'bellPhiPlus');
    const pair = { electronA, electronB };
    [0, 60, 90, 150].forEach((angle) => {
      expect(correlation(engine, pair, 0, angle)).toBeCloseTo(
        Math.cos((angle * Math.PI) / 180),
        PRECISION,
      );
    });
  });
});

describe('reduced states and entanglement measures', () => {
  it('reduces one half of a Bell pair to the maximally mixed state', () => {
    const engine = createEngine({ seed: SEED });
    const pair = singletPair(engine);
    const reduced = engine.quantum.reducedStateOf(pair.electronA, 'spin');
    expect(
      frobeniusNorm(subtractMatrices(reduced.matrix, scaleMatrix(identityMatrix(2), 0.5))),
    ).toBeLessThan(1e-12);
    expect(reduced.purity()).toBeCloseTo(0.5, PRECISION);
    expect(reduced.vonNeumannEntropy()).toBeCloseTo(Math.LN2, PRECISION);
  });

  it('gives concurrence one for Bell states and zero for a product state', () => {
    expect(twoQubitConcurrence(entangledState('spinSinglet'))).toBeCloseTo(1, PRECISION);
    expect(twoQubitConcurrence(entangledState('bellPhiPlus'))).toBeCloseTo(1, PRECISION);
    expect(twoQubitConcurrence(StateVector.basis(4, 0))).toBeCloseTo(0, PRECISION);
  });

  it('refuses to entangle a particle that is already part of a pair', () => {
    const engine = createEngine({ seed: SEED });
    const pair = singletPair(engine);
    const third = engine.particles.create('electron');
    expect(() => engine.quantum.entangle([pair.electronA, third], 'spin', 'bellPsiPlus')).toThrow(
      /not entangled with anything yet/,
    );
  });
});
