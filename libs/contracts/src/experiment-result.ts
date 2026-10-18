/* ExperimentResult: what a run produces, report values, outcome counts, histograms and the system report, in the shape the RunResult model stores. */
import type {
  EntangledState,
  ExperimentStep,
  ParameterDefinitions,
  PotentialKind,
  StateAmplitudes,
} from './experiment-plan.js';
import type { ParticleFamily, ParticleName } from './particle-spec.js';
import type { ParticleStatus } from './particle.js';
import type { DiagramView } from './lagrangian.js';
import type { LocalizedText } from './localized-text.js';
import type { ObservableName } from './quantum.js';
import type { Vector3 } from './vector.js';
import type { Phase, PhaseEstimateMethod } from './environment.js';

export type ReportValues = Record<string, number | null>;
export type OutcomeCounts = Record<string, Record<string, number>>;

export interface Distribution {
  readonly record: string;
  readonly binEdges: readonly number[];
  readonly counts: readonly number[];
  readonly samples: number;
  readonly mean: number;
  readonly standardDeviation: number;
}

export type Distributions = Record<string, Distribution>;

export interface OutcomeProbabilityView {
  readonly eigenvalue: number;
  readonly probability: number;
}

export interface QuantumSlotView {
  readonly observable: ObservableName;
  readonly dimension: number;
  readonly registerId: string;
  readonly sharesRegisterWith: readonly string[];
  readonly entangled: boolean;
  readonly purity: number;
  readonly entropyInBits: number;
  readonly blochVector: Vector3 | null;
  readonly basisPopulations: readonly number[];
  readonly registerState: RegisterState | null;
}

export interface RegisterState extends StateAmplitudes {
  readonly slots: readonly string[];
  readonly closestNamedState: EntangledState | null;
  readonly closestNamedStateFidelity: number | null;
}

export interface ParticleView {
  readonly label: string;
  readonly id: string;
  readonly name: ParticleName;
  readonly symbol: string;
  readonly family: ParticleFamily;
  readonly status: ParticleStatus;
  readonly massInGev: number;
  readonly chargeInElementaryUnits: number;
  readonly energyInGev: number;
  readonly momentumInGev: Vector3;
  readonly positionInFemtometers: Vector3;
  readonly properTimeInSeconds: number;
  readonly lorentzFactor: number | null;
  readonly quantum: readonly QuantumSlotView[];
  readonly readings?: Readonly<Record<string, number>>;
  readonly phase?: Phase;
  readonly phaseEstimated?: boolean;
  readonly phaseEstimateMethod?: PhaseEstimateMethod;
  readonly allotrope?: string;
}

export type SystemEventKind =
  | 'created'
  | 'entangled'
  | 'influenced'
  | 'evolved'
  | 'measured'
  | 'combined'
  | 'diffracted'
  | 'collided'
  | 'placed'
  | 'propagated'
  | 'positionMeasured'
  | 'annihilated'
  | 'hadronized'
  | 'systemMeasured'
  | 'decayed'
  | 'reacted'
  | 'phaseChanged';

export interface SystemEvent {
  readonly kind: SystemEventKind;
  readonly labels: readonly string[];
  readonly text: LocalizedText | string;
  readonly products?: readonly string[];
  readonly outcome?: number;
  readonly probabilitiesBefore?: readonly OutcomeProbabilityView[];
  readonly diagrams?: readonly DiagramView[];
}

export interface ConservedTotals {
  readonly chargeInElementaryUnits: number;
  readonly baryonNumber: number;
  readonly electronNumber: number;
  readonly muonNumber: number;
  readonly tauNumber: number;
  readonly energyInGev: number;
  readonly momentumInGev: Vector3;
}

export interface ProbabilityCloud {
  readonly label: string;
  readonly resolution: number;
  readonly density: readonly number[];
  readonly projectionResolution: number;
  readonly projectionXy: readonly number[];
  readonly projectionXz: readonly number[];
  readonly projectionYz: readonly number[];
  readonly meanPositionInMeters: Vector3;
  readonly spreadInMeters: Vector3;
  readonly probabilityInside: number;
  readonly energyInEv: number;
}

export interface SpaceSnapshot {
  readonly gridPointsPerAxis: number;
  readonly cellSizeInMeters: number;
  readonly edgeInMeters: number;
  readonly potential: PotentialKind;
  readonly potentialEnergyInEv: number;
  readonly barrierThicknessInMeters: number;
  readonly nuclearCharge: number;
  readonly slitSeparationInMeters?: number;
  readonly slitWidthInMeters?: number;
  readonly wellSeparationInMeters?: number;
  readonly boxSizeInMeters?: number;
  readonly clouds: readonly ProbabilityCloud[];
}

export interface EnvironmentRegionView {
  readonly id: number;
  readonly aspect: string;
  readonly value: unknown;
  readonly members: readonly string[];
}

export interface SystemFrame {
  readonly stepIndex: number;
  readonly step: ExperimentStep | null;
  readonly particles: readonly ParticleView[];
  readonly environment: Readonly<Record<string, unknown>>;
  readonly environmentOrder?: readonly string[];
  readonly regions?: readonly EnvironmentRegionView[];
  readonly events: readonly SystemEvent[];
  readonly totals: ConservedTotals;
  readonly space: SpaceSnapshot | null;
}

export interface SystemReport {
  readonly seed: number;
  readonly note: LocalizedText | string;
  readonly frames: readonly SystemFrame[];
}

export interface ExperimentResult {
  readonly planName: string;
  readonly shots: number;
  readonly seed: number;
  readonly parameters: ParameterDefinitions;
  readonly reportValues: ReportValues;
  readonly outcomeCounts: OutcomeCounts;
  readonly distributions: Distributions;
  readonly systemReport: SystemReport | null;
  readonly systemReports?: readonly SystemReport[];
  readonly elapsedMilliseconds: number;
  readonly stepMeanMilliseconds?: readonly number[];
  readonly stopped?: boolean;
  readonly requestedShots?: number;
}

export interface RunEstimate {
  readonly pilotShots: number;
  readonly firstShotMilliseconds: number;
  readonly meanShotMilliseconds: number;
  readonly stepMeanMilliseconds: readonly number[];
  readonly traceMilliseconds: number;
  readonly predictedMilliseconds: number;
}

export const RUN_PHASES = ['firstShot', 'shots', 'tracing'] as const;

export type RunPhase = (typeof RUN_PHASES)[number];

export interface RunProgress {
  readonly completedShots: number;
  readonly totalShots: number;
  readonly phase?: RunPhase;
  readonly meanShotMilliseconds?: number;
  readonly remainingMilliseconds?: number;
}
