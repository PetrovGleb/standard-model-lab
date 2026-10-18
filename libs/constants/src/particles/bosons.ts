/* Catalog entries for the gauge bosons and the Higgs boson: PDG 2026 masses, widths and decays. */
import type { ParticleSpec } from '@standard-model/contracts';
import { PDG_2026, pdgDecayChannels, pdgQuantity } from '../pdg.js';
import { theoreticalQuantity } from '../quantity-scaling.js';
import {
  NO_FLAVOR_NUMBERS,
  NO_LEPTON_NUMBERS,
  sameForBothChiralities,
  SPIN_ONE,
  SPIN_ZERO,
} from './shared.js';

const NEUTRAL = 0;
const W_PLUS_CHARGE = 1;
const W_WEAK_ISOSPIN_THIRD_COMPONENT = 1;
const HIGGS_WEAK_ISOSPIN_THIRD_COMPONENT = -1 / 2;
const HIGGS_HYPERCHARGE = 1;

const BOSON_DEFAULTS = {
  generation: null,
  statistics: 'boseEinstein',
  widthInGev: null,
  meanLifeInSeconds: null,
  baryonNumber: 0,
  leptonNumbers: NO_LEPTON_NUMBERS,
  isospin: null,
  flavorNumbers: NO_FLAVOR_NUMBERS,
  gFactor: null,
  magneticMomentInJoulesPerTesla: null,
  constituents: null,
} as const satisfies Partial<ParticleSpec>;

export const PHOTON_SPEC: ParticleSpec = {
  ...BOSON_DEFAULTS,
  name: 'photon',
  symbol: 'gamma',
  pdgId: 22,
  family: 'gaugeBoson',
  massInGev: theoreticalQuantity(0, 'GeV', 'massless gauge boson'),
  massScheme: 'theoreticalZero',
  electricChargeInElementaryUnits: NEUTRAL,
  spinInReducedPlanckUnits: SPIN_ONE,
  parity: -1,
  colorRepresentation: 'singlet',
  weakIsospinThirdComponent: sameForBothChiralities(0),
  weakHypercharge: sameForBothChiralities(0),
  decays: [],
  antiparticleName: 'photon',
  isSelfConjugate: true,
};

export const GLUON_SPEC: ParticleSpec = {
  ...BOSON_DEFAULTS,
  name: 'gluon',
  symbol: 'g',
  pdgId: 21,
  family: 'gaugeBoson',
  massInGev: theoreticalQuantity(0, 'GeV', 'massless gauge boson'),
  massScheme: 'theoreticalZero',
  electricChargeInElementaryUnits: NEUTRAL,
  spinInReducedPlanckUnits: SPIN_ONE,
  parity: -1,
  colorRepresentation: 'octet',
  weakIsospinThirdComponent: sameForBothChiralities(0),
  weakHypercharge: sameForBothChiralities(0),
  decays: [],
  antiparticleName: 'gluon',
  isSelfConjugate: true,
};

export const W_PLUS_SPEC: ParticleSpec = {
  ...BOSON_DEFAULTS,
  name: 'wPlus',
  symbol: 'W+',
  pdgId: 24,
  family: 'gaugeBoson',
  massInGev: pdgQuantity(PDG_2026.massesInGev.wBoson, 'W boson mass', 'GeV'),
  massScheme: 'measured',
  widthInGev: pdgQuantity(PDG_2026.widthsInGev.wBoson, 'W boson width', 'GeV'),
  electricChargeInElementaryUnits: W_PLUS_CHARGE,
  spinInReducedPlanckUnits: SPIN_ONE,
  parity: null,
  colorRepresentation: 'singlet',
  weakIsospinThirdComponent: sameForBothChiralities(W_WEAK_ISOSPIN_THIRD_COMPONENT),
  weakHypercharge: sameForBothChiralities(0),
  decays: pdgDecayChannels(PDG_2026.branchingFractions.wPlus, 'W+'),
  antiparticleName: 'wMinus',
  isSelfConjugate: false,
};

export const Z_BOSON_SPEC: ParticleSpec = {
  ...BOSON_DEFAULTS,
  name: 'zBoson',
  symbol: 'Z',
  pdgId: 23,
  family: 'gaugeBoson',
  massInGev: pdgQuantity(PDG_2026.massesInGev.zBoson, 'Z boson mass', 'GeV'),
  massScheme: 'measured',
  widthInGev: pdgQuantity(PDG_2026.widthsInGev.zBoson, 'Z boson width', 'GeV'),
  electricChargeInElementaryUnits: NEUTRAL,
  spinInReducedPlanckUnits: SPIN_ONE,
  parity: null,
  colorRepresentation: 'singlet',
  weakIsospinThirdComponent: sameForBothChiralities(0),
  weakHypercharge: sameForBothChiralities(0),
  decays: pdgDecayChannels(PDG_2026.branchingFractions.zBoson, 'Z'),
  antiparticleName: 'zBoson',
  isSelfConjugate: true,
};

export const HIGGS_BOSON_SPEC: ParticleSpec = {
  ...BOSON_DEFAULTS,
  name: 'higgsBoson',
  symbol: 'H',
  pdgId: 25,
  family: 'scalarBoson',
  massInGev: pdgQuantity(PDG_2026.massesInGev.higgsBoson, 'Higgs boson mass', 'GeV'),
  massScheme: 'measured',
  widthInGev: pdgQuantity(PDG_2026.widthsInGev.higgsBoson, 'Higgs boson width', 'GeV'),
  electricChargeInElementaryUnits: NEUTRAL,
  spinInReducedPlanckUnits: SPIN_ZERO,
  parity: 1,
  colorRepresentation: 'singlet',
  weakIsospinThirdComponent: sameForBothChiralities(HIGGS_WEAK_ISOSPIN_THIRD_COMPONENT),
  weakHypercharge: sameForBothChiralities(HIGGS_HYPERCHARGE),
  decays: pdgDecayChannels(PDG_2026.branchingFractions.higgsBoson, 'Higgs'),
  antiparticleName: 'higgsBoson',
  isSelfConjugate: true,
};

export const BOSON_SPECS: readonly ParticleSpec[] = [
  PHOTON_SPEC,
  GLUON_SPEC,
  W_PLUS_SPEC,
  Z_BOSON_SPEC,
  HIGGS_BOSON_SPEC,
];
