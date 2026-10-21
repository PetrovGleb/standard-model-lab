/* Typed access to data/endf.generated.json: ENDF/B-VIII.0 neutron data per target nucleus (channel cross sections, with the resolved resonances of the actinides reconstructed, elastic mean
   cosine, prompt neutrons per fission, prompt fission spectrum quantiles, delayed neutrons per fission with their precursor groups) and independent fission-product yields, by Z and A. */
import endfJson from '../data/endf.generated.json' with { type: 'json' };

export const NEUTRON_REACTIONS = [
  'total',
  'elastic',
  'inelastic',
  'twoNeutrons',
  'fission',
  'capture',
  'protonEmission',
  'alphaEmission',
] as const;

export type NeutronReaction = (typeof NEUTRON_REACTIONS)[number];

export type EnergyTable = readonly [readonly number[], readonly number[]];

export interface FissionSpectrum {
  readonly incidentEnergiesInEv: readonly number[];
  readonly quantilesInEv: readonly (readonly number[])[];
}

export interface DelayedNeutronGroup {
  readonly decayConstantPerSecond: number;
  readonly abundance: number;
  readonly spectrumQuantilesInEv: readonly number[];
}

export interface DelayedNeutrons {
  readonly perFission: EnergyTable;
  readonly groups: readonly DelayedNeutronGroup[];
}

export interface NeutronData {
  readonly protons: number;
  readonly massNumber: number;
  readonly atomicWeightRatio: number;
  readonly resonanceBoundaryInEv: number;
  readonly crossSectionsInBarns: Partial<Record<NeutronReaction, EnergyTable>>;
  readonly elasticMeanCosine?: EnergyTable;
  readonly promptNeutrons?: EnergyTable;
  readonly fissionSpectrum?: FissionSpectrum;
  readonly delayedNeutrons?: DelayedNeutrons;
}

export interface FissionYields {
  readonly incidentEnergiesInEv: readonly number[];
  readonly fragments: readonly (readonly (readonly [number, number, number])[])[];
}

interface EndfFile {
  readonly source: string;
  readonly nuclides: Readonly<Record<string, NeutronData>>;
  readonly fissionYields: Readonly<Record<string, FissionYields>>;
}

const file = endfJson as unknown as EndfFile;
const ZA_PROTON_FACTOR = 1000;

export const ENDF_SOURCE = file.source;

function key(protons: number, massNumber: number): string {
  return String(protons * ZA_PROTON_FACTOR + massNumber);
}

export function neutronData(protons: number, massNumber: number): NeutronData | null {
  return file.nuclides[key(protons, massNumber)] ?? null;
}

export function fissionYields(protons: number, massNumber: number): FissionYields | null {
  return file.fissionYields[key(protons, massNumber)] ?? null;
}

export function neutronDataCount(): number {
  return Object.keys(file.nuclides).length;
}
