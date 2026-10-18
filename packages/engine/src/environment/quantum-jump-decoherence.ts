/* QuantumJumpDecoherence: per-shot Kraus trajectories; dephasing is an unrecorded basis measurement, relaxation a jump to the slot Hamiltonian ground state. */
import type { DecoherenceInput, DecoherenceModel, RandomSource } from '@standard-model/contracts';
import { dephasingKraus, relaxationKraus, sampleKrausTrajectory } from '../quantum/kraus.js';
import {
  eigenvectorFromRankOneProjector,
  spectralDecomposition,
  type ComplexMatrix,
} from '../quantum/linear-algebra.js';
import { expandOperatorToSlots } from '../quantum/quantum-register.js';
import type { StateVector } from '../quantum/state-vector.js';
import { LocalizedError, localizedText } from '@standard-model/contracts';

export function jumpProbability(ratePerSecond: number, durationInSeconds: number): number {
  return 1 - Math.exp(-ratePerSecond * durationInSeconds);
}

export function relaxationKrausForHamiltonian(
  hamiltonian: ComplexMatrix,
  probability: number,
): readonly ComplexMatrix[] {
  const components = spectralDecomposition(hamiltonian);
  if (components.some((component) => component.multiplicity > 1)) {
    throw new LocalizedError(
      localizedText(
        'релаксации нужны невырожденные уровни энергии',
        'Relaxation needs non-degenerate energy levels on the slot',
      ),
    );
  }
  const eigenvectors = components.map((component) =>
    eigenvectorFromRankOneProjector(component.projector),
  );
  const groundIndex = components.reduce(
    (lowest, component, index) =>
      component.eigenvalue < (components[lowest]?.eigenvalue ?? Infinity) ? index : lowest,
    0,
  );
  return relaxationKraus(eigenvectors, groundIndex, probability);
}

export class QuantumJumpDecoherence implements DecoherenceModel<StateVector, ComplexMatrix> {
  readonly name = 'quantumJump';

  constructor(private readonly random: RandomSource) {}

  apply(input: DecoherenceInput<StateVector, ComplexMatrix>): StateVector {
    const dimension = input.slotDimensions[input.slotIndex];
    if (dimension === undefined) {
      throw new Error(`No slot ${String(input.slotIndex)}`);
    }
    let state = input.state;
    const dephasing = jumpProbability(input.rates.dephasingRateInHertz, input.durationInSeconds);
    if (dephasing > 0) {
      state = this.applyChannel(state, dephasingKraus(dimension, dephasing), input);
    }
    const relaxation = jumpProbability(input.rates.relaxationRateInHertz, input.durationInSeconds);
    if (relaxation > 0) {
      if (input.slotHamiltonianInRadiansPerSecond === null) {
        throw new Error(
          'Relaxation (T1) needs split energy levels to define the ground state: apply a magnetic field first or set only the dephasing time',
        );
      }
      state = this.applyChannel(
        state,
        relaxationKrausForHamiltonian(input.slotHamiltonianInRadiansPerSecond, relaxation),
        input,
      );
    }
    return state;
  }

  private applyChannel(
    state: StateVector,
    krausOperators: readonly ComplexMatrix[],
    input: DecoherenceInput<StateVector, ComplexMatrix>,
  ): StateVector {
    const expanded = krausOperators.map((kraus) =>
      expandOperatorToSlots(kraus, input.slotDimensions, input.slotIndex),
    );
    return sampleKrausTrajectory(state, expanded, this.random);
  }
}
