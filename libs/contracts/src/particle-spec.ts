/* ParticleSpec: the static, source-backed description of a particle or bound object, the closed list of catalog names and the generated names of nuclei (nucleus:Z:A), atoms and ions (atom:Z:A:charge) and molecules. */
import type { Quantity } from './quantity.js';

export const PARTICLE_NAMES = [
  'up',
  'down',
  'strange',
  'charm',
  'bottom',
  'top',
  'antiUp',
  'antiDown',
  'antiStrange',
  'antiCharm',
  'antiBottom',
  'antiTop',
  'electron',
  'muon',
  'tau',
  'positron',
  'antiMuon',
  'antiTau',
  'electronNeutrino',
  'muonNeutrino',
  'tauNeutrino',
  'electronAntineutrino',
  'muonAntineutrino',
  'tauAntineutrino',
  'photon',
  'gluon',
  'wPlus',
  'wMinus',
  'zBoson',
  'higgsBoson',
  'proton',
  'neutron',
  'antiProton',
  'antiNeutron',
  'pionPlus',
  'pionMinus',
  'pionZero',
  'etaMeson',
  'rhoPlus',
  'rhoMinus',
  'rhoZero',
  'omegaMeson',
  'etaPrimeMeson',
  'phiMeson',
  'kaonPlus',
  'kaonMinus',
  'kaonShort',
  'kaonLong',
  'kaonStarPlus',
  'kaonStarMinus',
  'kaonStarZero',
  'antiKaonStarZero',
  'dPlus',
  'dMinus',
  'dZero',
  'antiDZero',
  'dStarPlus',
  'dStarMinus',
  'dStarZero',
  'antiDStarZero',
  'dSPlus',
  'dSMinus',
  'dSStarPlus',
  'dSStarMinus',
  'bPlus',
  'bMinus',
  'bZero',
  'antiBZero',
  'bStarPlus',
  'bStarMinus',
  'bStarZero',
  'antiBStarZero',
  'bSZero',
  'antiBSZero',
  'bSStarZero',
  'antiBSStarZero',
  'lambdaBaryon',
  'antiLambdaBaryon',
  'sigmaPlus',
  'antiSigmaPlus',
  'sigmaZero',
  'antiSigmaZero',
  'sigmaMinus',
  'antiSigmaMinus',
  'xiZero',
  'antiXiZero',
  'xiMinus',
  'antiXiMinus',
  'deltaPlusPlus',
  'antiDeltaPlusPlus',
  'deltaPlus',
  'antiDeltaPlus',
  'deltaZero',
  'antiDeltaZero',
  'deltaMinus',
  'antiDeltaMinus',
  'sigmaStarPlus',
  'antiSigmaStarPlus',
  'sigmaStarZero',
  'antiSigmaStarZero',
  'sigmaStarMinus',
  'antiSigmaStarMinus',
  'xiStarZero',
  'antiXiStarZero',
  'xiStarMinus',
  'antiXiStarMinus',
  'omegaMinus',
  'antiOmegaMinus',
  'lambdaCPlus',
  'antiLambdaCPlus',
  'sigmaCPlusPlus',
  'antiSigmaCPlusPlus',
  'sigmaCPlus',
  'antiSigmaCPlus',
  'sigmaCZero',
  'antiSigmaCZero',
  'sigmaCStarPlusPlus',
  'antiSigmaCStarPlusPlus',
  'sigmaCStarPlus',
  'antiSigmaCStarPlus',
  'sigmaCStarZero',
  'antiSigmaCStarZero',
  'xiCPlus',
  'antiXiCPlus',
  'xiCZero',
  'antiXiCZero',
  'xiCPrimePlus',
  'antiXiCPrimePlus',
  'xiCPrimeZero',
  'antiXiCPrimeZero',
  'xiCStarPlus',
  'antiXiCStarPlus',
  'xiCStarZero',
  'antiXiCStarZero',
  'omegaCZero',
  'antiOmegaCZero',
  'omegaCStarZero',
  'antiOmegaCStarZero',
  'lambdaBZero',
  'antiLambdaBZero',
  'sigmaBPlus',
  'antiSigmaBPlus',
  'sigmaBMinus',
  'antiSigmaBMinus',
  'sigmaBStarPlus',
  'antiSigmaBStarPlus',
  'sigmaBStarMinus',
  'antiSigmaBStarMinus',
  'xiBZero',
  'antiXiBZero',
  'xiBMinus',
  'antiXiBMinus',
  'xiBPrimeMinus',
  'antiXiBPrimeMinus',
  'xiBStarZero',
  'antiXiBStarZero',
  'xiBStarMinus',
  'antiXiBStarMinus',
  'omegaBMinus',
  'antiOmegaBMinus',
  'downDownSpinOne',
  'antiDownDownSpinOne',
  'upDownSpinZero',
  'antiUpDownSpinZero',
  'upDownSpinOne',
  'antiUpDownSpinOne',
  'upUpSpinOne',
  'antiUpUpSpinOne',
  'strangeDownSpinZero',
  'antiStrangeDownSpinZero',
  'strangeDownSpinOne',
  'antiStrangeDownSpinOne',
  'strangeUpSpinZero',
  'antiStrangeUpSpinZero',
  'strangeUpSpinOne',
  'antiStrangeUpSpinOne',
  'strangeStrangeSpinOne',
  'antiStrangeStrangeSpinOne',
  'deuteron',
  'antiDeuteron',
  'triton',
  'antiTriton',
  'helion',
  'antiHelion',
  'alphaParticle',
  'antiAlphaParticle',
  'hydrogenAtom',
  'antiHydrogenAtom',
  'deuteriumAtom',
  'antiDeuteriumAtom',
  'tritiumAtom',
  'antiTritiumAtom',
  'heliumThreeIon',
  'antiHeliumThreeIon',
  'heliumIon',
  'antiHeliumIon',
  'heliumThreeAtom',
  'antiHeliumThreeAtom',
  'heliumAtom',
  'antiHeliumAtom',
] as const;

