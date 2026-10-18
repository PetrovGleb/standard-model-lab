/* Catalog entries for hydrogen-like atoms and ions and neutral helium: a nucleus with bound electrons; mass is nucleus plus electrons minus the binding energy (Bohr levels with the CODATA reduced mass, the outer helium electron from NIST ASD); spin is F of the hyperfine ground state; decays follow the nucleus. */
import type { DecayChannel, ParticleName, ParticleSpec } from '@standard-model/contracts';
import { RYDBERG_CONSTANT_TIMES_PLANCK_CONSTANT_TIMES_SPEED_OF_LIGHT_IN_EV } from '../codata.generated.js';
import { NUCLEAR_DATA } from '../nuclear.js';
import { LEPTON_SPECS } from './leptons.js';
import { NUCLEON_SPECS } from './nucleons.js';
import { NUCLEUS_SPECS } from './nuclei.js';
import { NO_FLAVOR_NUMBERS, sameForBothChiralities } from './shared.js';

const EV_PER_GEV = 1e9;
const ELECTRON_SPIN = 1 / 2;
const INTEGER_TOLERANCE = 1e-9;

interface AtomDefinition {
  readonly name: ParticleName;
  readonly symbol: string;
  readonly nucleus: ParticleName;
  readonly electrons: number;
}

const ATOMS: readonly AtomDefinition[] = [
  { name: 'hydrogenAtom', symbol: 'H', nucleus: 'proton', electrons: 1 },
  { name: 'deuteriumAtom', symbol: 'D', nucleus: 'deuteron', electrons: 1 },
  { name: 'tritiumAtom', symbol: 'T', nucleus: 'triton', electrons: 1 },
  { name: 'heliumThreeIon', symbol: 'He-3+', nucleus: 'helion', electrons: 1 },
  { name: 'heliumIon', symbol: 'He+', nucleus: 'alphaParticle', electrons: 1 },
  { name: 'heliumThreeAtom', symbol: 'He-3', nucleus: 'helion', electrons: 2 },
  { name: 'heliumAtom', symbol: 'He', nucleus: 'alphaParticle', electrons: 2 },
];

const NUCLEUS_CODES: Readonly<Partial<Record<ParticleName, number>>> = { proton: 1000010010 };

function requireSpec(specs: readonly ParticleSpec[], name: ParticleName): ParticleSpec {
  const spec = specs.find((candidate) => candidate.name === name);
  if (spec === undefined) {
    throw new Error(`No catalog entry for ${name}`);
  }
  return spec;
}

const ELECTRON = requireSpec(LEPTON_SPECS, 'electron');
const NUCLEI = [...NUCLEON_SPECS, ...NUCLEUS_SPECS];

export function hydrogenicBindingInEv(nucleus: ParticleSpec): number {
  const nucleusMass = nucleus.massInGev.value;
  const electronMass = ELECTRON.massInGev.value;
  const reducedMassRatio = nucleusMass / (nucleusMass + electronMass);
  return (
    nucleus.electricChargeInElementaryUnits ** 2 *
    RYDBERG_CONSTANT_TIMES_PLANCK_CONSTANT_TIMES_SPEED_OF_LIGHT_IN_EV.value *
    reducedMassRatio
  );
}

export function bindingEnergyInEv(nucleus: ParticleSpec, electrons: number): number {
  const inner = hydrogenicBindingInEv(nucleus);
  return electrons === 1 ? inner : inner + NUCLEAR_DATA.ionizationEnergiesInEv.heliumNeutral.value;
}

function groundStateSpin(nucleus: ParticleSpec, electrons: number): number {
  const nuclearSpin = nucleus.spinInReducedPlanckUnits;
  if (electrons !== 1) {
    return nuclearSpin;
  }
  if (nuclearSpin === 0) {
    return ELECTRON_SPIN;
  }
  const moment = nucleus.magneticMomentInJoulesPerTesla?.value ?? 0;
  return moment > 0 ? Math.abs(nuclearSpin - ELECTRON_SPIN) : nuclearSpin + ELECTRON_SPIN;
}

function atomNamed(nucleus: ParticleName, electrons: number): ParticleName | null {
  return (
    ATOMS.find((atom) => atom.nucleus === nucleus && atom.electrons === electrons)?.name ?? null
  );
}

function decaysOf(nucleus: ParticleSpec, electrons: number): readonly DecayChannel[] {
  return nucleus.decays.map((channel) => {
    const daughter = channel.products.find((product) =>
      NUCLEI.some((spec) => spec.name === product),
    ) as ParticleName | undefined;
    const bound = daughter === undefined ? null : atomNamed(daughter, electrons);
    return {
      ...channel,
      products:
        bound === null
          ? [
              ...channel.products,
              ...Array.from({ length: electrons }, (): ParticleName => 'electron'),
            ]
          : channel.products.map((product) => (product === daughter ? bound : product)),
    };
  });
}

function atom(definition: AtomDefinition): ParticleSpec {
  const nucleus = requireSpec(NUCLEI, definition.nucleus);
  const binding = bindingEnergyInEv(nucleus, definition.electrons);
  const spin = groundStateSpin(nucleus, definition.electrons);
  const massInGev =
    nucleus.massInGev.value +
    definition.electrons * ELECTRON.massInGev.value -
    binding / EV_PER_GEV;
  return {
    name: definition.name,
    symbol: definition.symbol,
    pdgId: NUCLEUS_CODES[definition.nucleus] ?? nucleus.pdgId,
    family: 'atom',
    generation: null,
    statistics:
      Math.abs(spin - Math.round(spin)) < INTEGER_TOLERANCE ? 'boseEinstein' : 'fermiDirac',
    massInGev: {
      value: massInGev,
      uncertainty: null,
      exact: false,
      unit: 'GeV',
      source: 'derived',
      sourceName: `${definition.name} mass: nucleus and electrons minus ${binding.toPrecision(8)} eV binding`,
    },
    massScheme: 'measured',
    widthInGev: null,
    meanLifeInSeconds: nucleus.meanLifeInSeconds,
    electricChargeInElementaryUnits:
      nucleus.electricChargeInElementaryUnits -
      definition.electrons * Math.abs(ELECTRON.electricChargeInElementaryUnits),
    spinInReducedPlanckUnits: spin,
    parity: nucleus.parity,
    colorRepresentation: 'singlet',
    baryonNumber: nucleus.baryonNumber,
    leptonNumbers: { electron: definition.electrons, muon: 0, tau: 0 },
    isospin: null,
    flavorNumbers: NO_FLAVOR_NUMBERS,
    weakIsospinThirdComponent: sameForBothChiralities(0),
    weakHypercharge: sameForBothChiralities(0),
    gFactor: null,
    magneticMomentInJoulesPerTesla: null,
    decays: decaysOf(nucleus, definition.electrons),
    antiparticleName:
      `anti${definition.name.slice(0, 1).toUpperCase()}${definition.name.slice(1)}` as ParticleName,
    isSelfConjugate: false,
    constituents: [
      definition.nucleus,
      ...Array.from({ length: definition.electrons }, (): ParticleName => 'electron'),
    ],
  };
}

export const ATOM_SPECS: readonly ParticleSpec[] = ATOMS.map(atom);
