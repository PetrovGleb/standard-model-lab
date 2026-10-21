/* Influence contracts: commands that act on particles or the environment, such as cool, heat, apply field, boost, evolve. */
import type { Environment } from './environment.js';
import type { LocalizedText } from './localized-text.js';
import type { Particle } from './particle.js';
import type { RandomSource } from './quantum.js';

export interface InfluenceContext {
  readonly environment: Environment;
  readonly random: RandomSource;
  readonly particlesById: ReadonlyMap<string, Particle>;
}

export interface InfluenceReaction {
  readonly parent: Particle;
  readonly products: readonly Particle[];
  readonly label: LocalizedText | string;
}

export interface InfluenceOutcome {
  readonly environment: Environment;
  readonly notes: readonly string[];
  readonly reactions?: readonly InfluenceReaction[];
}

export interface Influence<TContext extends InfluenceContext = InfluenceContext> {
  readonly name: string;
  readonly environmentOnly?: boolean;
  apply(targets: readonly Particle[], context: TContext): InfluenceOutcome;
}

export type InfluenceScalar = number | string | boolean;

export type InfluenceRecord = Readonly<Record<string, InfluenceScalar>>;

export type InfluenceParameterValue = InfluenceScalar | readonly InfluenceRecord[];

export type InfluenceParameters = Readonly<Record<string, InfluenceParameterValue>>;

export type InfluenceParameterKind = 'number' | 'particleName' | 'choice' | 'list' | 'text';

export interface InfluenceParameterSpec {
  readonly name: string;
  readonly kind: InfluenceParameterKind;
  readonly required: boolean;
  readonly defaultValue?: number | string;
  readonly choices?: readonly string[];
  readonly fields?: readonly InfluenceParameterSpec[];
}

export interface InfluenceDefinition {
  readonly name: string;
  readonly description: string;
  readonly parameters: readonly InfluenceParameterSpec[];
}
