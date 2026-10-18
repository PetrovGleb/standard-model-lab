/* Fermion: half-integer spin particles; guards the spin invariant every fermion subclass relies on. */
import type { ParticleSpec } from '@standard-model/contracts';
import { AbstractParticle, type ParticleBuildContext } from './abstract-particle.js';

function isHalfInteger(spin: number): boolean {
  return Number.isInteger(spin * 2) && !Number.isInteger(spin);
}

export abstract class Fermion extends AbstractParticle {
  constructor(spec: ParticleSpec, context: ParticleBuildContext) {
    super(spec, context);
    if (!isHalfInteger(spec.spinInReducedPlanckUnits)) {
      throw new Error(
        `${spec.name} is not a fermion: spin ${String(spec.spinInReducedPlanckUnits)}`,
      );
    }
  }
}
