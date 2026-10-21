/* ExperimentPlan: the declarative JSON pipeline the runner executes; templates are plans with {{parameter}} placeholders; a create step with a count makes a group of particles labelled label1…labelN;
   a keyframe step records chosen quantities of a medium, the system or a particle under its name, and particleWeight says how many real particles each simulated one stands for. */
import type { CatalogParticleName } from './particle-spec.js';
import type { MeasurementDirection, ObservableName } from './quantum.js';

export type ParameterReference = `{{${string}}}`;
export type NumberOrParameter = number | ParameterReference;
export type ParameterDefinitions = Record<string, number>;

export const SPIN_PREPARATIONS = ['up', 'down', 'plusX', 'minusX', 'plusY', 'minusY'] as const;
export type SpinPreparation = (typeof SPIN_PREPARATIONS)[number];

export const ENTANGLED_STATES = [
  'spinSinglet',
  'spinTripletZero',
  'bellPhiPlus',
  'bellPhiMinus',
  'bellPsiPlus',
  'bellPsiMinus',
] as const;
export type EntangledState = (typeof ENTANGLED_STATES)[number];

const INVERSE_SQUARE_ROOT_TWO = Math.SQRT1_2;

export const ENTANGLED_STATE_AMPLITUDES: Readonly<Record<EntangledState, readonly number[]>> = {
  bellPhiPlus: [INVERSE_SQUARE_ROOT_TWO, 0, 0, INVERSE_SQUARE_ROOT_TWO],
  bellPhiMinus: [INVERSE_SQUARE_ROOT_TWO, 0, 0, -INVERSE_SQUARE_ROOT_TWO],
  bellPsiPlus: [0, INVERSE_SQUARE_ROOT_TWO, INVERSE_SQUARE_ROOT_TWO, 0],
  bellPsiMinus: [0, INVERSE_SQUARE_ROOT_TWO, -INVERSE_SQUARE_ROOT_TWO, 0],
  spinSinglet: [0, INVERSE_SQUARE_ROOT_TWO, -INVERSE_SQUARE_ROOT_TWO, 0],
  spinTripletZero: [0, INVERSE_SQUARE_ROOT_TWO, INVERSE_SQUARE_ROOT_TWO, 0],
};

export const REPORT_STATISTICS = [
  'frequency',
  'mean',
  'probabilitySameSign',
  'correlation',
  'chsh',
  'histogram',
  'standardDeviation',
] as const;
export type ReportStatistic = (typeof REPORT_STATISTICS)[number];

export interface ParameterizableVector3 {
  readonly x: NumberOrParameter;
  readonly y: NumberOrParameter;
  readonly z: NumberOrParameter;
}

export interface MeasurementAxis {
  readonly polarAngleDegrees: NumberOrParameter;
  readonly azimuthDegrees: NumberOrParameter;
}

export interface CreateStep {
  readonly operation: 'create';
  readonly label: string;
  readonly particle: CatalogParticleName;
  readonly count?: NumberOrParameter;
  readonly momentumInGev?: ParameterizableVector3;
  readonly positionInFemtometers?: ParameterizableVector3;
  readonly spin?: SpinPreparation;
  readonly spinDirection?: MeasurementDirection;
}

export const MAXIMUM_GROUP_SIZE = 10_000;

export function groupMemberLabels(label: string, count: number): readonly string[] {
  return count <= 1
    ? [label]
    : Array.from({ length: count }, (unused, index) => `${label}${String(index + 1)}`);
}

export interface StateAmplitudes {
  readonly real: readonly number[];
  readonly imaginary: readonly number[];
}

export interface EntangleStep {
  readonly operation: 'entangle';
  readonly targets: readonly string[];
  readonly state: EntangledState;
  readonly amplitudes?: StateAmplitudes;
  readonly observable?: ObservableName;
}

export type InfluenceStepScalar = NumberOrParameter | string | boolean;

export type InfluenceStepValue =
  InfluenceStepScalar | readonly Record<string, InfluenceStepScalar>[];

export interface InfluenceStep {
  readonly operation: 'influence';
  readonly influence: string;
  readonly targets?: readonly string[];
  readonly parameters?: Record<string, InfluenceStepValue>;
}

export interface EvolveStep {
  readonly operation: 'evolve';
  readonly durationInSeconds: NumberOrParameter;
  readonly targets?: readonly string[];
}

export interface MeasureStep {
  readonly operation: 'measure';
  readonly target: string;
  readonly observable: ObservableName;
  readonly axis?: MeasurementAxis;
  readonly record: string;
}

export interface DiffractStep {
  readonly operation: 'diffract';
  readonly target: string;
  readonly slitSeparationInMeters: NumberOrParameter;
  readonly slitWidthInMeters: NumberOrParameter;
  readonly screenDistanceInMeters: NumberOrParameter;
  readonly whichPathDetector: NumberOrParameter;
  readonly pathMarker?: string;
  readonly record: string;
}

export interface CollideStep {
  readonly operation: 'collide';
  readonly targets: readonly string[];
  readonly record: string;
  readonly channel?: string;
  readonly minimumTransverseMomentumInGev?: NumberOrParameter;
}

export const WAVEPACKET_SHAPES = [
  'gaussian',
  'groundState',
  'hydrogen2s',
  'hydrogen2p',
  'hydrogen3d',
  'hydrogen1s2p',
  'catState',
] as const;
export type WavepacketShape = (typeof WAVEPACKET_SHAPES)[number];

export interface PlaceStep {
  readonly operation: 'place';
  readonly target: string;
  readonly centerInMeters: ParameterizableVector3;
  readonly widthInMeters: NumberOrParameter;
  readonly shape: WavepacketShape;
}

