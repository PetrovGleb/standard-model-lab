/* Builds the Hermitian operator and preparation states for a particle observable: spin or polarization along a direction, flavor in its basis. */
import type { MeasurementDirection, Observable, SpinPreparation } from '@standard-model/contracts';
import { identityMatrix, type ComplexMatrix } from './linear-algebra.js';
import { StateVector } from './state-vector.js';
import {
  spinAlongDirection,
  spinCoherentStateAlong,
  spinFromDimension,
  spinHalfStateAlong,
  X_DIRECTION,
  Y_DIRECTION,
  Z_DIRECTION,
} from './spin-operators.js';

const SPIN_PREPARATION_DIRECTIONS: Readonly<Record<SpinPreparation, MeasurementDirection>> = {
  up: Z_DIRECTION,
  down: { polarAngleDegrees: 180, azimuthDegrees: 0 },
  plusX: X_DIRECTION,
  minusX: { polarAngleDegrees: 90, azimuthDegrees: 180 },
  plusY: Y_DIRECTION,
  minusY: { polarAngleDegrees: 90, azimuthDegrees: 270 },
};

export type Preparation = SpinPreparation | MeasurementDirection | number;

function isDirectional(observable: Observable): boolean {
  return observable.name === 'spin' || observable.name === 'polarization';
}

export function observableOperator(
  observable: Observable,
  direction: MeasurementDirection = Z_DIRECTION,
): ComplexMatrix {
  if (isDirectional(observable)) {
    return spinAlongDirection(spinFromDimension(observable.dimension), direction);
  }
  const operator = identityMatrix(observable.dimension);
  for (let index = 0; index < observable.dimension; index += 1) {
    operator.real[index * observable.dimension + index] = index;
  }
  return operator;
}

export function normalizedObservableOperator(
  observable: Observable,
  direction: MeasurementDirection = Z_DIRECTION,
): ComplexMatrix {
  if (!isDirectional(observable)) {
    throw new Error(`${observable.name} has no sign-normalized form`);
  }
  const spin = spinFromDimension(observable.dimension);
  const operator = spinAlongDirection(spin, direction);
  for (let index = 0; index < operator.real.length; index += 1) {
    operator.real[index] = (operator.real[index] ?? 0) / spin;
    operator.imaginary[index] = (operator.imaginary[index] ?? 0) / spin;
  }
  return operator;
}

export function preparationState(observable: Observable, preparation: Preparation): StateVector {
  if (typeof preparation === 'number') {
    return StateVector.basis(observable.dimension, preparation);
  }
  if (!isDirectional(observable)) {
    throw new Error(`${observable.name} is prepared by basis index only`);
  }
  const direction =
    typeof preparation === 'string' ? SPIN_PREPARATION_DIRECTIONS[preparation] : preparation;
  return observable.dimension === 2
    ? spinHalfStateAlong(direction)
    : spinCoherentStateAlong(spinFromDimension(observable.dimension), direction);
}
