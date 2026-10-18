/* CompositeParticle: bound state holding live constituent particles; charge is checked against them and interactions are their union. */
import type {
  Composite,
  ElectricallyCharged,
  InteractionKind,
  Particle,
  ParticleSpec,
} from '@standard-model/contracts';
import { AbstractParticle, type ParticleBuildContext } from './abstract-particle.js';

const CHARGE_TOLERANCE = 1e-12;

export abstract class CompositeParticle
  extends AbstractParticle
  implements Composite, ElectricallyCharged
{
  readonly constituents: readonly Particle[];

  constructor(spec: ParticleSpec, context: ParticleBuildContext) {
    super(spec, context);
    const expectedCount = spec.constituents?.length ?? 0;
    if (context.constituents.length !== expectedCount) {
      throw new Error(
        `${spec.name} expects ${String(expectedCount)} constituents, got ${String(context.constituents.length)}`,
      );
    }
    const constituentCharge = context.constituents.reduce(
      (sum, constituent) => sum + constituent.spec.electricChargeInElementaryUnits,
      0,
    );
    if (Math.abs(constituentCharge - spec.electricChargeInElementaryUnits) > CHARGE_TOLERANCE) {
      throw new Error(`${spec.name} constituents do not add up to its charge`);
    }
    this.constituents = context.constituents;
  }

  get electricChargeInElementaryUnits(): number {
    return this.spec.electricChargeInElementaryUnits;
  }

  protected override deriveInteractions(): readonly InteractionKind[] {
    const kinds = new Set<InteractionKind>(super.deriveInteractions());
    this.constituents.forEach((constituent) => {
      constituent.interactions.forEach((kind) => kinds.add(kind));
    });
    return [...kinds];
  }
}