export type CatalogParticleName = (typeof PARTICLE_NAMES)[number];
export type NucleusName = `nucleus:${number}:${number}`;
export type AtomName = `atom:${number}:${number}:${number}`;
export type MoleculeName = `molecule:${string}`;
export type ParticleName = CatalogParticleName | NucleusName | AtomName | MoleculeName;

export const INCLUSIVE_PRODUCTS = ['hadrons', 'invisible'] as const;
export type InclusiveProduct = (typeof INCLUSIVE_PRODUCTS)[number];
export type DecayProduct = ParticleName | InclusiveProduct;

export type ParticleFamily =
  | 'quark'
  | 'chargedLepton'
  | 'neutrino'
  | 'gaugeBoson'
  | 'scalarBoson'
  | 'baryon'
  | 'meson'
  | 'diquark'
  | 'nucleus'
  | 'atom'
  | 'molecule';
export type Generation = 1 | 2 | 3;
export type ColorRepresentation = 'singlet' | 'triplet' | 'antitriplet' | 'octet';
export type MassScheme =
  | 'measured'
  | 'msBarAtTwoGev'
  | 'msBarAtOwnMass'
  | 'directReconstruction'
  | 'theoreticalZero'
  | 'unknown';
export type QuantumStatistics = 'fermiDirac' | 'boseEinstein';

export interface LeptonFamilyNumbers {
  readonly electron: number;
  readonly muon: number;
  readonly tau: number;
}

export type LeptonFlavor = keyof LeptonFamilyNumbers;

export interface FlavorNumbers {
  readonly strangeness: number;
  readonly charm: number;
  readonly bottomness: number;
  readonly topness: number;
}

export interface Isospin {
  readonly total: number;
  readonly thirdComponent: number;
}

export interface ChiralValue {
  readonly leftHanded: number;
  readonly rightHanded: number | null;
}

export interface DecayChannel {
  readonly products: readonly DecayProduct[];
  readonly branchingFraction: Quantity;
}

export interface ParticleSpec {
  readonly name: ParticleName;
  readonly symbol: string;
  readonly pdgId: number;
  readonly family: ParticleFamily;
  readonly generation: Generation | null;
  readonly statistics: QuantumStatistics;
  readonly massInGev: Quantity;
  readonly massScheme: MassScheme;
  readonly widthInGev: Quantity | null;
  readonly meanLifeInSeconds: Quantity | null;
  readonly electricChargeInElementaryUnits: number;
  readonly spinInReducedPlanckUnits: number;
  readonly parity: 1 | -1 | null;
  readonly colorRepresentation: ColorRepresentation;
  readonly baryonNumber: number;
  readonly leptonNumbers: LeptonFamilyNumbers;
  readonly isospin: Isospin | null;
  readonly flavorNumbers: FlavorNumbers;
  readonly weakIsospinThirdComponent: ChiralValue;
  readonly weakHypercharge: ChiralValue;
  readonly gFactor: Quantity | null;
  readonly magneticMomentInJoulesPerTesla: Quantity | null;
  readonly decays: readonly DecayChannel[];
  readonly antiparticleName: ParticleName;
  readonly isSelfConjugate: boolean;
  readonly constituents: readonly ParticleName[] | null;
}
