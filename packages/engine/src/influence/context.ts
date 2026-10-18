/* EngineInfluenceContext: the influence context enriched with the quantum core and dynamics services. */
import type { InfluenceContext, InfluenceOutcome } from '@standard-model/contracts';
import type { Dynamics } from '../environment/dynamics.js';
import type { ParticleFactory } from '../particles/particle-factory.js';
import type { QuantumCore } from '../quantum/quantum-core.js';

export interface EngineInfluenceContext extends InfluenceContext {
  readonly quantum: QuantumCore;
  readonly dynamics: Dynamics;
  readonly particles: ParticleFactory;
}

export function unchanged(
  context: InfluenceContext,
  notes: readonly string[] = [],
): InfluenceOutcome {
  return { environment: context.environment, notes };
}
