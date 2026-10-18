/* Catalog entries for the light nuclei d, t, ³He and ⁴He: CODATA masses, magnetic moments and g factors, NUBASE2020 spins and parities from data/nuclear.json, nucleon constituents, the triton beta decay. */
import type { ParticleName, ParticleSpec, Quantity } from '@standard-model/contracts';
import {
  ALPHA_PARTICLE_MASS_ENERGY_EQUIVALENT_IN_MEV,
  DEUTERON_G_FACTOR,
  DEUTERON_MAGNETIC_MOMENT,
  DEUTERON_MASS_ENERGY_EQUIVALENT_IN_MEV,
  HELION_G_FACTOR,
  HELION_MAGNETIC_MOMENT,
  HELION_MASS_ENERGY_EQUIVALENT_IN_MEV,
  TRITON_G_FACTOR,
  TRITON_MAGNETIC_MOMENT,
  TRITON_MASS_ENERGY_EQUIVALENT_IN_MEV,
} from '../codata.generated.js';
import { NUCLEAR_DATA } from '../nuclear.js';
import { pdgDecayChannels } from '../pdg.js';
import {
  mevQuantityToGev,
  NO_FLAVOR_NUMBERS,
  NO_LEPTON_NUMBERS,
  sameForBothChiralities,
} from './shared.js';

const SECONDS_PER_DAY = 86_400;
const DAYS_PER_JULIAN_YEAR = 365.25;
const ISOSPIN_PER_NUCLEON = 1 / 2;
const INTEGER_TOLERANCE = 1e-9;

interface NucleusEntry {
  readonly symbol: string;
  readonly pdgId: number;
  readonly protons: number;
  readonly neutrons: number;
  readonly spin: number;
  readonly parity: number;
  readonly halfLifeInYears: { readonly value: number; readonly uncertainty: number | null } | null;
  readonly decays?: readonly {
    readonly products: readonly string[];
    readonly value: number;
    readonly uncertainty: number | null;
  }[];
}

const CODATA: Readonly<
  Record<
    string,
    { readonly mass: Quantity; readonly moment: Quantity | null; readonly gFactor: Quantity | null }
  >
> = {
  deuteron: {
    mass: DEUTERON_MASS_ENERGY_EQUIVALENT_IN_MEV,
    moment: DEUTERON_MAGNETIC_MOMENT,
    gFactor: DEUTERON_G_FACTOR,
  },
  triton: {
    mass: TRITON_MASS_ENERGY_EQUIVALENT_IN_MEV,
    moment: TRITON_MAGNETIC_MOMENT,
    gFactor: TRITON_G_FACTOR,
  },
  helion: {
    mass: HELION_MASS_ENERGY_EQUIVALENT_IN_MEV,
    moment: HELION_MAGNETIC_MOMENT,
    gFactor: HELION_G_FACTOR,
  },
  alphaParticle: {
    mass: ALPHA_PARTICLE_MASS_ENERGY_EQUIVALENT_IN_MEV,
    moment: null,
    gFactor: null,
  },
};

function meanLifeFromHalfLife(name: string, entry: NucleusEntry): Quantity | null {
  if (entry.halfLifeInYears === null) {
    return null;
  }
  const secondsPerYear = DAYS_PER_JULIAN_YEAR * SECONDS_PER_DAY;
  const toMeanLife = secondsPerYear / Math.LN2;
  return {
    value: entry.halfLifeInYears.value * toMeanLife,
    uncertainty:
      entry.halfLifeInYears.uncertainty === null
        ? null
        : entry.halfLifeInYears.uncertainty * toMeanLife,
    exact: false,
    unit: 's',
    source: 'derived',
    sourceName: `${name} mean life from the half-life`,
  };
}

function antiName(name: string): ParticleName {
  return `anti${name.slice(0, 1).toUpperCase()}${name.slice(1)}` as ParticleName;
}

function nucleus(name: string, entry: NucleusEntry): ParticleSpec {
  const codata = CODATA[name];
  if (codata === undefined) {
    throw new Error(`No CODATA entries for ${name}`);
  }
  const isospinThird = (entry.protons - entry.neutrons) * ISOSPIN_PER_NUCLEON;
  const massNumber = entry.protons + entry.neutrons;
  return {
    name: name as ParticleName,
    symbol: entry.symbol,
    pdgId: entry.pdgId,
    family: 'nucleus',
    generation: null,
    statistics:
      Math.abs(entry.spin - Math.round(entry.spin)) < INTEGER_TOLERANCE
        ? 'boseEinstein'
        : 'fermiDirac',
    massInGev: mevQuantityToGev(codata.mass),
    massScheme: 'measured',
    widthInGev: null,
    meanLifeInSeconds: meanLifeFromHalfLife(name, entry),
    electricChargeInElementaryUnits: entry.protons,
    spinInReducedPlanckUnits: entry.spin,
    parity: entry.parity as 1 | -1,
    colorRepresentation: 'singlet',
    baryonNumber: massNumber,
    leptonNumbers: NO_LEPTON_NUMBERS,
    isospin: { total: Math.abs(isospinThird), thirdComponent: isospinThird },
    flavorNumbers: NO_FLAVOR_NUMBERS,
    weakIsospinThirdComponent: sameForBothChiralities(isospinThird),
    weakHypercharge: sameForBothChiralities(massNumber),
    gFactor: codata.gFactor,
    magneticMomentInJoulesPerTesla: codata.moment,
    decays: pdgDecayChannels(entry.decays ?? [], name),
    antiparticleName: antiName(name),
    isSelfConjugate: false,
    constituents: [
      ...Array.from({ length: entry.protons }, (): ParticleName => 'proton'),
      ...Array.from({ length: entry.neutrons }, (): ParticleName => 'neutron'),
    ],
  };
}

export const NUCLEUS_SPECS: readonly ParticleSpec[] = Object.entries(
  NUCLEAR_DATA.nuclei as Readonly<Record<string, NucleusEntry>>,
).map(([name, entry]) => nucleus(name, entry));
