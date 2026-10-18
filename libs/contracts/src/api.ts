/* API contracts: request and response shapes shared by the NestJS API and the web client. */
import type { ExperimentPlan, ParameterDefinitions, TemplateCategory } from './experiment-plan.js';
import type { ExperimentResult, RunProgress } from './experiment-result.js';
import type { InfluenceDefinition } from './influence.js';
import type { ParticleName, ParticleSpec } from './particle-spec.js';
import type { Observable } from './quantum.js';
import type { RunStatus } from './run-status.js';
import type { Language, LocalizedText } from './localized-text.js';

export type TemplateSource = 'builtIn' | 'saved';

export interface TemplateComplexity {
  readonly firstShotMilliseconds?: number;
  readonly meanShotMilliseconds: number;
  readonly stepShares: readonly number[];
}

export interface TemplateSummary {
  readonly name: string;
  readonly description: string | null;
  readonly source: TemplateSource;
  readonly categories: readonly TemplateCategory[];
  readonly parameters: ParameterDefinitions;
  readonly shots: number;
  readonly stepCount: number;
  readonly complexity?: TemplateComplexity;
}

export interface TemplateDetail {
  readonly template: ExperimentPlan;
  readonly source: TemplateSource;
}

export interface TemplateListResponse {
  readonly templates: readonly TemplateSummary[];
}

export interface SaveTemplateRequest {
  readonly plan: ExperimentPlan;
}

export interface ValidatePlanRequest {
  readonly plan: unknown;
}

export interface ValidatePlanResponse {
  readonly valid: boolean;
  readonly errors: readonly (LocalizedText | string)[];
}

export interface StartRunRequest {
  readonly template?: string;
  readonly plan?: ExperimentPlan;
  readonly parameters?: Partial<ParameterDefinitions>;
  readonly shots?: number;
  readonly seed?: number;
  readonly language?: Language;
}

export interface RunSummary {
  readonly id: string;
  readonly planName: string;
  readonly templateName: string | null;
  readonly shots: number;
  readonly seed: number;
  readonly status: RunStatus;
  readonly parameters: ParameterDefinitions;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
  readonly errorMessage: string | null;
  readonly elapsedMilliseconds: number | null;
}

export interface RunDetail {
  readonly run: RunSummary;
  readonly result: ExperimentResult | null;
}

export interface RunListResponse {
  readonly runs: readonly RunSummary[];
}

export interface ParticleCatalogEntry extends ParticleSpec {
  readonly observables: readonly Observable[];
}

export interface Preset {
  readonly label: LocalizedText | string;
  readonly value: number;
  readonly note: LocalizedText | string;
}

export interface PresetCatalog {
  readonly momentumInGev: readonly Preset[];
  readonly momentumInGevByParticle: Readonly<Partial<Record<ParticleName, readonly Preset[]>>>;
  readonly durationInSeconds: readonly Preset[];
  readonly magneticFieldInTesla: readonly Preset[];
  readonly electricFieldInVoltsPerMeter: readonly Preset[];
  readonly temperatureInKelvin: readonly Preset[];
  readonly coherenceTimeInSeconds: readonly Preset[];
  readonly numberDensityPerCubicMeter: readonly Preset[];
  readonly crossSectionInSquareMeters: readonly Preset[];
  readonly velocityFraction: readonly Preset[];
  readonly velocityInMetersPerSecond: readonly Preset[];
  readonly angleDegrees: readonly Preset[];
  readonly angleRadians: readonly Preset[];
  readonly distanceInKilometers: readonly Preset[];
  readonly shots: readonly Preset[];
  readonly slitSeparationInMeters: readonly Preset[];
  readonly slitWidthInMeters: readonly Preset[];
  readonly screenDistanceInMeters: readonly Preset[];
  readonly cellSizeInMeters: readonly Preset[];
  readonly packetWidthInMeters: readonly Preset[];
  readonly spaceDurationInSeconds: readonly Preset[];
  readonly potentialEnergyInEv: readonly Preset[];
  readonly frequencyInHertz: readonly Preset[];
  readonly powerInWatts: readonly Preset[];
  readonly beamAreaInSquareMeters: readonly Preset[];
  readonly detuningInLinewidths: readonly Preset[];
  readonly saturationParameter: readonly Preset[];
}

export interface IsotopeEntry {
  readonly massNumber: number;
  readonly abundance: number;
}

