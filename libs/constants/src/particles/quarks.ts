/* Catalog entries for the six quarks: PDG 2026 masses with their scheme, Standard Model quantum numbers. */
import type {
  FlavorNumbers,
  Generation,
  Isospin,
  ParticleName,
  ParticleSpec,
} from '@standard-model/contracts';
import { PDG_2026, pdgDecayChannels, pdgQuantity } from '../pdg.js';
import {
  DOWN_TYPE_HYPERCHARGE,
  DOWN_TYPE_WEAK_ISOSPIN,
  NO_FLAVOR_NUMBERS,
  NO_LEPTON_NUMBERS,
  QUARK_BARYON_NUMBER,
  SPIN_HALF,
  UP_TYPE_HYPERCHARGE,
  UP_TYPE_WEAK_ISOSPIN,
} from './shared.js';

const UP_TYPE_CHARGE = 2 / 3;
const DOWN_TYPE_CHARGE = -1 / 3;
const LIGHT_ISOSPIN_TOTAL = 1 / 2;

type QuarkMassKey = keyof typeof PDG_2026.massesInGev &
  ('up' | 'down' | 'strange' | 'charm' | 'bottom' | 'top');

interface QuarkDefinition {
  readonly name: QuarkMassKey;
  readonly symbol: string;
  readonly pdgId: number;
  readonly generation: Generation;
  readonly isUpType: boolean;
  readonly isospin: Isospin | null;
  readonly flavorNumbers: FlavorNumbers;
  readonly antiparticleName: ParticleName;
}

function quark(definition: QuarkDefinition): ParticleSpec {
  const mass = PDG_2026.massesInGev[definition.name];
  const width = definition.name === 'top' ? PDG_2026.widthsInGev.top : null;
  const decays =
    definition.name === 'top' ? pdgDecayChannels(PDG_2026.branchingFractions.top, 'top') : [];
  return {
    name: definition.name,
    symbol: definition.symbol,
    pdgId: definition.pdgId,
    family: 'quark',
    generation: definition.generation,
    statistics: 'fermiDirac',
    massInGev: pdgQuantity(mass, `${definition.name} quark mass`, 'GeV'),
    massScheme: mass.scheme as ParticleSpec['massScheme'],
    widthInGev: width === null ? null : pdgQuantity(width, 'top quark width', 'GeV'),
    meanLifeInSeconds: null,
    electricChargeInElementaryUnits: definition.isUpType ? UP_TYPE_CHARGE : DOWN_TYPE_CHARGE,
    spinInReducedPlanckUnits: SPIN_HALF,
    parity: 1,
    colorRepresentation: 'triplet',
    baryonNumber: QUARK_BARYON_NUMBER,
    leptonNumbers: NO_LEPTON_NUMBERS,
    isospin: definition.isospin,
    flavorNumbers: definition.flavorNumbers,
    weakIsospinThirdComponent: definition.isUpType ? UP_TYPE_WEAK_ISOSPIN : DOWN_TYPE_WEAK_ISOSPIN,
    weakHypercharge: definition.isUpType ? UP_TYPE_HYPERCHARGE : DOWN_TYPE_HYPERCHARGE,
    gFactor: null,
    magneticMomentInJoulesPerTesla: null,
    decays,
    antiparticleName: definition.antiparticleName,
    isSelfConjugate: false,
    constituents: null,
  };
}

export const QUARK_SPECS: readonly ParticleSpec[] = [
  quark({
    name: 'up',
    symbol: 'u',
    pdgId: 2,
    generation: 1,
    isUpType: true,
    isospin: { total: LIGHT_ISOSPIN_TOTAL, thirdComponent: 1 / 2 },
    flavorNumbers: NO_FLAVOR_NUMBERS,
    antiparticleName: 'antiUp',
  }),
  quark({
    name: 'down',
    symbol: 'd',
    pdgId: 1,
    generation: 1,
    isUpType: false,
    isospin: { total: LIGHT_ISOSPIN_TOTAL, thirdComponent: -1 / 2 },
    flavorNumbers: NO_FLAVOR_NUMBERS,
    antiparticleName: 'antiDown',
  }),
  quark({
    name: 'strange',
    symbol: 's',
    pdgId: 3,
    generation: 2,
    isUpType: false,
    isospin: null,
    flavorNumbers: { ...NO_FLAVOR_NUMBERS, strangeness: -1 },
    antiparticleName: 'antiStrange',
  }),
  quark({
    name: 'charm',
    symbol: 'c',
    pdgId: 4,
    generation: 2,
    isUpType: true,
    isospin: null,
    flavorNumbers: { ...NO_FLAVOR_NUMBERS, charm: 1 },
    antiparticleName: 'antiCharm',
  }),
  quark({
    name: 'bottom',
    symbol: 'b',
    pdgId: 5,
    generation: 3,
    isUpType: false,
    isospin: null,
    flavorNumbers: { ...NO_FLAVOR_NUMBERS, bottomness: -1 },
    antiparticleName: 'antiBottom',
  }),
  quark({
    name: 'top',
    symbol: 't',
    pdgId: 6,
    generation: 3,
    isUpType: true,
    isospin: null,
    flavorNumbers: { ...NO_FLAVOR_NUMBERS, topness: 1 },
    antiparticleName: 'antiTop',
  }),
];
