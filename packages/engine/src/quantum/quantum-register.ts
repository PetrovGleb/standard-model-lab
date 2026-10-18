/* QuantumRegister: a joint Hilbert space over ordered slots (particle plus observable), big-endian indexing, with operator expansion to the full space. */
import type { ObservableName } from '@standard-model/contracts';
import { identityMatrix, kroneckerProduct, type ComplexMatrix } from './linear-algebra.js';
import { StateVector } from './state-vector.js';

export interface RegisterSlot {
  readonly particleId: string;
  readonly observable: ObservableName;
  readonly dimension: number;
}

export function expandOperatorToSlots(
  operator: ComplexMatrix,
  dimensions: readonly number[],
  slotIndex: number,
): ComplexMatrix {
  const slotDimension = dimensions[slotIndex];
  if (slotDimension === undefined) {
    throw new Error(`No slot ${String(slotIndex)}`);
  }
  if (operator.rows !== slotDimension || operator.columns !== slotDimension) {
    throw new Error(`Operator does not match slot dimension ${String(slotDimension)}`);
  }
  const before = dimensions
    .slice(0, slotIndex)
    .reduce((product, dimension) => product * dimension, 1);
  const after = dimensions
    .slice(slotIndex + 1)
    .reduce((product, dimension) => product * dimension, 1);
  return kroneckerProduct(
    kroneckerProduct(identityMatrix(before), operator),
    identityMatrix(after),
  );
}

export class QuantumRegister {
  private currentState: StateVector;

  constructor(
    readonly id: string,
    readonly slots: readonly RegisterSlot[],
    initialState: StateVector,
  ) {
    this.currentState = initialState;
    this.assertFits(initialState);
  }

  get state(): StateVector {
    return this.currentState;
  }

  get dimensions(): readonly number[] {
    return this.slots.map((slot) => slot.dimension);
  }

  get dimension(): number {
    return this.dimensions.reduce((product, dimension) => product * dimension, 1);
  }

  setState(state: StateVector): void {
    this.assertFits(state);
    this.currentState = state;
  }

  slotIndexOf(particleId: string, observable: ObservableName): number {
    const index = this.slots.findIndex(
      (slot) => slot.particleId === particleId && slot.observable === observable,
    );
    if (index < 0) {
      throw new Error(`Register ${this.id} has no slot for ${particleId} ${observable}`);
    }
    return index;
  }

  expandOperator(operator: ComplexMatrix, slotIndex: number): ComplexMatrix {
    return expandOperatorToSlots(operator, this.dimensions, slotIndex);
  }

  applyOnSlot(operator: ComplexMatrix, slotIndex: number): void {
    this.setState(this.currentState.apply(this.expandOperator(operator, slotIndex)));
  }

  private assertFits(state: StateVector): void {
    if (state.dimension !== this.dimension) {
      throw new Error(
        `State of dimension ${String(state.dimension)} does not fit register of dimension ${String(this.dimension)}`,
      );
    }
    if (!state.isNormalized()) {
      throw new Error('Register state must be normalized');
    }
  }
}
