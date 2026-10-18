/* DensityMatrix: mixed-state analysis tools, built from pure states; partial trace, purity and von Neumann entropy. */
import {
  adjoint,
  entryAt,
  multiplyMatrices,
  spectralDecomposition,
  trace,
  zeroMatrix,
  type ComplexMatrix,
} from './linear-algebra.js';
import type { StateVector } from './state-vector.js';

const ENTROPY_EIGENVALUE_FLOOR = 1e-15;

function decodeMultiIndex(index: number, dimensions: readonly number[]): number[] {
  const digits = new Array<number>(dimensions.length);
  let remainder = index;
  for (let slot = dimensions.length - 1; slot >= 0; slot -= 1) {
    const dimension = dimensions[slot] ?? 1;
    digits[slot] = remainder % dimension;
    remainder = Math.floor(remainder / dimension);
  }
  return digits;
}

export class DensityMatrix {
  constructor(readonly matrix: ComplexMatrix) {
    if (matrix.rows !== matrix.columns) {
      throw new Error('A density matrix must be square');
    }
  }

  static fromPureState(state: StateVector): DensityMatrix {
    return new DensityMatrix(multiplyMatrices(state.amplitudes, adjoint(state.amplitudes)));
  }

  get dimension(): number {
    return this.matrix.rows;
  }

  expectation(operator: ComplexMatrix): number {
    return trace(multiplyMatrices(this.matrix, operator)).real;
  }

  purity(): number {
    return trace(multiplyMatrices(this.matrix, this.matrix)).real;
  }

  vonNeumannEntropy(): number {
    return spectralDecomposition(this.matrix).reduce((sum, component) => {
      if (component.eigenvalue <= ENTROPY_EIGENVALUE_FLOOR) {
        return sum;
      }
      return sum - component.multiplicity * component.eigenvalue * Math.log(component.eigenvalue);
    }, 0);
  }

  partialTrace(dimensions: readonly number[], keepSlotIndex: number): DensityMatrix {
    const fullDimension = dimensions.reduce((product, dimension) => product * dimension, 1);
    if (fullDimension !== this.dimension) {
      throw new Error('Slot dimensions do not multiply to the matrix dimension');
    }
    const keptDimension = dimensions[keepSlotIndex];
    if (keptDimension === undefined) {
      throw new Error(`No slot ${String(keepSlotIndex)}`);
    }
    const reduced = zeroMatrix(keptDimension, keptDimension);
    for (let row = 0; row < fullDimension; row += 1) {
      const rowDigits = decodeMultiIndex(row, dimensions);
      for (let column = 0; column < fullDimension; column += 1) {
        const columnDigits = decodeMultiIndex(column, dimensions);
        const othersMatch = rowDigits.every(
          (digit, slot) => slot === keepSlotIndex || digit === columnDigits[slot],
        );
        if (!othersMatch) {
          continue;
        }
        const entry = entryAt(this.matrix, row, column);
        const target =
          (rowDigits[keepSlotIndex] ?? 0) * keptDimension + (columnDigits[keepSlotIndex] ?? 0);
        reduced.real[target] = (reduced.real[target] ?? 0) + entry.real;
        reduced.imaginary[target] = (reduced.imaginary[target] ?? 0) + entry.imaginary;
      }
    }
    return new DensityMatrix(reduced);
  }
}
