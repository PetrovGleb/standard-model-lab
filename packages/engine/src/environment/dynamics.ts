/* Dynamics: sums Hamiltonian and decoherence contributions for a particle in an environment and evolves it in time, including electric kicks and proper time. */
import { BOLTZMANN_CONSTANT_IN_EV_PER_KELVIN, ELEMENTARY_CHARGE } from '@standard-model/constants';
import type {
  DecoherenceContributor,
  DecoherenceModel,
  DecoherenceRates,
  Environment,
  HamiltonianContributor,
  ObservableName,
  Particle,
} from '@standard-model/contracts';
import {
  addVectors,
  angularFrequencyToEnergyInEv,
  FEMTOMETERS_PER_METER,
  momentumSiToGev,
  scaleVector,
  velocityInMetersPerSecond,
} from '@standard-model/utils';
import { isElectricallyCharged } from '../particles/capabilities.js';
import {
  addMatrices,
  complexPhase,
  hermitianFunction,
  spectralDecomposition,
  type ComplexMatrix,
} from '../quantum/linear-algebra.js';
import type { QuantumCore } from '../quantum/quantum-core.js';
import type { StateVector } from '../quantum/state-vector.js';
import { collisionRatePerSecond } from './collisional-decoherence-contributor.js';

export interface ThermalPopulation {
  readonly eigenvalueInRadiansPerSecond: number;
  readonly multiplicity: number;
  readonly probability: number;
}

export class Dynamics {
  constructor(
    private readonly quantum: QuantumCore,
    private readonly hamiltonianContributors: readonly HamiltonianContributor<ComplexMatrix>[],
    private readonly decoherenceContributors: readonly DecoherenceContributor[],
    private readonly decoherenceModel: DecoherenceModel<StateVector, ComplexMatrix>,
  ) {}

  slotHamiltonian(
    particle: Particle,
    observable: ObservableName,
    environment: Environment,
  ): ComplexMatrix | null {
    const operators = this.hamiltonianContributors
      .flatMap((contributor) => contributor.contribute(environment, particle))
      .filter((term) => term.observable === observable)
      .map((term) => term.operatorInRadiansPerSecond);
    const [first, ...rest] = operators;
    if (first === undefined) {
      return null;
    }
    return rest.reduce((sum, operator) => addMatrices(sum, operator), first);
  }

  decoherenceRates(particle: Particle, environment: Environment): DecoherenceRates {
    return this.decoherenceContributors.reduce<DecoherenceRates>(
      (total, contributor) => {
        const rates = contributor.rates(environment, particle);
        return {
          dephasingRateInHertz: total.dephasingRateInHertz + rates.dephasingRateInHertz,
          relaxationRateInHertz: total.relaxationRateInHertz + rates.relaxationRateInHertz,
        };
      },
      { dephasingRateInHertz: 0, relaxationRateInHertz: 0 },
    );
  }

  collisionRatePerSecond(particle: Particle, environment: Environment): number {
    const medium = environment.get('medium');
    return medium === undefined ? 0 : collisionRatePerSecond(medium, particle);
  }

  thermalPopulations(
    particle: Particle,
    observable: ObservableName,
    environment: Environment,
  ): readonly ThermalPopulation[] {
    const temperature = environment.get('temperature');
    if (temperature === undefined) {
      throw new Error('Thermal populations need a temperature aspect');
    }
    const hamiltonian = this.slotHamiltonian(particle, observable, environment);
    const dimension = particle.observables.find(
      (candidate) => candidate.name === observable,
    )?.dimension;
    if (dimension === undefined) {
      throw new Error(`${particle.id} has no ${observable} observable`);
    }
    if (hamiltonian === null) {
      return [{ eigenvalueInRadiansPerSecond: 0, multiplicity: dimension, probability: 1 }];
    }
    const thermalEnergyInEv =
      BOLTZMANN_CONSTANT_IN_EV_PER_KELVIN.value * temperature.temperatureInKelvin;
    const components = spectralDecomposition(hamiltonian);
    const lowest = Math.min(...components.map((component) => component.eigenvalue));
    const weights = components.map(
      (component) =>
        component.multiplicity *
        Math.exp(-angularFrequencyToEnergyInEv(component.eigenvalue - lowest) / thermalEnergyInEv),
    );
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    return components.map((component, index) => ({
      eigenvalueInRadiansPerSecond: component.eigenvalue,
      multiplicity: component.multiplicity,
      probability: (weights[index] ?? 0) / total,
    }));
  }

  evolve(particle: Particle, environment: Environment, durationInSeconds: number): void {
    if (durationInSeconds < 0) {
      throw new Error('Duration cannot be negative');
    }
    const rates = this.decoherenceRates(particle, environment);
    particle.quantumSlots.forEach((slot, observable) => {
      const register = this.quantum.registers.byId(slot.registerId);
      const hamiltonian = this.slotHamiltonian(particle, observable, environment);
      if (hamiltonian !== null) {
        const evolution = hermitianFunction(hamiltonian, (frequency) =>
          complexPhase(-frequency * durationInSeconds),
        );
        register.applyOnSlot(evolution, slot.slotIndex);
      }
      if (rates.dephasingRateInHertz > 0 || rates.relaxationRateInHertz > 0) {
        register.setState(
          this.decoherenceModel.apply({
            state: register.state,
            slotDimensions: register.dimensions,
            slotIndex: slot.slotIndex,
            slotHamiltonianInRadiansPerSecond: hamiltonian,
            rates,
            durationInSeconds,
          }),
        );
      }
    });
    this.translate(particle, durationInSeconds);
    this.applyElectricKick(particle, environment, durationInSeconds);
    const lorentzFactor =
      particle.kinematics.fourMomentumInGev.energy / particle.spec.massInGev.value;
    particle.advanceProperTime(
      Number.isFinite(lorentzFactor) ? durationInSeconds / lorentzFactor : 0,
    );
  }

  private translate(particle: Particle, durationInSeconds: number): void {
    const velocity = velocityInMetersPerSecond(
      particle.spec.massInGev.value,
      particle.kinematics.fourMomentumInGev.momentum,
    );
    const displacementInFemtometers = scaleVector(
      velocity,
      durationInSeconds * FEMTOMETERS_PER_METER,
    );
    particle.setPosition(
      addVectors(particle.kinematics.positionInFemtometers, displacementInFemtometers),
    );
  }

  private applyElectricKick(
    particle: Particle,
    environment: Environment,
    durationInSeconds: number,
  ): void {
    const field = environment.get('electricField');
    if (
      field === undefined ||
      !isElectricallyCharged(particle) ||
      particle.electricChargeInElementaryUnits === 0
    ) {
      return;
    }
    const impulseInSi =
      particle.electricChargeInElementaryUnits * ELEMENTARY_CHARGE.value * durationInSeconds;
    const kick = scaleVector(field.fieldInVoltsPerMeter, momentumSiToGev(impulseInSi));
    particle.setMomentum(addVectors(particle.kinematics.fourMomentumInGev.momentum, kick));
  }
}
