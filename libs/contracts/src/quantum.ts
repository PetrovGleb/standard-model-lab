/* Quantum contracts: seeded randomness, observables, register slots and the injectable collapse strategy used by the shared Measurement service. */
export interface RandomSource {
  readonly seed: number;
  nextUnit(): number;
}

export const OBSERVABLE_NAMES = ['spin', 'polarization', 'flavor'] as const;
export type ObservableName = (typeof OBSERVABLE_NAMES)[number];

export interface Observable {
  readonly name: ObservableName;
  readonly dimension: number;
}

export interface QuantumSlot {
  readonly registerId: string;
  readonly slotIndex: number;
  readonly dimension: number;
  readonly observable: ObservableName;
}

export interface MeasurementDirection {
  readonly polarAngleDegrees: number;
  readonly azimuthDegrees: number;
}

export interface MeasurementCandidate<TState> {
  readonly outcomeIndex: number;
  readonly eigenvalue: number;
  readonly probability: number;
  readonly postMeasurementState: TState;
}

export interface CollapseStrategy<TState> {
  readonly name: string;
  choose(
    candidates: readonly MeasurementCandidate<TState>[],
    random: RandomSource,
  ): MeasurementCandidate<TState>;
}

export interface MeasurementRecord {
  readonly particleId: string;
  readonly observable: ObservableName;
  readonly outcomeIndex: number;
  readonly eigenvalue: number;
  readonly probability: number;
}
