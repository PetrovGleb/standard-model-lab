/* Boson: integer spin particles; guards the spin invariant every boson subclass relies on. */
import type { ParticleSpec } from '@standard-model/contracts';
import { AbstractParticle, type ParticleBuildContext } from './abstract-particle.js';

export abstract class Boson extends AbstractParticle {
  constructor(spec: ParticleSpec, context: ParticleBuildContext) {
    super(spec, context);
    if (!Number.isInteger(spec.spinInReducedPlanckUnits)) {
      throw new Error(`${spec.name} is not a boson: spin ${String(spec.spinInReducedPlanckUnits)}`);
    }
  }
}