export interface NuclideEntry {
  readonly massNumber: number;
  readonly stable: boolean;
  readonly halfLifeInSeconds: number | null;
  readonly halfLifeText: string;
  readonly spinParity: string | null;
  readonly decayMode: string | null;
  readonly abundancePercent: number | null;
}

export interface ElementEntry {
  readonly protons: number;
  readonly symbol: string;
  readonly name: string;
  readonly defaultMassNumber: number;
  readonly maximumValence: number;
  readonly standardAtomicWeight: number | null;
  readonly isotopes: readonly IsotopeEntry[];
  readonly groundLevel: string;
  readonly groundShells: string;
  readonly ionizationEnergyInEv: number | null;
  readonly coolable: boolean;
  readonly electronAffinityInEv?: number | null;
  readonly label?: LocalizedText;
}

export interface MoleculeCatalogEntry {
  readonly key: string;
  readonly name: ParticleName;
  readonly formula: string;
  readonly label: LocalizedText;
  readonly category: string;
  readonly massInDaltons?: number;
  readonly linear?: boolean;
  readonly radical?: boolean;
}

export interface MoleculeCategory {
  readonly key: string;
  readonly label: LocalizedText;
  readonly group?: string;
}

export type SpeciesKind = 'nucleus' | 'atom';

export interface SpeciesEntry {
  readonly kind: SpeciesKind;
  readonly name: ParticleName;
  readonly symbol: string;
  readonly elementName: string;
  readonly protons: number;
  readonly massNumber: number;
  readonly charge: number;
  readonly halfLifeText: string;
  readonly stable: boolean;
  readonly abundancePercent: number | null;
  readonly spinParity: string | null;
}

export interface SpeciesSearchResponse {
  readonly entries: readonly SpeciesEntry[];
  readonly total: number;
  readonly elapsedMilliseconds: number;
}

export interface ScaleReference {
  readonly label: LocalizedText;
  readonly meters: number;
  readonly simulated: boolean;
}

export interface ScaleLandmark {
  readonly value: number;
  readonly label: LocalizedText;
}

export interface EnvironmentScales {
  readonly numberDensityPerCubicMeter: readonly ScaleLandmark[];
  readonly temperatureInKelvin: readonly ScaleLandmark[];
  readonly pressureInPascals: readonly ScaleLandmark[];
}

export interface EnvironmentPresetComponent {
  readonly species: ParticleName;
  readonly numberDensityPerCubicMeter: number;
}

export interface EnvironmentPreset {
  readonly name: string;
  readonly group: LocalizedText;
  readonly title: LocalizedText;
  readonly components: readonly EnvironmentPresetComponent[];
  readonly temperatureInKelvin: number;
  readonly pressureInPascals: number;
  readonly radiationTemperatureInKelvin: number | null;
  readonly source: string;
  readonly note: LocalizedText;
}

export interface CollisionPair {
  readonly particles: readonly [ParticleName, ParticleName];
  readonly process: LocalizedText;
  readonly channels: readonly string[];
}

export interface CatalogResponse {
  readonly particles: readonly ParticleCatalogEntry[];
  readonly influences: readonly InfluenceDefinition[];
  readonly observables: readonly string[];
  readonly entangledStates: readonly string[];
  readonly spinPreparations: readonly string[];
  readonly statistics: readonly string[];
  readonly operations: readonly string[];
  readonly templateCategories: readonly TemplateCategory[];
  readonly presets: PresetCatalog;
  readonly collisionPairs: readonly CollisionPair[];
  readonly scaleReferences: readonly ScaleReference[];
  readonly gridSizes: readonly number[];
  readonly potentials: readonly string[];
  readonly elements: readonly ElementEntry[];
  readonly environments: readonly EnvironmentPreset[];
  readonly environmentScales: EnvironmentScales;
  readonly photonEnergyPerHertzInEv: number;
  readonly molecules?: readonly MoleculeCatalogEntry[];
  readonly moleculeCategories?: readonly MoleculeCategory[];
  readonly moleculeGroups?: readonly MoleculeCategory[];
}

export interface HealthResponse {
  readonly status: 'ok';
  readonly database: 'connected';
}

export interface ApiErrorResponse {
  readonly statusCode: number;
  readonly message: string | readonly string[];
  readonly text?: LocalizedText;
}

export type RunStreamMessage =
  | { readonly kind: 'started'; readonly runId: string }
  | { readonly kind: 'progress'; readonly progress: RunProgress }
  | { readonly kind: 'done'; readonly detail: RunDetail }
  | { readonly kind: 'error'; readonly error: ApiErrorResponse };
