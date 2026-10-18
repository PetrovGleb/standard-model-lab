/* StateVector: immutable normalized pure state over a Hilbert space, with tensor products, operator application and two-qubit concurrence. */
import {
  adjoint,
  columnVector,
  complexAbsSquared,
  entryAt,
  kroneckerProduct,
  multiplyMatrices,
  scaleMatrix,
  type ComplexMatrix,
  type ComplexNumber,
} from './linear-algebra.js';

export const NORMALIZATION_TOLERANCE = 1e-10;

export class StateVector {
  private constructor(readonly amplitudes: ComplexMatrix) {}

  static fromAmplitudes(entries: ReadonlyArray<ComplexNumber | number>): StateVector {
    return new StateVector(columnVector(entries));
  }

  static fromColumn(column: ComplexMatrix): StateVector {
    if (column.columns !== 1) {
      throw new Error('A state vector must be a single column');
    }
    return new StateVector(column);
  }

  static basis(dimension: number, index: number): StateVector {
    if (index < 0 || index >= dimension) {
      throw new Error(`Basis index ${String(index)} outside dimension ${String(dimension)}`);
    }
    return StateVector.fromAmplitudes(
      Array.from({ length: dimension }, (ignored, position) => (position === index ? 1 : 0)),
    );
  }

  get dimension(): number {
    return this.amplitudes.rows;
  }

  amplitude(index: number): ComplexNumber {
    return entryAt(this.amplitudes, index, 0);
  }

  probability(index: number): number {
    return complexAbsSquared(this.amplitude(index));
  }

  norm(): number {
    let sum = 0;
    for (let index = 0; index < this.dimension; index += 1) {
      sum += this.probability(index);
    }
    return Math.sqrt(sum);
  }

  isNormalized(tolerance = NORMALIZATION_TOLERANCE): boolean {
    return Math.abs(this.norm() - 1) < tolerance;
  }

  normalized(): StateVector {
    const norm = this.norm();
    if (norm === 0) {
      throw new Error('Cannot normalize the zero vector');
    }
    return new StateVector(scaleMatrix(this.amplitudes, 1 / norm));
  }

  tensor(other: StateVector): StateVector {
    return new StateVector(kroneckerProduct(this.amplitudes, other.amplitudes));
  }

  apply(operator: ComplexMatrix): StateVector {
    return new StateVector(multiplyMatrices(operator, this.amplitudes));
  }

  innerProduct(other: StateVector): ComplexNumber {
    return entryAt(multiplyMatrices(adjoint(this.amplitudes), other.amplitudes), 0, 0);
  }

  expectation(operator: ComplexMatrix): number {
    return this.innerProduct(this.apply(operator)).real;
  }

  fidelityWith(other: StateVector): number {
    return complexAbsSquared(this.innerProduct(other));
  }
}

export function twoQubitConcurrence(state: StateVector): number {
  if (state.dimension !== 4) {
    throw new Error('Concurrence here is defined for two-qubit pure states');
  }
  const [first, second, third, fourth] = [0, 1, 2, 3].map((index) => state.amplitude(index));
  if (first === undefined || second === undefined || third === undefined || fourth === undefined) {
    throw new Error('Two-qubit state must have four amplitudes');
  }
  const determinantReal =
    first.real * fourth.real -
    first.imaginary * fourth.imaginary -
    (second.real * third.real - second.imaginary * third.imaginary);
  const determinantImaginary =
    first.real * fourth.imaginary +
    first.imaginary * fourth.real -
    (second.real * third.imaginary + second.imaginary * third.real);
  return 2 * Math.hypot(determinantReal, determinantImaginary);
}
