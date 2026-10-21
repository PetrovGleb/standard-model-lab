/* Environment contracts: an open set of named aspects, each bringing Hamiltonian and decoherence contributions; extend by module augmentation of EnvironmentAspects. A medium may fill a body
   of a given shape, centre and size, and the bodies aspect holds several such media placed in space at once. */
import type { ParticleName } from './particle-spec.js';
import type { Particle } from './particle.js';
import type { ObservableName } from './quantum.js';
import type { Vector3 } from './vector.js';

export interface TemperatureAspect {
  readonly temperatureInKelvin: number;
}

export interface MagneticFieldAspect {
  readonly fieldInTesla: Vector3;
}

export interface ElectricFieldAspect {
  readonly fieldInVoltsPerMeter: Vector3;
}

export const MEDIUM_REACTION_MODES = ['oneReactionPerStep', 'allReactionsInStep'] as const;

export type MediumReactionMode = (typeof MEDIUM_REACTION_MODES)[number];

export interface MediumComponent {
  readonly species: ParticleName;
  readonly numberDensityPerCubicMeter: number;
  readonly crossSectionInSquareMeters: number;
}

export const BODY_SHAPES = ['ball', 'box'] as const;

export type BodyShape = (typeof BODY_SHAPES)[number];

export interface BodyGeometry {
  readonly shape: BodyShape;
  readonly centerInMeters: Vector3;
  readonly sizeInMeters: number;
}

export interface MediumAspect {
  readonly components: readonly MediumComponent[];
  readonly temperatureInKelvin: number;
  readonly bulkVelocityInMetersPerSecond: Vector3;
  readonly reactionMode: MediumReactionMode;
  readonly pressureInPascals?: number;
  readonly radiationTemperatureInKelvin?: number;
  readonly thicknessInMeters?: number;
  readonly geometry?: BodyGeometry;
  readonly absorbedEnergyInJoules?: number;
}

export interface BodiesAspect {
  readonly bodies: readonly MediumAspect[];
}

export const PHASES = [
  'solid',
  'liquid',
  'gas',
  'supercritical',
  'plasma',
  'solvated',
  'quarkGluonPlasma',
  'decomposed',
] as const;

export type Phase = (typeof PHASES)[number];

export type PhaseEstimateMethod = 'groupContribution' | 'lennardJones';

export interface NeutrinoMixingAspect {
  readonly mixingAngle12SinSquared: number;
  readonly mixingAngle13SinSquared: number;
  readonly mixingAngle23SinSquared: number;
  readonly massSquaredDifference21InElectronVoltsSquared: number;
  readonly massSquaredDifference31InElectronVoltsSquared: number;
}

export interface CoherenceTimesAspect {
  readonly dephasingTimeInSeconds: number | null;
  readonly relaxationTimeInSeconds: number | null;
}

export interface NeighborAspect {
  readonly particleIds: readonly string[];
}

export interface EnvironmentAspects {
  temperature: TemperatureAspect;
  magneticField: MagneticFieldAspect;
  electricField: ElectricFieldAspect;
  medium: MediumAspect;
  bodies: BodiesAspect;
  neighbors: NeighborAspect;
  coherenceTimes: CoherenceTimesAspect;
  neutrinoMixing: NeutrinoMixingAspect;
}

export type EnvironmentAspectKey = keyof EnvironmentAspects;

export interface Environment {
  readonly aspectKeys: readonly EnvironmentAspectKey[];
  get<TKey extends EnvironmentAspectKey>(key: TKey): EnvironmentAspects[TKey] | undefined;
  with<TKey extends EnvironmentAspectKey>(key: TKey, value: EnvironmentAspects[TKey]): Environment;
  without(key: EnvironmentAspectKey): Environment;
}

export interface HamiltonianTerm<TOperator> {
  readonly observable: ObservableName;
  readonly operatorInRadiansPerSecond: TOperator;
}

export interface HamiltonianContributor<TOperator> {
  readonly aspectKey: EnvironmentAspectKey | null;
  contribute(environment: Environment, particle: Particle): readonly HamiltonianTerm<TOperator>[];
}

export interface DecoherenceRates {
  readonly dephasingRateInHertz: number;
  readonly relaxationRateInHertz: number;
}

export interface DecoherenceContributor {
  readonly aspectKey: EnvironmentAspectKey;
  rates(environment: Environment, particle: Particle): DecoherenceRates;
}

export interface DecoherenceInput<TState, TOperator> {
  readonly state: TState;
  readonly slotDimensions: readonly number[];
  readonly slotIndex: number;
  readonly slotHamiltonianInRadiansPerSecond: TOperator | null;
  readonly rates: DecoherenceRates;
  readonly durationInSeconds: number;
}

export interface DecoherenceModel<TState, TOperator> {
  readonly name: string;
  apply(input: DecoherenceInput<TState, TOperator>): TState;
}
