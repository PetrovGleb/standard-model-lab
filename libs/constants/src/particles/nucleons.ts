/* Catalog entries for the proton and neutron: CODATA masses and moments, PDG neutron lifetime and decay. */
import type { ParticleName, ParticleSpec, Quantity } from '@standard-model/contracts';
import {
  NEUTRON_G_FACTOR,
  NEUTRON_MAGNETIC_MOMENT,
  NEUTRON_MASS_ENERGY_EQUIVALENT_IN_MEV,
  PROTON_G_FACTOR,
  PROTON_MAGNETIC_MOMENT,
  PROTON_MASS_ENERGY_EQUIVALENT_IN_MEV,
} from '../codata.generated.js';
import { PDG_2026, pdgDecayChannels, pdgQuantity } from '../pdg.js';
import {
  mevQuantityToGev,
  NO_FLAVOR_NUMBERS,
  NO_LEPTON_NUMBERS,
  sameForBothChiralities,
  SPIN_HALF,
} from './shared.js';

const NUCLEON_ISOSPIN_TOTAL = 1 / 2;
const NUCLEON_BARYON_NUMBER = 1;

interface NucleonDefinition {
  readonly name: 'proton' | 'neutron';
  readonly symbol: string;
  readonly pdgId: number;
  readonly massInGev: Quantity;
  readonly meanLifeInSeconds: Quantity | null;
  readonly electricChargeInElementaryUnits: number;
  readonly isospinThirdComponent: number;
  readonly gFactor: Quantity;
  readonly magneticMomentInJoulesPerTesla: Quantity;
  readonly decays: ParticleSpec['decays'];
  readonly antiparticleName: ParticleName;
  readonly constituents: readonly ParticleName[];
}

function nucleon(definition: NucleonDefinition): ParticleSpec {
  return {
    name: definition.name,
    symbol: definition.symbol,
    pdgId: definition.pdgId,
    family: 'baryon',
    generation: null,
    statistics: 'fermiDirac',
    massInGev: definition.massInGev,
    massScheme: 'measured',
    widthInGev: null,
    meanLifeInSeconds: definition.meanLifeInSeconds,
    electricChargeInElementaryUnits: definition.electricChargeInElementaryUnits,
    spinInReducedPlanckUnits: SPIN_HALF,
    parity: 1,
    colorRepresentation: 'singlet',
    baryonNumber: NUCLEON_BARYON_NUMBER,
    leptonNumbers: NO_LEPTON_NUMBERS,
    isospin: { total: NUCLEON_ISOSPIN_TOTAL, thirdComponent: definition.isospinThirdComponent },
    flavorNumbers: NO_FLAVOR_NUMBERS,
    weakIsospinThirdComponent: sameForBothChiralities(definition.isospinThirdComponent),
    weakHypercharge: sameForBothChiralities(NUCLEON_BARYON_NUMBER),
    gFactor: definition.gFactor,
    magneticMomentInJoulesPerTesla: definition.magneticMomentInJoulesPerTesla,
    decays: definition.decays,
    antiparticleName: definition.antiparticleName,
    isSelfConjugate: false,
    constituents: definition.constituents,
  };
}

export const NUCLEON_SPECS: readonly ParticleSpec[] = [
  nucleon({
    name: 'proton',
    symbol: 'p',
    pdgId: 2212,
    massInGev: mevQuantityToGev(PROTON_MASS_ENERGY_EQUIVALENT_IN_MEV),
    meanLifeInSeconds: null,
    electricChargeInElementaryUnits: 1,
    isospinThirdComponent: 1 / 2,
    gFactor: PROTON_G_FACTOR,
    magneticMomentInJoulesPerTesla: PROTON_MAGNETIC_MOMENT,
    decays: [],
    antiparticleName: 'antiProton',
    constituents: ['up', 'up', 'down'],
  }),
  nucleon({
    name: 'neutron',
    symbol: 'n',
    pdgId: 2112,
    massInGev: mevQuantityToGev(NEUTRON_MASS_ENERGY_EQUIVALENT_IN_MEV),
    meanLifeInSeconds: pdgQuantity(PDG_2026.meanLivesInSeconds.neutron, 'neutron mean life', 's'),
    electricChargeInElementaryUnits: 0,
    isospinThirdComponent: -1 / 2,
    gFactor: NEUTRON_G_FACTOR,
    magneticMomentInJoulesPerTesla: NEUTRON_MAGNETIC_MOMENT,
    decays: pdgDecayChannels(PDG_2026.branchingFractions.neutron, 'neutron'),
    antiparticleName: 'antiNeutron',
    constituents: ['up', 'down', 'down'],
  }),
];
