/* Particle influences: boost kinematics, rotate a spin, thermalize a slot by Boltzmann sampling, evolve in time through Dynamics. */
import type {
  Influence,
  InfluenceOutcome,
  MeasurementDirection,
  ObservableName,
  Particle,
  Vector3,
} from '@standard-model/contracts';
import {
  sampleIndexByWeights,
  vectorMagnitude,
  velocityInMetersPerSecond,
} from '@standard-model/utils';
import {
  eigenvectorFromRankOneProjector,
  spectralDecomposition,
} from '../quantum/linear-algebra.js';
import { directionalObservableOf } from '../particles/capabilities.js';
import { haarRandomState, randomStateInSubspace } from '../quantum/random-states.js';
import { rotationAboutDirection, spinFromDimension } from '../quantum/spin-operators.js';
import { StateVector } from '../quantum/state-vector.js';
import { unchanged, type EngineInfluenceContext } from './context.js';
import { LocalizedError, localizedText } from '@standard-model/contracts';

export class Boost implements Influence<EngineInfluenceContext> {
  readonly name = 'boost';

  constructor(private readonly velocityFraction: Vector3) {}

  apply(targets: readonly Particle[], context: EngineInfluenceContext): InfluenceOutcome {
    targets.forEach((particle) => particle.boost(this.velocityFraction));
    return unchanged(context);
  }
}

export class RotateSpin implements Influence<EngineInfluenceContext> {
  readonly name = 'rotateSpin';

  constructor(
    private readonly axis: MeasurementDirection,
    private readonly angleRadians: number,
  ) {}

  apply(targets: readonly Particle[], context: EngineInfluenceContext): InfluenceOutcome {
    targets.forEach((particle) => {
      const slot = ensureSlot(particle, spinObservableOf(particle), context);
      const rotation = rotationAboutDirection(
        spinFromDimension(slot.dimension),
        this.axis,
        this.angleRadians,
      );
      context.quantum.registers.byId(slot.registerId).applyOnSlot(rotation, slot.slotIndex);
    });
    return unchanged(context);
  }
}

function spinObservableOf(particle: Particle): ObservableName {
  const observable = directionalObservableOf(particle.spec);
  if (observable === null) {
    throw new LocalizedError(
      localizedText(
        `у ${particle.spec.name} спин 0: нет ни спина, ни поляризации`,
        `${particle.spec.name} has spin 0: there is no spin or polarization`,
      ),
    );
  }
  return observable;
}

function ensureSlot(
  particle: Particle,
  observable: ObservableName,
  context: EngineInfluenceContext,
) {
  const existing = particle.quantumSlot(observable);
  if (existing !== null) {
    return existing;
  }
  context.quantum.prepare(particle, observable, 0);
  const prepared = particle.quantumSlot(observable);
  if (prepared === null) {
    throw new Error(`${particle.id} could not prepare ${observable}`);
  }
  return prepared;
}

export class Thermalize implements Influence<EngineInfluenceContext> {
  readonly name = 'thermalize';

  constructor(private readonly requestedObservable?: ObservableName) {}

  apply(targets: readonly Particle[], context: EngineInfluenceContext): InfluenceOutcome {
    targets.forEach((particle) => {
      const observable = this.requestedObservable ?? spinObservableOf(particle);
      const slot = ensureSlot(particle, observable, context);
      const register = context.quantum.registers.byId(slot.registerId);
      if (register.slots.length !== 1) {
        throw new LocalizedError(
          localizedText(
            `${particle.id} запутана; термализация работает только с незапутанными частицами`,
            `${particle.id} is entangled; thermalize works on unentangled particles`,
          ),
        );
      }
      const populations = context.dynamics.thermalPopulations(
        particle,
        observable,
        context.environment,
      );
      const hamiltonian = context.dynamics.slotHamiltonian(
        particle,
        observable,
        context.environment,
      );
      if (hamiltonian === null) {
        register.setState(
          StateVector.basis(slot.dimension, Math.floor(context.random.nextUnit() * slot.dimension)),
        );
        return;
      }
      const components = spectralDecomposition(hamiltonian);
      const chosen =
        components[
          sampleIndexByWeights(
            populations.map((population) => population.probability),
            context.random,
          )
        ];
      if (chosen === undefined) {
        throw new Error('No energy level to thermalize into');
      }
      register.setState(
        chosen.multiplicity === 1
          ? StateVector.fromColumn(eigenvectorFromRankOneProjector(chosen.projector))
          : randomStateInSubspace(chosen.projector, context.random),
      );
    });
    return unchanged(context);
  }
}

export class Randomize implements Influence<EngineInfluenceContext> {
  readonly name = 'randomize';

  constructor(private readonly requestedObservable?: ObservableName) {}

  apply(targets: readonly Particle[], context: EngineInfluenceContext): InfluenceOutcome {
    targets.forEach((particle) => {
      const observable = this.requestedObservable ?? spinObservableOf(particle);
      const slot = ensureSlot(particle, observable, context);
      const register = context.quantum.registers.byId(slot.registerId);
      if (register.slots.length !== 1) {
        throw new LocalizedError(
          localizedText(
            `${particle.id} запутана; случайное состояние задается только незапутанным частицам`,
            `${particle.id} is entangled; randomize works on unentangled particles`,
          ),
        );
      }
      register.setState(haarRandomState(slot.dimension, context.random));
    });
    return unchanged(context);
  }
}

export class Travel implements Influence<EngineInfluenceContext> {
  readonly name = 'travel';

  constructor(private readonly distanceInMeters: number) {}

  apply(targets: readonly Particle[], context: EngineInfluenceContext): InfluenceOutcome {
    targets.forEach((particle) => {
      const speed = vectorMagnitude(
        velocityInMetersPerSecond(
          particle.spec.massInGev.value,
          particle.kinematics.fourMomentumInGev.momentum,
        ),
      );
      if (speed === 0) {
        throw new LocalizedError(
          localizedText(
            `${particle.id} покоится и не может пролететь расстояние: задайте импульс при создании или сначала сделайте буст`,
            `${particle.id} is at rest and cannot travel: give it momentum in create or boost it first`,
          ),
        );
      }
      context.dynamics.evolve(particle, context.environment, this.distanceInMeters / speed);
    });
    return unchanged(context);
  }
}

export class Evolve implements Influence<EngineInfluenceContext> {
  readonly name = 'evolve';

  constructor(private readonly durationInSeconds: number) {}

  apply(targets: readonly Particle[], context: EngineInfluenceContext): InfluenceOutcome {
    targets.forEach((particle) =>
      context.dynamics.evolve(particle, context.environment, this.durationInSeconds),
    );
    return unchanged(context);
  }
}
