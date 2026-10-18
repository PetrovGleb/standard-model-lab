/* Spin operators in units of the reduced Planck constant for any spin, Pauli matrices, directions from angles, spin-coherent states of maximal projection along a direction, and rotations. */
import type { MeasurementDirection, Vector3 } from '@standard-model/contracts';
import { StateVector } from './state-vector.js';
import {
  addMatrices,
  adjoint,
  complexPhase,
  hermitianFunction,
  matrixFromRows,
  multiplyMatrices,
  scaleMatrix,
  subtractMatrices,
  zeroMatrix,
  type ComplexMatrix,
} from './linear-algebra.js';

export const PAULI_X = matrixFromRows([
  [0, 1],
  [1, 0],
]);
export const PAULI_Y = matrixFromRows([
  [0, { real: 0, imaginary: -1 }],
  [{ real: 0, imaginary: 1 }, 0],
]);
export const PAULI_Z = matrixFromRows([
  [1, 0],
  [0, -1],
]);

export const Z_DIRECTION: MeasurementDirection = { polarAngleDegrees: 0, azimuthDegrees: 0 };
export const X_DIRECTION: MeasurementDirection = { polarAngleDegrees: 90, azimuthDegrees: 0 };
export const Y_DIRECTION: MeasurementDirection = { polarAngleDegrees: 90, azimuthDegrees: 90 };

export interface SpinOperators {
  readonly x: ComplexMatrix;
  readonly y: ComplexMatrix;
  readonly z: ComplexMatrix;
  readonly squared: ComplexMatrix;
}

export function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function directionFromAngles(direction: MeasurementDirection): Vector3 {
  const polar = degreesToRadians(direction.polarAngleDegrees);
  const azimuth = degreesToRadians(direction.azimuthDegrees);
  return {
    x: Math.sin(polar) * Math.cos(azimuth),
    y: Math.sin(polar) * Math.sin(azimuth),
    z: Math.cos(polar),
  };
}

export function spinFromDimension(dimension: number): number {
  return (dimension - 1) / 2;
}

export function spinOperators(spin: number): SpinOperators {
  const dimension = Math.round(2 * spin + 1);
  const raising = zeroMatrix(dimension, dimension);
  const zOperator = zeroMatrix(dimension, dimension);
  for (let index = 0; index < dimension; index += 1) {
    const magneticNumber = spin - index;
    zOperator.real[index * dimension + index] = magneticNumber;
    if (index > 0) {
      raising.real[(index - 1) * dimension + index] = Math.sqrt(
        spin * (spin + 1) - magneticNumber * (magneticNumber + 1),
      );
    }
  }
  const lowering = adjoint(raising);
  const xOperator = scaleMatrix(addMatrices(raising, lowering), 0.5);
  const yOperator = scaleMatrix(subtractMatrices(raising, lowering), { real: 0, imaginary: -0.5 });
  const squared = addMatrices(
    addMatrices(multiplyMatrices(xOperator, xOperator), multiplyMatrices(yOperator, yOperator)),
    multiplyMatrices(zOperator, zOperator),
  );
  return { x: xOperator, y: yOperator, z: zOperator, squared };
}

export function spinAlongDirection(spin: number, direction: MeasurementDirection): ComplexMatrix {
  const unit = directionFromAngles(direction);
  const operators = spinOperators(spin);
  return addMatrices(
    addMatrices(scaleMatrix(operators.x, unit.x), scaleMatrix(operators.y, unit.y)),
    scaleMatrix(operators.z, unit.z),
  );
}

export function spinHalfStateAlong(direction: MeasurementDirection): StateVector {
  const polar = degreesToRadians(direction.polarAngleDegrees);
  const azimuth = degreesToRadians(direction.azimuthDegrees);
  const phase = complexPhase(azimuth);
  return StateVector.fromAmplitudes([
    Math.cos(polar / 2),
    { real: phase.real * Math.sin(polar / 2), imaginary: phase.imaginary * Math.sin(polar / 2) },
  ]);
}

function binomial(total: number, chosen: number): number {
  let result = 1;
  for (let step = 1; step <= chosen; step += 1) {
    result = (result * (total - chosen + step)) / step;
  }
  return result;
}

export function spinCoherentStateAlong(spin: number, direction: MeasurementDirection): StateVector {
  const polar = degreesToRadians(direction.polarAngleDegrees);
  const azimuth = degreesToRadians(direction.azimuthDegrees);
  const twiceSpin = Math.round(2 * spin);
  return StateVector.fromAmplitudes(
    Array.from({ length: twiceSpin + 1 }, (ignored, lowered) => {
      const magnitude =
        Math.sqrt(binomial(twiceSpin, lowered)) *
        Math.cos(polar / 2) ** (twiceSpin - lowered) *
        Math.sin(polar / 2) ** lowered;
      const phase = complexPhase(lowered * azimuth);
      return { real: magnitude * phase.real, imaginary: magnitude * phase.imaginary };
    }),
  );
}

export function rotationAboutDirection(
  spin: number,
  direction: MeasurementDirection,
  angleRadians: number,
): ComplexMatrix {
  return hermitianFunction(spinAlongDirection(spin, direction), (magneticNumber) =>
    complexPhase(-angleRadians * magneticNumber),
  );
}
