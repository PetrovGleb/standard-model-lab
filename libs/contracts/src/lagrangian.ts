/* Lagrangian contracts: the Standard Model as data (multiplets, parameters, terms), derived Feynman-rule vertices, and requests and results of tree-level process calculations. */
import type { ParticleName } from './particle-spec.js';
import type { LocalizedText } from './localized-text.js';

export const COUPLING_SCHEMES = ['fermiConstant', 'runningAlpha'] as const;
export type CouplingScheme = (typeof COUPLING_SCHEMES)[number];

export interface ComplexValue {
  readonly real: number;
  readonly imaginary: number;
}

export interface FermionMultipletView {
  readonly name: string;
  readonly latex: string;
  readonly chirality: 'left' | 'right';
  readonly colorRepresentation: 'singlet' | 'triplet';
  readonly weakRepresentation: 'doublet' | 'singlet';
  readonly hypercharge: number;
  readonly generations: readonly (readonly ParticleName[])[];
}

export interface LagrangianParameter {
  readonly name: string;
  readonly latex: string;
  readonly value: number;
  readonly unit: string;
  readonly origin: 'input' | 'derived' | 'check';
  readonly note: LocalizedText;
}

export interface LagrangianTerm {
  readonly name: string;
  readonly latex: string;
  readonly note: LocalizedText;
}

export const VERTEX_STRUCTURES = [
  'fermionFermionVector',
  'fermionFermionScalar',
  'tripleGauge',
  'quarticGauge',
  'vectorVectorScalar',
  'vectorVectorScalarScalar',
  'tripleScalar',
  'quarticScalar',
] as const;
export type VertexStructure = (typeof VERTEX_STRUCTURES)[number];

export interface VertexView {
  readonly particles: readonly ParticleName[];
  readonly structure: VertexStructure;
  readonly latex: string;
  readonly couplings: Readonly<Record<string, ComplexValue>>;
}

export interface LagrangianResponse {
  readonly scheme: CouplingScheme;
  readonly scaleInGev: number | null;
  readonly terms: readonly LagrangianTerm[];
  readonly multiplets: readonly FermionMultipletView[];
  readonly parameters: readonly LagrangianParameter[];
  readonly vertices: readonly VertexView[];
}

export interface ProcessRequest {
  readonly initial: readonly ParticleName[];
  readonly final: readonly ParticleName[];
  readonly centerOfMassEnergyInGev?: number;
  readonly maximumAbsoluteCosine?: number;
  readonly scheme?: CouplingScheme;
}

export interface DiagramLine {
  readonly particle: ParticleName;
  readonly momentum: string;
}

export interface DiagramView {
  readonly channel: LocalizedText | string;
  readonly propagators: readonly DiagramLine[];
  readonly vertices: readonly (readonly ParticleName[])[];
}

export interface ReferenceValue {
  readonly label: LocalizedText;
  readonly value: number;
  readonly uncertainty: number | null;
}

export interface ProcessResult {
  readonly kind: 'crossSection' | 'width';
  readonly process: string;
  readonly diagrams: readonly DiagramView[];
  readonly scheme: CouplingScheme;
  readonly value: number;
  readonly unit: 'nb' | 'GeV';
  readonly lifetimeInSeconds: number | null;
  readonly angularDistribution: {
    readonly cosine: readonly number[];
    readonly differentialInNanobarns: readonly number[];
  } | null;
  readonly averagedStates: number;
  readonly symmetryFactor: number;
  readonly reference: ReferenceValue | null;
  readonly notes: readonly LocalizedText[];
}