export interface PropagateStep {
  readonly operation: 'propagate';
  readonly durationInSeconds: NumberOrParameter;
}

export interface MeasurePositionStep {
  readonly operation: 'measurePosition';
  readonly target: string;
  readonly record: string;
}

export interface MeasureSystemStep {
  readonly operation: 'measureSystem';
  readonly record: string;
}

export const GRID_SIZES = [32, 64] as const;
export const POTENTIAL_KINDS = [
  'free',
  'harmonic',
  'barrier',
  'coulomb',
  'doubleSlit',
  'doubleWell',
  'box',
] as const;
export type PotentialKind = (typeof POTENTIAL_KINDS)[number];

export const SPACE_WALLS = ['open', 'reflecting'] as const;
export type SpaceWalls = (typeof SPACE_WALLS)[number];

export interface SpaceSpec {
  readonly gridPointsPerAxis: number;
  readonly cellSizeInMeters: NumberOrParameter;
  readonly potential: PotentialKind;
  readonly potentialEnergyInEv?: NumberOrParameter;
  readonly barrierThicknessInMeters?: NumberOrParameter;
  readonly nuclearCharge?: NumberOrParameter;
  readonly slitSeparationInMeters?: NumberOrParameter;
  readonly slitWidthInMeters?: NumberOrParameter;
  readonly wellSeparationInMeters?: NumberOrParameter;
  readonly boxSizeInMeters?: NumberOrParameter;
  readonly walls?: SpaceWalls;
}

export interface CombineStep {
  readonly operation: 'combine';
  readonly targets: readonly string[];
  readonly label: string;
}

export interface CreateNucleusStep {
  readonly operation: 'createNucleus';
  readonly label: string;
  readonly protons: number;
  readonly massNumber: number;
  readonly count?: NumberOrParameter;
  readonly momentumInGev?: ParameterizableVector3;
  readonly positionInFemtometers?: ParameterizableVector3;
}

export interface CreateAtomStep {
  readonly operation: 'createAtom';
  readonly label: string;
  readonly protons: number;
  readonly massNumber?: number;
  readonly charge?: number;
  readonly count?: NumberOrParameter;
  readonly momentumInGev?: ParameterizableVector3;
  readonly positionInFemtometers?: ParameterizableVector3;
  readonly spin?: SpinPreparation;
}

export interface MoleculeAtom {
  readonly protons: number;
  readonly massNumber?: number;
}

export const BOND_ORDERS = [1, 2, 3] as const;
export type BondOrder = (typeof BOND_ORDERS)[number];

export interface MoleculeBond {
  readonly first: number;
  readonly second: number;
  readonly order: BondOrder;
}

export interface MoleculeFormalCharge {
  readonly atom: number;
  readonly charge: number;
}

export interface CreateMoleculeStep {
  readonly operation: 'createMolecule';
  readonly label: string;
  readonly atoms: readonly MoleculeAtom[];
  readonly bonds: readonly MoleculeBond[];
  readonly charges?: readonly MoleculeFormalCharge[];
  readonly count?: NumberOrParameter;
  readonly momentumInGev?: ParameterizableVector3;
  readonly positionInFemtometers?: ParameterizableVector3;
}

export interface DecayStep {
  readonly operation: 'decay';
  readonly target: string;
  readonly record?: string;
}

export const KEYFRAME_SYSTEM_TARGET = 'system';
export const MEDIUM_KEYFRAME_QUANTITIES = [
  'temperatureInKelvin',
  'absorbedEnergyInJoules',
  'pressureInPascals',
] as const;
export const SYSTEM_KEYFRAME_QUANTITIES = ['particleCount', 'pendingNeutrons'] as const;
export const PARTICLE_KEYFRAME_QUANTITIES = ['energyInGev', 'kineticEnergyInGev'] as const;
export const KEYFRAME_COUNT_PREFIX = 'count.';

export interface KeyframeWatch {
  readonly target: string;
  readonly quantity: string;
}

export interface KeyframeStep {
  readonly operation: 'keyframe';
  readonly name: string;
  readonly watch: readonly KeyframeWatch[];
}

export function keyframeRecord(name: string, watch: KeyframeWatch): string {
  return `${name}.${watch.target}.${watch.quantity}`;
}

export type ExperimentStep =
  | CreateStep
  | CreateNucleusStep
  | CreateAtomStep
  | CreateMoleculeStep
  | EntangleStep
  | InfluenceStep
  | EvolveStep
  | MeasureStep
  | CombineStep
  | DiffractStep
  | CollideStep
  | PlaceStep
  | PropagateStep
  | MeasurePositionStep
  | MeasureSystemStep
  | KeyframeStep
  | DecayStep;

export interface ReportCondition {
  readonly record: string;
  readonly equals: number;
}

export interface ReportSpec {
  readonly statistic: ReportStatistic;
  readonly records: readonly string[];
  readonly when?: ReportCondition;
  readonly label?: string;
  readonly bins?: number;
}

export const TEMPLATE_CATEGORIES = [
  'spin',
  'interference',
  'decays',
  'neutrinos',
  'colliders',
  'confinement',
  'protons',
  'space',
  'nuclear',
  'atoms',
  'molecules',
  'radiation',
  'chemistry',
] as const;

export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

export interface ExperimentPlan {
  readonly name: string;
  readonly description?: string;
  readonly categories?: readonly TemplateCategory[];
  readonly parameters: ParameterDefinitions;
  readonly shots: number;
  readonly seed?: number;
  readonly space?: SpaceSpec;
  readonly particleWeight?: number;
  readonly steps: readonly ExperimentStep[];
  readonly report: readonly ReportSpec[];
}
