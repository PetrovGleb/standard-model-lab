/* Checks Pauli and spin algebra identities and the Hermitian spectral decomposition, including degenerate spectra and rotations. */
import { describe, expect, it } from 'vitest';
import {
  addMatrices,
  frobeniusNorm,
  hermitianFunction,
  identityMatrix,
  isUnitary,
  matrixFromRows,
  multiplyMatrices,
  PAULI_X,
  PAULI_Y,
  PAULI_Z,
  rotationAboutDirection,
  scaleMatrix,
  spectralDecomposition,
  spinOperators,
  subtractMatrices,
  Z_DIRECTION,
  type ComplexMatrix,
} from '../src/index.js';

const PRECISION = 1e-12;

function expectMatricesClose(actual: ComplexMatrix, expected: ComplexMatrix): void {
  expect(frobeniusNorm(subtractMatrices(actual, expected))).toBeLessThan(PRECISION);
}

describe('Pauli matrices', () => {
  it('square to identity and satisfy sigma_x sigma_y = i sigma_z', () => {
    [PAULI_X, PAULI_Y, PAULI_Z].forEach((pauli) => {
      expectMatricesClose(multiplyMatrices(pauli, pauli), identityMatrix(2));
    });
    expectMatricesClose(
      multiplyMatrices(PAULI_X, PAULI_Y),
      scaleMatrix(PAULI_Z, { real: 0, imaginary: 1 }),
    );
  });
});

describe('spin operators', () => {
  it('reproduce the Pauli matrices for spin one half', () => {
    const half = spinOperators(0.5);
    expectMatricesClose(half.x, scaleMatrix(PAULI_X, 0.5));
    expectMatricesClose(half.y, scaleMatrix(PAULI_Y, 0.5));
    expectMatricesClose(half.z, scaleMatrix(PAULI_Z, 0.5));
  });

  it('satisfy the commutator and Casimir relations for spin one', () => {
    const one = spinOperators(1);
    const commutator = subtractMatrices(
      multiplyMatrices(one.x, one.y),
      multiplyMatrices(one.y, one.x),
    );
    expectMatricesClose(commutator, scaleMatrix(one.z, { real: 0, imaginary: 1 }));
    expectMatricesClose(one.squared, scaleMatrix(identityMatrix(3), 2));
  });
});

describe('spectralDecomposition', () => {
  it('splits sigma_x into two rank-one projectors that resolve the identity', () => {
    const components = spectralDecomposition(PAULI_X);
    expect(components.map((component) => component.eigenvalue)).toEqual([1, -1]);
    components.forEach((component) => {
      expect(component.multiplicity).toBe(1);
      expectMatricesClose(
        multiplyMatrices(component.projector, component.projector),
        component.projector,
      );
    });
    const [plus, minus] = components;
    if (plus === undefined || minus === undefined) {
      throw new Error('two components expected');
    }
    expectMatricesClose(addMatrices(plus.projector, minus.projector), identityMatrix(2));
    expectMatricesClose(subtractMatrices(plus.projector, minus.projector), PAULI_X);
  });

  it('groups a degenerate eigenvalue into one projector of the right rank', () => {
    const degenerate = matrixFromRows([
      [2, 0, 0],
      [0, 2, { real: 0, imaginary: 1 }],
      [0, { real: 0, imaginary: -1 }, 2],
    ]);
    const components = spectralDecomposition(degenerate);
    const multiplicities = components.map((component) => [
      component.eigenvalue,
      component.multiplicity,
    ]);
    expect(multiplicities).toEqual([
      [3, 1],
      [2, 1],
      [1, 1],
    ]);
    const flat = matrixFromRows([
      [5, 0],
      [0, 5],
    ]);
    const [only] = spectralDecomposition(flat);
    expect(only?.multiplicity).toBe(2);
    expectMatricesClose(only?.projector ?? identityMatrix(1), identityMatrix(2));
  });

  it('rejects non-Hermitian input', () => {
    expect(() =>
      spectralDecomposition(
        matrixFromRows([
          [0, 1],
          [0, 0],
        ]),
      ),
    ).toThrow(/Hermitian/);
  });
});

describe('rotations', () => {
  it('flip the sign of a spinor after 2 pi and return after 4 pi', () => {
    const fullTurn = rotationAboutDirection(0.5, Z_DIRECTION, 2 * Math.PI);
    expectMatricesClose(fullTurn, scaleMatrix(identityMatrix(2), -1));
    const twoTurns = rotationAboutDirection(0.5, Z_DIRECTION, 4 * Math.PI);
    expectMatricesClose(twoTurns, identityMatrix(2));
    expect(
      isUnitary(rotationAboutDirection(1, { polarAngleDegrees: 37, azimuthDegrees: 110 }, 1.3)),
    ).toBe(true);
  });

  it('exponentiates through the spectral decomposition', () => {
    const exponential = hermitianFunction(PAULI_Z, (eigenvalue) => ({
      real: Math.exp(eigenvalue),
      imaginary: 0,
    }));
    expectMatricesClose(
      exponential,
      matrixFromRows([
        [Math.E, 0],
        [0, 1 / Math.E],
      ]),
    );
  });
});
