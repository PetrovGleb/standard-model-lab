/* QuantumCore: the facade the experiment runner uses to prepare, entangle, measure and inspect particle observables. */
import type {
  EntangledState,
  MeasurementDirection,
  MeasurementRecord,
  Observable,
  ObservableName,
  Particle,
} from '@standard-model/contracts';
import { DensityMatrix } from './density-matrix.js';
import { ENTANGLED_STATE_DIMENSION, entangledState } from './entangled-states.js';
import { multiplyMatrices, type ComplexMatrix } from './linear-algebra.js';
import { Measurement, type OutcomeProbability } from './measurement.js';
import {
  normalizedObservableOperator,
  observableOperator,
  preparationState,
  type Preparation,
} from './observable-operators.js';
import type { QuantumRegister } from './quantum-register.js';
import type { QuantumRegisterManager } from './quantum-register-manager.js';
import { Z_DIRECTION } from './spin-operators.js';
import type { StateVector } from './state-vector.js';
import { LocalizedError, localizedText } from '@standard-model/contracts';

export interface ObservableTerm {
  readonly particle: Particle;
  readonly observable: ObservableName;
  readonly direction?: MeasurementDirection;
}

export class QuantumCore {
  constructor(
    readonly registers: QuantumRegisterManager,
    readonly measurement: Measurement,
  ) {}

  prepare(
    particle: Particle,
    observableName: ObservableName,
    preparation: Preparation,
  ): QuantumRegister {
    const observable = this.observableOf(particle, observableName);
    return this.registers.allocate(particle, observable, preparationState(observable, preparation));
  }

  entangle(
    pair: readonly [Particle, Particle],
    observableName: ObservableName,
    state: EntangledState | StateVector,
  ): QuantumRegister {
    const [first, second] = pair;
    const firstRegister = this.ensurePrepared(first, observableName);
    const secondRegister = this.ensurePrepared(second, observableName);
    if (
      firstRegister.id === secondRegister.id ||
      firstRegister.slots.length !== 1 ||
      secondRegister.slots.length !== 1
    ) {
      throw new LocalizedError(
        localizedText(
          'для запутывания нужны две частицы, еще ни с чем не запутанные',
          'entangle needs two particles that are not entangled with anything yet',
        ),
      );
    }
    const merged = this.registers.merge(firstRegister, secondRegister);
    if (merged.dimension !== ENTANGLED_STATE_DIMENSION) {
      throw new LocalizedError(
        localizedText(
          `${state} нужны две двухуровневые наблюдаемые`,
          `${state} needs two two-level observables`,
        ),
      );
    }
    const joint = typeof state === 'string' ? entangledState(state) : state.normalized();
    if (joint.dimension !== merged.dimension) {
      throw new Error('entangled state dimension does not match the pair');
    }
    merged.setState(joint);
    return merged;
  }

  measure(
    particle: Particle,
    observableName: ObservableName,
    direction: MeasurementDirection = Z_DIRECTION,
  ): MeasurementRecord {
    const register = this.registers.registerOf(particle, observableName);
    const slotIndex = register.slotIndexOf(particle.id, observableName);
    const operator = observableOperator(this.observableOf(particle, observableName), direction);
    return this.measurement.measure(register, slotIndex, operator);
  }

  probabilities(
    particle: Particle,
    observableName: ObservableName,
    direction: MeasurementDirection = Z_DIRECTION,
  ): readonly OutcomeProbability[] {
    const register = this.registers.registerOf(particle, observableName);
    const slotIndex = register.slotIndexOf(particle.id, observableName);
    const operator = observableOperator(this.observableOf(particle, observableName), direction);
    return this.measurement.probabilities(register, slotIndex, operator);
  }

  expectation(
    particle: Particle,
    observableName: ObservableName,
    direction: MeasurementDirection = Z_DIRECTION,
  ): number {
    const register = this.registers.registerOf(particle, observableName);
    const slotIndex = register.slotIndexOf(particle.id, observableName);
    const operator = observableOperator(this.observableOf(particle, observableName), direction);
    return this.measurement.expectation(register, slotIndex, operator);
  }

  correlation(terms: readonly ObservableTerm[]): number {
    const [firstTerm] = terms;
    if (firstTerm === undefined) {
      throw new Error('correlation needs at least one term');
    }
    const register = this.registers.registerOf(firstTerm.particle, firstTerm.observable);
    const product = terms
      .map((term) => this.expandedNormalizedOperator(register, term))
      .reduce((accumulated, operator) => multiplyMatrices(accumulated, operator));
    return register.state.expectation(product);
  }

  stateOf(particle: Particle, observableName: ObservableName): StateVector {
    return this.registers.registerOf(particle, observableName).state;
  }

  reducedStateOf(particle: Particle, observableName: ObservableName): DensityMatrix {
    const register = this.registers.registerOf(particle, observableName);
    const slotIndex = register.slotIndexOf(particle.id, observableName);
    return DensityMatrix.fromPureState(register.state).partialTrace(register.dimensions, slotIndex);
  }

  release(particle: Particle, observableName: ObservableName): void {
    this.registers.dispose(this.registers.registerOf(particle, observableName));
  }

  private ensurePrepared(particle: Particle, observableName: ObservableName): QuantumRegister {
    if (particle.quantumSlot(observableName) === null) {
      return this.prepare(particle, observableName, 0);
    }
    return this.registers.registerOf(particle, observableName);
  }

  private expandedNormalizedOperator(
    register: QuantumRegister,
    term: ObservableTerm,
  ): ComplexMatrix {
    const slotIndex = register.slotIndexOf(term.particle.id, term.observable);
    const operator = normalizedObservableOperator(
      this.observableOf(term.particle, term.observable),
      term.direction ?? Z_DIRECTION,
    );
    return register.expandOperator(operator, slotIndex);
  }

  private observableOf(particle: Particle, observableName: ObservableName): Observable {
    const observable = particle.observables.find((candidate) => candidate.name === observableName);
    if (observable === undefined) {
      throw new LocalizedError(
        localizedText(
          `у ${particle.spec.name} ${particle.id} нет наблюдаемой ${observableName}`,
          `${particle.spec.name} ${particle.id} has no ${observableName} observable`,
        ),
      );
    }
    return observable;
  }
}
