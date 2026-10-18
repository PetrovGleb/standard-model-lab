/* Catalog entries for charged leptons and neutrinos: CODATA masses and moments, PDG lifetimes and decays. */
import type {
  Generation,
  LeptonFamilyNumbers,
  ParticleName,
  ParticleSpec,
  Quantity,
} from '@standard-model/contracts';
import {
  ELECTRON_G_FACTOR,
  ELECTRON_MAGNETIC_MOMENT,
  ELECTRON_MASS_ENERGY_EQUIVALENT_IN_MEV,
  MUON_G_FACTOR,
  MUON_MAGNETIC_MOMENT,
  MUON_MASS_ENERGY_EQUIVALENT_IN_MEV,
} from '../codata.generated.js';
import { PDG_2026, pdgDecayChannels, pdgQuantity } from '../pdg.js';
import { theoreticalQuantity } from '../quantity-scaling.js';
import {
  CHARGED_LEPTON_HYPERCHARGE,
  CHARGED_LEPTON_WEAK_ISOSPIN,
  mevQuantityToGev,
  NEUTRINO_HYPERCHARGE,
  NEUTRINO_WEAK_ISOSPIN,
  NO_FLAVOR_NUMBERS,
  SPIN_HALF,
} from './shared.js';

const CHARGED_LEPTON_CHARGE = -1;
const NEUTRAL = 0;

interface ChargedLeptonDefinition {
  readonly name: 'electron' | 'muon' | 'tau';
  readonly symbol: string;
  readonly pdgId: number;
  readonly generation: Generation;
  readonly massInGev: Quantity;
  readonly massScheme: ParticleSpec['massScheme'];
  readonly meanLifeInSeconds: Quantity | null;
  readonly gFactor: Quantity | null;
  readonly magneticMomentInJoulesPerTesla: Quantity | null;
  readonly decays: ParticleSpec['decays'];
  readonly antiparticleName: ParticleName;
}

function leptonNumbersFor(flavor: 'electron' | 'muon' | 'tau'): LeptonFamilyNumbers {
  return { electron: 0, muon: 0, tau: 0, [flavor]: 1 };
}

function chargedLepton(definition: ChargedLeptonDefinition): ParticleSpec {
  return {
    name: definition.name,
    symbol: definition.symbol,
    pdgId: definition.pdgId,
    family: 'chargedLepton',
    generation: definition.generation,
    statistics: 'fermiDirac',
    massInGev: definition.massInGev,
    massScheme: definition.massScheme,
    widthInGev: null,
    meanLifeInSeconds: definition.meanLifeInSeconds,
    electricChargeInElementaryUnits: CHARGED_LEPTON_CHARGE,
    spinInReducedPlanckUnits: SPIN_HALF,
    parity: 1,
    colorRepresentation: 'singlet',
    baryonNumber: 0,
    leptonNumbers: leptonNumbersFor(definition.name),
    isospin: null,
    flavorNumbers: NO_FLAVOR_NUMBERS,
    weakIsospinThirdComponent: CHARGED_LEPTON_WEAK_ISOSPIN,
    weakHypercharge: CHARGED_LEPTON_HYPERCHARGE,
    gFactor: definition.gFactor,
    magneticMomentInJoulesPerTesla: definition.magneticMomentInJoulesPerTesla,
    decays: definition.decays,
    antiparticleName: definition.antiparticleName,
    isSelfConjugate: false,
    constituents: null,
  };
}

interface NeutrinoDefinition {
  readonly name: 'electronNeutrino' | 'muonNeutrino' | 'tauNeutrino';
  readonly flavor: 'electron' | 'muon' | 'tau';
  readonly symbol: string;
  readonly pdgId: number;
  readonly generation: Generation;
  readonly antiparticleName: ParticleName;
}

function neutrino(definition: NeutrinoDefinition): ParticleSpec {
  return {
    name: definition.name,
    symbol: definition.symbol,
    pdgId: definition.pdgId,
    family: 'neutrino',
    generation: definition.generation,
    statistics: 'fermiDirac',
    massInGev: theoreticalQuantity(0, 'GeV', 'neutrino mass below the 0.45 eV limit, set to zero'),
    massScheme: 'unknown',
    widthInGev: null,
    meanLifeInSeconds: null,
    electricChargeInElementaryUnits: NEUTRAL,
    spinInReducedPlanckUnits: SPIN_HALF,
    parity: 1,
    colorRepresentation: 'singlet',
    baryonNumber: 0,
    leptonNumbers: leptonNumbersFor(definition.flavor),
    isospin: null,
    flavorNumbers: NO_FLAVOR_NUMBERS,
    weakIsospinThirdComponent: NEUTRINO_WEAK_ISOSPIN,
    weakHypercharge: NEUTRINO_HYPERCHARGE,
    gFactor: null,
    magneticMomentInJoulesPerTesla: null,
    decays: [],
    antiparticleName: definition.antiparticleName,
    isSelfConjugate: false,
    constituents: null,
  };
}

export const LEPTON_SPECS: readonly ParticleSpec[] = [
  chargedLepton({
    name: 'electron',
    symbol: 'e-',
    pdgId: 11,
    generation: 1,
    massInGev: mevQuantityToGev(ELECTRON_MASS_ENERGY_EQUIVALENT_IN_MEV),
    massScheme: 'measured',
    meanLifeInSeconds: null,
    gFactor: ELECTRON_G_FACTOR,
    magneticMomentInJoulesPerTesla: ELECTRON_MAGNETIC_MOMENT,
    decays: [],
    antiparticleName: 'positron',
  }),
  chargedLepton({
    name: 'muon',
    symbol: 'mu-',
    pdgId: 13,
    generation: 2,
    massInGev: mevQuantityToGev(MUON_MASS_ENERGY_EQUIVALENT_IN_MEV),
    massScheme: 'measured',
    meanLifeInSeconds: pdgQuantity(PDG_2026.meanLivesInSeconds.muon, 'muon mean life', 's'),
    gFactor: MUON_G_FACTOR,
    magneticMomentInJoulesPerTesla: MUON_MAGNETIC_MOMENT,
    decays: pdgDecayChannels(PDG_2026.branchingFractions.muon, 'muon'),
    antiparticleName: 'antiMuon',
  }),
  chargedLepton({
    name: 'tau',
    symbol: 'tau-',
    pdgId: 15,
    generation: 3,
    massInGev: pdgQuantity(PDG_2026.massesInGev.tau, 'tau mass', 'GeV'),
    massScheme: 'measured',
    meanLifeInSeconds: pdgQuantity(PDG_2026.meanLivesInSeconds.tau, 'tau mean life', 's'),
    gFactor: null,
    magneticMomentInJoulesPerTesla: null,
    decays: pdgDecayChannels(PDG_2026.branchingFractions.tau, 'tau'),
    antiparticleName: 'antiTau',
  }),
  neutrino({
    name: 'electronNeutrino',
    flavor: 'electron',
    symbol: 'nu_e',
    pdgId: 12,
    generation: 1,
    antiparticleName: 'electronAntineutrino',
  }),
  neutrino({
    name: 'muonNeutrino',
    flavor: 'muon',
    symbol: 'nu_mu',
    pdgId: 14,
    generation: 2,
    antiparticleName: 'muonAntineutrino',
  }),
  neutrino({
    name: 'tauNeutrino',
    flavor: 'tau',
    symbol: 'nu_tau',
    pdgId: 16,
    generation: 3,
    antiparticleName: 'tauAntineutrino',
  }),
];
