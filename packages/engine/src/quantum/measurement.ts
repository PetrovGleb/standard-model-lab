/* Measurement: shared projective measurement on a register slot by the Born rule, with the collapse delegated to an injected strategy and expanded projectors cached. */
import type {
  CollapseStrategy,
  MeasurementCandidate,
  MeasurementRecord,
  RandomSource,
} from '@standard-model/contracts';
import { spectralDecomposition, type ComplexMatrix } from './linear-algebra.js';
import type { QuantumRegister } from './quantum-register.js';
import type { StateVector } from './state-vector.js';

const NEGLIGIBLE_PROBABILITY = 1e-15;
const PROBABILITY_SUM_TOLERANCE = 1e-9;

interface ExpandedComponent {
  readonly eigenvalue: number;
  readonly projector: ComplexMatrix;
}

export interface OutcomeProbability {
  readonly outcomeIndex: number;
  readonly eigenvalue: number;
  readonly probability: number;
}

function fingerprint(
  register: QuantumRegister,
  slotIndex: number,
  operator: ComplexMatrix,
): string {
  return `${register.dimensions.join('x')}|${String(slotIndex)}|${operator.real.join(',')}|${operator.imaginary.join(',')}`;
}

export class Measurement {
  private readonly expandedCache = new Map<string, readonly ExpandedComponent[]>();

  constructor(
    private readonly collapse: CollapseStrategy<StateVector>,
    private readonly random: RandomSource,
  ) {}

  candidates(
    register: QuantumRegister,
    slotIndex: number,
    operator: ComplexMatrix,
  ): readonly MeasurementCandidate<StateVector>[] {
    const components = this.expandedComponents(register, slotIndex, operator);
    const candidates: MeasurementCandidate<StateVector>[] = [];
    let total = 0;
    components.forEach((component, outcomeIndex) => {
      const projected = register.state.apply(component.projector);
      const probability = projected.norm() ** 2;
      total += probability;
      if (probability > NEGLIGIBLE_PROBABILITY) {
        candidates.push({
          outcomeIndex,
          eigenvalue: component.eigenvalue,
          probability,
          postMeasurementState: projected.normalized(),
        });
      }
    });
    if (Math.abs(total - 1) > PROBABILITY_SUM_TOLERANCE) {
      throw new Error(`Outcome probabilities sum to ${String(total)}, state is not normalized`);
    }
    return candidates;
  }

  probabilities(
    register: QuantumRegister,
    slotIndex: number,
    operator: ComplexMatrix,
  ): readonly OutcomeProbability[] {
    return this.candidates(register, slotIndex, operator).map((candidate) => ({
      outcomeIndex: candidate.outcomeIndex,
      eigenvalue: candidate.eigenvalue,
      probability: candidate.probability,
    }));
  }

  expectation(register: QuantumRegister, slotIndex: number, operator: ComplexMatrix): number {
    return register.state.expectation(register.expandOperator(operator, slotIndex));
  }

  measure(
    register: QuantumRegister,
    slotIndex: number,
    operator: ComplexMatrix,
  ): MeasurementRecord {
    const slot = register.slots[slotIndex];
    if (slot === undefined) {
      throw new Error(`Register ${register.id} has no slot ${String(slotIndex)}`);
    }
    const chosen = this.collapse.choose(
      this.candidates(register, slotIndex, operator),
      this.random,
    );
    register.setState(chosen.postMeasurementState);
    return {
      particleId: slot.particleId,
      observable: slot.observable,
      outcomeIndex: chosen.outcomeIndex,
      eigenvalue: chosen.eigenvalue,
      probability: chosen.probability,
    };
  }

  private expandedComponents(
    register: QuantumRegister,
    slotIndex: number,
    operator: ComplexMatrix,
  ): readonly ExpandedComponent[] {
    const key = fingerprint(register, slotIndex, operator);
    const cached = this.expandedCache.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const expanded = spectralDecomposition(operator).map((component) => ({
      eigenvalue: component.eigenvalue,
      projector: register.expandOperator(component.projector, slotIndex),
    }));
    this.expandedCache.set(key, expanded);
    return expanded;
  }
}
