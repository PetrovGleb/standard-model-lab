/* Nuclei, atoms, ions and molecules beyond the fixed catalog: specs built on demand from NUBASE2020 and AME2020 (mass, half-life, spin, parity, decay modes), NIST ASD (ionization energies, ground levels), UFF with OpenStax bond energies and Voronov 1997 electron-impact ionization fits; particleSpec resolves every ParticleName. */
import type {
  CatalogParticleName,
  DecayChannel,
  DecayProduct,
  ParticleName,
  ParticleSpec,
  Quantity,
} from '@standard-model/contracts';
import matterJson from '../../data/matter.generated.json' with { type: 'json' };
import {
  ATOMIC_MASS_CONSTANT_ENERGY_EQUIVALENT_IN_MEV,
  AVOGADRO_CONSTANT,
  BOHR_MAGNETON,
  ELECTRON_G_FACTOR,
  ELECTRON_MASS_ENERGY_EQUIVALENT_IN_MEV,
  ELECTRON_VOLT,
} from '../codata.generated.js';
import { electronAffinityInEv } from '../chemistry-data.js';
import { PARTICLE_CATALOG } from './catalog.js';
import { NO_FLAVOR_NUMBERS, NO_LEPTON_NUMBERS, sameForBothChiralities } from './shared.js';

export interface DecayModeRecord {
  readonly mode: string;
  readonly percent: number | null;
}

export interface NuclideRecord {
  readonly protons: number;
  readonly massNumber: number;
  readonly symbol: string;
  readonly massExcessInKev: number;
  readonly massExcessUncertaintyInKev: number;
  readonly fromSystematics: boolean;
  readonly halfLifeInSeconds: number | null;
  readonly stable: boolean;
  readonly halfLifeText: string;
  readonly spinParity: string | null;
  readonly decayModes: readonly DecayModeRecord[];
  readonly abundancePercent: number | null;
}

export interface IonizationStage {
  readonly charge: number;
  readonly groundShells: string;
  readonly groundLevel: string;
  readonly ionizationEnergyInEv: number | null;
  readonly ionizationEnergyMethod: 'theory' | 'extrapolated' | 'measured';
}

export interface ElementRecord {
  readonly protons: number;
  readonly symbol: string;
  readonly name: string;
  readonly standardAtomicWeight: number | null;
  readonly isotopes: readonly { readonly massNumber: number; readonly abundance: number }[];
  readonly stages: readonly IonizationStage[];
}

export interface UffAtomType {
  readonly atomType: string;
  readonly bondRadiusInAngstrom: number;
  readonly bondAngleInDegrees: number;
  readonly nonbondDistanceInAngstrom: number;
  readonly nonbondEnergyInKcalPerMole: number;
  readonly nonbondScale: number;
  readonly effectiveCharge: number;
  readonly torsionBarrierSp3InKcalPerMole: number;
  readonly torsionBarrierSp2InKcalPerMole: number;
  readonly electronegativity: number;
  readonly hardness: number;
  readonly radiusInAngstrom: number;
}

export interface BondEnergyRecord {
  readonly first: string;
  readonly second: string;
  readonly order: number;
  readonly energyInKjPerMole: number;
  readonly lengthInAngstrom: number | null;
}

export interface PhotoionizationTables {
  readonly shellOrbitalQuantumNumbers: readonly number[];
  readonly innerShellCount: readonly number[];
  readonly totalShellCount: readonly number[];
  readonly innerShellFits: Readonly<Record<string, readonly number[]>>;
  readonly outerShellFits: Readonly<Record<string, readonly number[]>>;
}

export interface CollisionalIonizationFit {
  readonly thresholdInEv: number;
  readonly squareRootCoefficient: number;
  readonly amplitudeInCubicCentimetersPerSecond: number;
  readonly denominatorOffset: number;
  readonly exponent: number;
}

export interface CoolingTransition {
  readonly protons: number;
  readonly charge: number;
  readonly wavelengthInNanometers: number;
  readonly wavelengthMedium: 'air' | 'vacuum';
  readonly einsteinCoefficientPerSecond: number;
  readonly lowerLevel: string;
  readonly upperLevel: string;
}

export interface MatterData {
  readonly sources: Readonly<Record<string, string>>;
  readonly nuclides: readonly NuclideRecord[];
  readonly elements: readonly ElementRecord[];
  readonly photoionization: PhotoionizationTables;
  readonly collisionalIonization: Readonly<Record<string, CollisionalIonizationFit>>;
  readonly uffAtomTypes: readonly UffAtomType[];
  readonly bondEnergies: readonly BondEnergyRecord[];
  readonly coolingTransitions: readonly CoolingTransition[];
}

export interface FormalCharge {
  readonly atom: number;
  readonly charge: number;
}

export interface MoleculeStructure {
  readonly atoms: readonly { readonly protons: number; readonly massNumber: number }[];
  readonly bonds: readonly {
    readonly first: number;
    readonly second: number;
    readonly order: number;
  }[];
  readonly charges?: readonly FormalCharge[];
}

export const MATTER_DATA = matterJson as unknown as MatterData;

const ANION_CHARGE = -1;
const KEV_PER_MEV = 1e3;
const MEV_PER_GEV = 1e3;
const EV_PER_GEV = 1e9;
const JOULES_PER_KILOJOULE = 1e3;
const THERMOCHEMICAL_CALORIE_IN_JOULES = 4.184;
const UFF_MORSE_BOND_ENERGY_PER_ORDER_IN_KCAL_PER_MOLE = 70;
const ELECTRON_BINDING_COEFFICIENT_IN_EV = 14.4381;
const ELECTRON_BINDING_EXPONENT = 2.39;
const ELECTRON_BINDING_HIGH_COEFFICIENT_IN_EV = 1.55468e-6;
const ELECTRON_BINDING_HIGH_EXPONENT = 5.35;
const PDG_NUCLEUS_CODE_BASE = 1_000_000_000;
const PDG_PROTON_DIGITS = 10_000;
const PDG_MASS_DIGITS = 10;
const ISOSPIN_PER_NUCLEON = 1 / 2;
const ORBITAL_LETTERS = 'SPDFGHIKLMNOQRTUV';
const INTEGER_TOLERANCE = 1e-9;
const OCTET = 8;
const DUET = 2;
const DATIVE_DONORS = [5, 6];

const NUCLEUS_ALIASES: Readonly<Record<string, CatalogParticleName>> = {
  '0:1': 'neutron',
  '1:1': 'proton',
  '1:2': 'deuteron',
  '1:3': 'triton',
  '2:3': 'helion',
  '2:4': 'alphaParticle',
};

const ATOM_ALIASES: Readonly<Record<string, CatalogParticleName>> = {
  '1:1:0': 'hydrogenAtom',
  '1:2:0': 'deuteriumAtom',
  '1:3:0': 'tritiumAtom',
  '2:3:1': 'heliumThreeIon',
  '2:4:1': 'heliumIon',
  '2:3:0': 'heliumThreeAtom',
  '2:4:0': 'heliumAtom',
};

const NUCLIDES = new Map(
  MATTER_DATA.nuclides.map((nuclide) => [
    `${String(nuclide.protons)}:${String(nuclide.massNumber)}`,
    nuclide,
  ]),
);
const ELEMENTS = new Map(MATTER_DATA.elements.map((element) => [element.protons, element]));

export function nuclideRecord(protons: number, massNumber: number): NuclideRecord | null {
  return NUCLIDES.get(`${String(protons)}:${String(massNumber)}`) ?? null;
}

export function measuredNuclides(protons: number): readonly NuclideRecord[] {
  return MATTER_DATA.nuclides.filter(
    (nuclide) => nuclide.protons === protons && !nuclide.fromSystematics,
  );
}

export function elementRecord(protons: number): ElementRecord | null {
  return ELEMENTS.get(protons) ?? null;
}

export function elementSymbol(protons: number): string {
  return (
    elementRecord(protons)?.symbol ??
    MATTER_DATA.nuclides.find((nuclide) => nuclide.protons === protons)?.symbol ??
    `Z${String(protons)}`
  );
}

export function defaultMassNumber(protons: number): number {
  const isotopes = elementRecord(protons)?.isotopes ?? [];
  const abundant = [...isotopes].sort((first, second) => second.abundance - first.abundance)[0];
  if (abundant !== undefined) {
    return abundant.massNumber;
  }
  const candidates = MATTER_DATA.nuclides.filter((nuclide) => nuclide.protons === protons);
  const longest = [...candidates].sort(
    (first, second) =>
      (second.halfLifeInSeconds ?? Number.POSITIVE_INFINITY) -
      (first.halfLifeInSeconds ?? Number.POSITIVE_INFINITY),
  )[0];
  if (longest === undefined) {
    throw new Error(`No nuclide with ${String(protons)} protons in NUBASE2020`);
  }
  return longest.massNumber;
}

export function nucleusName(protons: number, massNumber: number): ParticleName {
  return (
    NUCLEUS_ALIASES[`${String(protons)}:${String(massNumber)}`] ??
    (`nucleus:${String(protons)}:${String(massNumber)}` as ParticleName)
  );
}

export function atomName(protons: number, massNumber: number, charge = 0): ParticleName {
  if (charge === protons) {
    return nucleusName(protons, massNumber);
  }
  return (
    ATOM_ALIASES[`${String(protons)}:${String(massNumber)}:${String(charge)}`] ??
    (`atom:${String(protons)}:${String(massNumber)}:${String(charge)}` as ParticleName)
  );
}

export function moleculeName(structure: MoleculeStructure): ParticleName {
  const atoms = structure.atoms
    .map((atom) => `${String(atom.protons)}-${String(atom.massNumber)}`)
    .join(',');
  const bonds = structure.bonds
    .map((bond) => {
      const [first, second] = [bond.first, bond.second].sort((left, right) => left - right);
      return `${String(first)}-${String(second)}-${String(bond.order)}`;
    })
    .sort()
    .join(',');
  const charges = (structure.charges ?? [])
    .filter((entry) => entry.charge !== 0)
    .sort((left, right) => left.atom - right.atom)
    .map(
      (entry) =>
        `${String(entry.atom)}${entry.charge > 0 ? '+' : '-'}${String(Math.abs(entry.charge))}`,
    )
    .join(',');
  return charges === '' ? `molecule:${atoms};${bonds}` : `molecule:${atoms};${bonds};${charges}`;
}

function parseFormalCharges(chargePart: string): FormalCharge[] {
  return chargePart
    .split(',')
    .filter((entry) => entry !== '')
    .map((entry) => {
      const [, atom = '0', charge = '0'] = /^(\d+)([+-]\d+)$/.exec(entry) ?? [];
      return { atom: Number(atom), charge: Number(charge) };
    });
}

export function formalChargeOf(structure: MoleculeStructure, atom: number): number {
  return (structure.charges ?? [])
    .filter((entry) => entry.atom === atom)
    .reduce((sum, entry) => sum + entry.charge, 0);
}

export function moleculeCharge(structure: MoleculeStructure): number {
  return (structure.charges ?? []).reduce((sum, entry) => sum + entry.charge, 0);
}

export function hasFormalCharges(name: ParticleName): boolean {
  return (
    name.startsWith('molecule:') &&
    (moleculeStructureOf(name).charges ?? []).some((entry) => entry.charge !== 0)
  );
}

export function moleculeStructureOf(name: string): MoleculeStructure {
  const [atomPart = '', bondPart = '', chargePart = ''] = name.slice('molecule:'.length).split(';');
  const charges = parseFormalCharges(chargePart);
  return {
    atoms: atomPart.split(',').map((entry) => {
      const [protons = 0, massNumber = 0] = entry.split('-').map(Number);
      return { protons, massNumber };
    }),
    bonds: bondPart
      .split(',')
      .filter((entry) => entry !== '')
      .map((entry) => {
        const [first = 0, second = 0, order = 1] = entry.split('-').map(Number);
        return { first, second, order };
      }),
    ...(charges.length > 0 ? { charges } : {}),
  };
}

function totalElectronBindingInEv(protons: number, fromCharge: number): number {
  const stages = elementRecord(protons)?.stages ?? [];
  const energies = stages
    .filter((stage) => stage.charge >= fromCharge)
    .map((stage) => stage.ionizationEnergyInEv);
  if (energies.length === protons - fromCharge && energies.every((energy) => energy !== null)) {
    return energies.reduce<number>((sum, energy) => sum + (energy ?? 0), 0);
  }
  const electrons = protons - fromCharge;
  return (
    ELECTRON_BINDING_COEFFICIENT_IN_EV * electrons ** ELECTRON_BINDING_EXPONENT +
    ELECTRON_BINDING_HIGH_COEFFICIENT_IN_EV * electrons ** ELECTRON_BINDING_HIGH_EXPONENT
  );
}

function requireNuclide(protons: number, massNumber: number): NuclideRecord {
  const nuclide = nuclideRecord(protons, massNumber);
  if (nuclide === null) {
    throw new Error(
      `No nuclide with Z = ${String(protons)} and A = ${String(massNumber)} in NUBASE2020`,
    );
  }
  return nuclide;
}

function nuclearMassInGev(protons: number, massNumber: number): number {
  const nuclide = requireNuclide(protons, massNumber);
  const atomicMassInMev =
    massNumber * ATOMIC_MASS_CONSTANT_ENERGY_EQUIVALENT_IN_MEV.value +
    nuclide.massExcessInKev / KEV_PER_MEV;
  const electronsInMev =
    protons * ELECTRON_MASS_ENERGY_EQUIVALENT_IN_MEV.value -
    totalElectronBindingInEv(protons, 0) / (EV_PER_GEV / MEV_PER_GEV);
  return (atomicMassInMev - electronsInMev) / MEV_PER_GEV;
}

function atomMassInGev(protons: number, massNumber: number, charge: number): number {
  const affinity = charge === ANION_CHARGE ? electronAffinityInEv(protons) : null;
  if (affinity !== null) {
    return (
      atomMassInGev(protons, massNumber, 0) +
      ELECTRON_MASS_ENERGY_EQUIVALENT_IN_MEV.value / MEV_PER_GEV -
      affinity / EV_PER_GEV
    );
  }
  const electrons = protons - charge;
  return (
    nuclearMassInGev(protons, massNumber) +
    (electrons * ELECTRON_MASS_ENERGY_EQUIVALENT_IN_MEV.value) / MEV_PER_GEV -
    totalElectronBindingInEv(protons, charge) / EV_PER_GEV
  );
}

function parseMatterName(name: string): readonly number[] {
  return name.split(':').slice(1).map(Number);
}

export function restMassInGev(name: ParticleName): number {
  if (isCatalogName(name)) {
    return PARTICLE_CATALOG[name].massInGev.value;
  }
  const [protons = 0, massNumber = 0, charge = 0] = parseMatterName(name);
  if (name.startsWith('nucleus:')) {
    return nuclearMassInGev(protons, massNumber);
  }
  if (name.startsWith('atom:')) {
    return atomMassInGev(protons, massNumber, charge);
  }
  return particleSpec(name).massInGev.value;
}

const KILOJOULE_PER_MOLE_IN_EV =
  JOULES_PER_KILOJOULE / AVOGADRO_CONSTANT.value / ELECTRON_VOLT.value;
const KILOCALORIE_PER_MOLE_IN_EV =
  (JOULES_PER_KILOJOULE * THERMOCHEMICAL_CALORIE_IN_JOULES) /
  AVOGADRO_CONSTANT.value /
  ELECTRON_VOLT.value;

export function tabulatedBond(
  firstProtons: number,
  secondProtons: number,
  order: number,
): BondEnergyRecord | null {
  const first = elementSymbol(firstProtons);
  const second = elementSymbol(secondProtons);
  return (
    MATTER_DATA.bondEnergies.find(
      (bond) =>
        bond.order === order &&
        ((bond.first === first && bond.second === second) ||
          (bond.first === second && bond.second === first)),
    ) ?? null
  );
}

export function bondEnergyInEv(firstProtons: number, secondProtons: number, order: number): number {
  const tabulated = tabulatedBond(firstProtons, secondProtons, order);
  return tabulated === null
    ? order * UFF_MORSE_BOND_ENERGY_PER_ORDER_IN_KCAL_PER_MOLE * KILOCALORIE_PER_MOLE_IN_EV
    : tabulated.energyInKjPerMole * KILOJOULE_PER_MOLE_IN_EV;
}

function shellElectrons(shells: string, principal: number): number {
  return shells
    .replace(/^\[[A-Za-z]+\]\.?/, '')
    .split('.')
    .map((shell) => /^(\d+)([spdf])(\d*)$/.exec(shell))
    .filter((match): match is RegExpExecArray => match !== null)
    .filter((match) => Number(match[1]) === principal && (match[2] === 's' || match[2] === 'p'))
    .reduce((sum, match) => sum + (match[3] === '' ? 1 : Number(match[3])), 0);
}

function outerShell(protons: number): { principal: number; valenceElectrons: number } {
  const shells = elementRecord(protons)?.stages[0]?.groundShells ?? '';
  const principal = Math.max(
    0,
    ...[...shells.matchAll(/(\d+)[sp]/g)].map((match) => Number(match[1])),
  );
  return { principal, valenceElectrons: shellElectrons(shells, principal) };
}

export function ordinaryValence(protons: number): number {
  const { principal, valenceElectrons } = outerShell(protons);
  const capacity = principal === 1 ? DUET : OCTET;
  return Math.max(0, Math.min(valenceElectrons, capacity - valenceElectrons));
}

export function maximumValence(protons: number): number {
  const { valenceElectrons } = outerShell(protons);
  const ruleValence =
    Math.min(valenceElectrons, OCTET - valenceElectrons) +
    (DATIVE_DONORS.includes(valenceElectrons) ? 1 : 0);
  const symbol = elementSymbol(protons);
  const oxidationStates = MATTER_DATA.uffAtomTypes
    .filter((type) => type.atomType.replace(/[_\d].*$/, '') === symbol)
    .map((type) => Number(/\+(\d+)$/.exec(type.atomType)?.[1] ?? 0));
  return Math.max(ruleValence, ...oxidationStates);
}

function derived(value: number, unit: string, sourceName: string): Quantity {
  return { value, uncertainty: null, exact: false, unit, source: 'derived', sourceName };
}

function parseSpinParity(text: string | null, massNumber: number) {
  const match = text === null ? null : /(\d+)(?:\/(\d+))?\)?([+-])?/.exec(text);
  const spin =
    match === null
      ? (massNumber % 2) / 2
      : Number(match[1]) / (match[2] === undefined ? 1 : Number(match[2]));
  const parity = match?.[3] === '+' ? 1 : match?.[3] === '-' ? -1 : null;
  return { spin, parity: parity as 1 | -1 | null };
}

function modeProducts(
  mode: string,
  protons: number,
  massNumber: number,
  electrons: number,
): readonly DecayProduct[] | null {
  const daughter = (deltaProtons: number, deltaMass: number, ...light: DecayProduct[]) => {
    const daughterProtons = protons + deltaProtons;
    const daughterMass = massNumber + deltaMass;
    if (nuclideRecord(daughterProtons, daughterMass) === null) {
      return null;
    }
    const kept = Math.min(electrons, daughterProtons);
    const freed = Array.from({ length: electrons - kept }, (): DecayProduct => 'electron');
    return [atomName(daughterProtons, daughterMass, daughterProtons - kept), ...light, ...freed];
  };
  const repeat = (count: number, product: DecayProduct): DecayProduct[] =>
    Array.from({ length: count }, () => product);
  const betaMinus: DecayProduct[] = ['electron', 'electronAntineutrino'];
  const betaPlus: DecayProduct[] = ['positron', 'electronNeutrino'];
  switch (mode) {
    case 'B-':
      return daughter(1, 0, ...betaMinus);
    case '2B-':
      return daughter(2, 0, ...betaMinus, ...betaMinus);
    case 'B-n':
    case 'B-2n':
    case 'B-3n':
    case 'B-4n': {
      const neutrons = mode === 'B-n' ? 1 : Number(mode.charAt(2));
      return daughter(1, -neutrons, ...betaMinus, ...repeat(neutrons, 'neutron'));
    }
    case 'B-p':
      return daughter(0, -1, ...betaMinus, 'proton');
    case 'B-d':
      return daughter(0, -2, ...betaMinus, 'deuteron');
    case 'B-t':
      return daughter(0, -3, ...betaMinus, 'triton');
    case 'B-A':
      return daughter(-1, -4, ...betaMinus, 'alphaParticle');
    case 'B+':
    case 'e+':
      return daughter(-1, 0, ...betaPlus);
    case '2B+':
      return daughter(-2, 0, ...betaPlus, ...betaPlus);
    case 'B+p':
    case 'B+2p':
    case 'B+3p': {
      const emitted = mode === 'B+p' ? 1 : Number(mode.charAt(2));
      return daughter(-1 - emitted, -emitted, ...betaPlus, ...repeat(emitted, 'proton'));
    }
    case 'B+A':
      return daughter(-3, -4, ...betaPlus, 'alphaParticle');
    case 'A':
      return daughter(-2, -4, 'alphaParticle');
    case 'p':
    case '2p':
    case '3p': {
      const emitted = mode === 'p' ? 1 : Number(mode.charAt(0));
      return daughter(-emitted, -emitted, ...repeat(emitted, 'proton'));
    }
    case 'n':
    case '2n':
    case '3n': {
      const emitted = mode === 'n' ? 1 : Number(mode.charAt(0));
      return daughter(0, -emitted, ...repeat(emitted, 'neutron'));
    }
    default:
      return null;
  }
}

function electronCaptureProducts(
  protons: number,
  massNumber: number,
  electrons: number,
): readonly DecayProduct[] | null {
  if (electrons === 0 || nuclideRecord(protons - 1, massNumber) === null) {
    return null;
  }
  const remaining = Math.min(electrons - 1, protons - 1);
  return [
    atomName(protons - 1, massNumber, protons - 1 - remaining),
    'electronNeutrino',
    ...Array.from({ length: electrons - 1 - remaining }, (): DecayProduct => 'electron'),
  ];
}

const DELAYED_BETA_MINUS = /^B-./;
const DELAYED_BETA_PLUS = /^B\+./;

function nuclearDecays(
  protons: number,
  massNumber: number,
  electrons: number,
  parentMassInGev: number,
): readonly DecayChannel[] {
  const nuclide = requireNuclide(protons, massNumber);
  if (nuclide.stable || nuclide.decayModes.length === 0) {
    return [];
  }
  const known = nuclide.decayModes.filter((mode) => mode.percent !== null);
  const modes =
    known.length === 0 ? nuclide.decayModes.map((mode) => ({ ...mode, percent: 1 })) : known;
  const delayedMinus = modes
    .filter((mode) => DELAYED_BETA_MINUS.test(mode.mode))
    .reduce((sum, mode) => sum + (mode.percent ?? 0), 0);
  const delayedPlus = modes
    .filter((mode) => DELAYED_BETA_PLUS.test(mode.mode))
    .reduce((sum, mode) => sum + (mode.percent ?? 0), 0);
  const exclusive = modes.map((mode) => ({
    mode: mode.mode,
    weight:
      (mode.percent ?? 0) -
      (mode.mode === 'B-' ? delayedMinus : 0) -
      (mode.mode === 'B+' ? delayedPlus : 0),
  }));
  const fits = (products: readonly DecayProduct[]): boolean =>
    products.reduce(
      (sum, product) =>
        sum + (product === 'hadrons' || product === 'invisible' ? 0 : restMassInGev(product)),
      0,
    ) < parentMassInGev;
  const channels = exclusive.flatMap(({ mode, weight }) => {
    if (weight <= 0) {
      return [];
    }
    if (mode === 'B+' || mode === 'EC' || mode === 'e+') {
      const positron = mode === 'EC' ? null : modeProducts('B+', protons, massNumber, electrons);
      const capture =
        mode === 'e+' ? null : electronCaptureProducts(protons, massNumber, electrons);
      const products = [positron, capture].find(
        (candidate): candidate is readonly DecayProduct[] => candidate !== null && fits(candidate),
      );
      return products === undefined ? [] : [{ products, weight }];
    }
    const products = modeProducts(mode, protons, massNumber, electrons);
    return products !== null && fits(products) ? [{ products, weight }] : [];
  });
  const total = channels.reduce((sum, channel) => sum + channel.weight, 0);
  return channels.map((channel) => ({
    products: channel.products,
    branchingFraction: {
      value: channel.weight / total,
      uncertainty: null,
      exact: false,
      unit: '1',
      source: 'NUBASE2020',
      sourceName: `${elementSymbol(protons)}-${String(massNumber)} decay modes, renormalized over modeled channels`,
    },
  }));
}

function meanLife(nuclide: NuclideRecord): Quantity | null {
  return nuclide.halfLifeInSeconds === null
    ? null
    : {
        value: nuclide.halfLifeInSeconds / Math.LN2,
        uncertainty: null,
        exact: false,
        unit: 's',
        source: 'NUBASE2020',
        sourceName: `${nuclide.symbol}-${String(nuclide.massNumber)} half-life ${nuclide.halfLifeText} over ln 2`,
      };
}

function nucleusSpec(protons: number, massNumber: number): ParticleSpec {
  const nuclide = requireNuclide(protons, massNumber);
  const neutrons = massNumber - protons;
  const { spin, parity } = parseSpinParity(nuclide.spinParity, massNumber);
  const isospinThird = (protons - neutrons) * ISOSPIN_PER_NUCLEON;
  const massInGev = nuclearMassInGev(protons, massNumber);
  const name = nucleusName(protons, massNumber);
  return {
    name,
    symbol: `${String(massNumber)}${nuclide.symbol}`,
    pdgId: PDG_NUCLEUS_CODE_BASE + protons * PDG_PROTON_DIGITS + massNumber * PDG_MASS_DIGITS,
    family: 'nucleus',
    generation: null,
    statistics:
      Math.abs(spin - Math.round(spin)) < INTEGER_TOLERANCE ? 'boseEinstein' : 'fermiDirac',
    massInGev: {
      value: massInGev,
      uncertainty: nuclide.massExcessUncertaintyInKev / KEV_PER_MEV / MEV_PER_GEV,
      exact: false,
      unit: 'GeV',
      source: 'AME2020',
      sourceName: `${nuclide.symbol}-${String(massNumber)} atomic mass minus electrons and their NIST binding`,
    },
    massScheme: 'measured',
    widthInGev: null,
    meanLifeInSeconds: meanLife(nuclide),
    electricChargeInElementaryUnits: protons,
    spinInReducedPlanckUnits: spin,
    parity,
    colorRepresentation: 'singlet',
    baryonNumber: massNumber,
    leptonNumbers: NO_LEPTON_NUMBERS,
    isospin: { total: Math.abs(isospinThird), thirdComponent: isospinThird },
    flavorNumbers: NO_FLAVOR_NUMBERS,
    weakIsospinThirdComponent: sameForBothChiralities(isospinThird),
    weakHypercharge: sameForBothChiralities(massNumber),
    gFactor: null,
    magneticMomentInJoulesPerTesla: null,
    decays: nuclearDecays(protons, massNumber, 0, massInGev),
    antiparticleName: name,
    isSelfConjugate: false,
    constituents: [
      ...Array.from({ length: protons }, (): ParticleName => 'proton'),
      ...Array.from({ length: neutrons }, (): ParticleName => 'neutron'),
    ],
  };
}

export interface AtomicTerm {
  readonly multiplicity: number;
  readonly orbital: number;
  readonly totalAngularMomentum: number;
}

export function parseAtomicTerm(level: string): AtomicTerm | null {
  const term = /^(\d+)([A-Z])\*?(?:<(\d+)(?:\/(\d+))?>|(\d+))$/.exec(level.trim());
  if (term === null) {
    return null;
  }
  const orbital = ORBITAL_LETTERS.indexOf(term[2] ?? '');
  return orbital < 0
    ? null
    : {
        multiplicity: Number(term[1]),
        orbital,
        totalAngularMomentum:
          term[5] === undefined
            ? Number(term[3]) / (term[4] === undefined ? 1 : Number(term[4]))
            : Number(term[5]),
      };
}

export function landeFactor(term: AtomicTerm): number {
  const total = term.totalAngularMomentum;
  if (total === 0) {
    return 0;
  }
  const spin = (term.multiplicity - 1) / 2;
  const totalSquared = total * (total + 1);
  const spinSquared = spin * (spin + 1);
  const orbitalSquared = term.orbital * (term.orbital + 1);
  const electronSpinFactor = Math.abs(ELECTRON_G_FACTOR.value);
  return (
    (totalSquared - spinSquared + orbitalSquared) / (2 * totalSquared) +
    (electronSpinFactor * (totalSquared + spinSquared - orbitalSquared)) / (2 * totalSquared)
  );
}

function groundStage(protons: number, charge: number): IonizationStage | null {
  return elementRecord(protons)?.stages.find((stage) => stage.charge === charge) ?? null;
}

export function groundStatisticalWeight(protons: number, charge: number): number | null {
  if (charge === protons) {
    return 1;
  }
  const term = parseAtomicTerm(groundStage(protons, charge)?.groundLevel ?? '');
  return term === null ? null : 2 * term.totalAngularMomentum + 1;
}

export function collisionalIonizationFit(
  protons: number,
  electrons: number,
): CollisionalIonizationFit | null {
  return MATTER_DATA.collisionalIonization[`${String(protons)}:${String(electrons)}`] ?? null;
}

function chargeSuffix(charge: number): string {
  return charge === 0
    ? ''
    : charge === 1
      ? '+'
      : charge === ANION_CHARGE
        ? '−'
        : `${String(charge)}+`;
}

function atomSpec(protons: number, massNumber: number, charge: number): ParticleSpec {
  const electrons = protons - charge;
  const boundAnion = charge === ANION_CHARGE && electronAffinityInEv(protons) !== null;
  if (electrons < 1 || (charge < 0 && !boundAnion)) {
    throw new Error(
      `An atom of Z = ${String(protons)} with charge ${String(charge)} needs 1 to ${String(protons)} electrons, or one extra electron where the electron affinity is known`,
    );
  }
  const nuclide = requireNuclide(protons, massNumber);
  const level = groundStage(protons, charge)?.groundLevel ?? '';
  const term = parseAtomicTerm(level);
  const spin = term?.totalAngularMomentum ?? (electrons % 2) / 2;
  const moment =
    term === null || spin === 0
      ? null
      : derived(
          -landeFactor(term) * spin * BOHR_MAGNETON.value,
          'J T^-1',
          `Landé g_J of the NIST ground level ${level} times J times the Bohr magneton`,
        );
  const massInGev = atomMassInGev(protons, massNumber, charge);
  const name = atomName(protons, massNumber, charge);
  return {
    name,
    symbol: `${String(massNumber)}${nuclide.symbol}${chargeSuffix(charge)}`,
    pdgId: PDG_NUCLEUS_CODE_BASE + protons * PDG_PROTON_DIGITS + massNumber * PDG_MASS_DIGITS,
    family: 'atom',
    generation: null,
    statistics:
      Math.abs(spin - Math.round(spin)) < INTEGER_TOLERANCE ? 'boseEinstein' : 'fermiDirac',
    massInGev: derived(
      massInGev,
      'GeV',
      boundAnion
        ? `${nuclide.symbol}-${String(massNumber)} atom plus an electron minus the CRC electron affinity`
        : `${nuclide.symbol}-${String(massNumber)} nucleus plus ${String(electrons)} electrons minus the NIST ionization energies`,
    ),
    massScheme: 'measured',
    widthInGev: null,
    meanLifeInSeconds: meanLife(nuclide),
    electricChargeInElementaryUnits: charge,
    spinInReducedPlanckUnits: spin,
    parity: null,
    colorRepresentation: 'singlet',
    baryonNumber: massNumber,
    leptonNumbers: { electron: electrons, muon: 0, tau: 0 },
    isospin: null,
    flavorNumbers: NO_FLAVOR_NUMBERS,
    weakIsospinThirdComponent: sameForBothChiralities(0),
    weakHypercharge: sameForBothChiralities(0),
    gFactor: term === null ? null : derived(landeFactor(term), '1', `Landé g_J of ${level}`),
    magneticMomentInJoulesPerTesla: moment,
    decays: nuclearDecays(protons, massNumber, electrons, massInGev),
    antiparticleName: name,
    isSelfConjugate: false,
    constituents: [
      nucleusName(protons, massNumber),
      ...Array.from({ length: electrons }, (): ParticleName => 'electron'),
    ],
  };
}

export function hillFormula(structure: MoleculeStructure): string {
  const counts = new Map<string, number>();
  structure.atoms.forEach((atom) => {
    const symbol = elementSymbol(atom.protons);
    counts.set(symbol, (counts.get(symbol) ?? 0) + 1);
  });
  const symbols = [...counts.keys()].sort();
  const ordered = counts.has('C')
    ? [
        'C',
        ...(counts.has('H') ? ['H'] : []),
        ...symbols.filter((symbol) => symbol !== 'C' && symbol !== 'H'),
      ]
    : symbols;
  return ordered
    .map((symbol) => {
      const count = counts.get(symbol) ?? 0;
      return count === 1 ? symbol : `${symbol}${String(count)}`;
    })
    .join('');
}

export function moleculeBindingInEv(structure: MoleculeStructure): number {
  return structure.bonds.reduce((sum, bond) => {
    const first = structure.atoms[bond.first];
    const second = structure.atoms[bond.second];
    return first === undefined || second === undefined
      ? sum
      : sum + bondEnergyInEv(first.protons, second.protons, bond.order);
  }, 0);
}

function moleculeChargeSuffix(structure: MoleculeStructure): string {
  const charge = moleculeCharge(structure);
  if (charge === 0) {
    return (structure.charges ?? []).some((entry) => entry.charge !== 0) ? '±' : '';
  }
  const size = Math.abs(charge) === 1 ? '' : String(Math.abs(charge));
  return `${size}${charge > 0 ? '+' : '−'}`;
}

function moleculeMassSource(binding: number, charge: number): string {
  const bonds = `neutral atoms minus ${binding.toPrecision(6)} eV of bond energy`;
  return charge === 0
    ? bonds
    : `${bonds}, ${String(Math.abs(charge))} electron${Math.abs(charge) === 1 ? '' : 's'} ${charge > 0 ? 'removed' : 'added'}`;
}

function moleculeSpec(name: ParticleName): ParticleSpec {
  const structure = moleculeStructureOf(name);
  const binding = moleculeBindingInEv(structure);
  const charge = moleculeCharge(structure);
  const atomMasses = structure.atoms.reduce(
    (sum, atom) => sum + atomMassInGev(atom.protons, atom.massNumber, 0),
    0,
  );
  const electrons = structure.atoms.reduce((sum, atom) => sum + atom.protons, 0) - charge;
  const spin = (electrons % 2) / 2;
  return {
    name,
    symbol: `${hillFormula(structure)}${moleculeChargeSuffix(structure)}`,
    pdgId: 0,
    family: 'molecule',
    generation: null,
    statistics: spin === 0 ? 'boseEinstein' : 'fermiDirac',
    massInGev: derived(
      atomMasses -
        binding / EV_PER_GEV -
        (charge * ELECTRON_MASS_ENERGY_EQUIVALENT_IN_MEV.value) / MEV_PER_GEV,
      'GeV',
      moleculeMassSource(binding, charge),
    ),
    massScheme: 'measured',
    widthInGev: null,
    meanLifeInSeconds: null,
    electricChargeInElementaryUnits: charge,
    spinInReducedPlanckUnits: spin,
    parity: null,
    colorRepresentation: 'singlet',
    baryonNumber: structure.atoms.reduce((sum, atom) => sum + atom.massNumber, 0),
    leptonNumbers: { electron: electrons, muon: 0, tau: 0 },
    isospin: null,
    flavorNumbers: NO_FLAVOR_NUMBERS,
    weakIsospinThirdComponent: sameForBothChiralities(0),
    weakHypercharge: sameForBothChiralities(0),
    gFactor: null,
    magneticMomentInJoulesPerTesla: null,
    decays: [],
    antiparticleName: name,
    isSelfConjugate: false,
    constituents: structure.atoms.map((atom, index) =>
      atomName(atom.protons, atom.massNumber, formalChargeOf(structure, index)),
    ),
  };
}

const GENERATED_SPECS = new Map<string, ParticleSpec>();

function buildSpec(name: ParticleName): ParticleSpec {
  if (name.startsWith('molecule:')) {
    return moleculeSpec(name);
  }
  const [protons = 0, massNumber = 0, charge = 0] = parseMatterName(name);
  if (name.startsWith('nucleus:')) {
    return nucleusSpec(protons, massNumber);
  }
  if (name.startsWith('atom:')) {
    return atomSpec(protons, massNumber, charge);
  }
  throw new Error(`Unknown particle ${name}`);
}

export function particleSpec(name: ParticleName): ParticleSpec {
  const catalogSpec = PARTICLE_CATALOG[name as CatalogParticleName] as ParticleSpec | undefined;
  if (catalogSpec !== undefined) {
    return catalogSpec;
  }
  const cached = GENERATED_SPECS.get(name);
  if (cached !== undefined) {
    return cached;
  }
  const spec = buildSpec(name);
  GENERATED_SPECS.set(name, spec);
  return spec;
}

export function coolingTransitionOf(protons: number, charge: number): CoolingTransition | null {
  return (
    MATTER_DATA.coolingTransitions.find(
      (transition) => transition.protons === protons && transition.charge === charge,
    ) ?? null
  );
}

export interface MatterIdentity {
  readonly kind: 'nucleus' | 'atom';
  readonly protons: number;
  readonly massNumber: number;
  readonly charge: number;
}

const CATALOG_IDENTITIES: Readonly<Record<string, MatterIdentity>> = Object.fromEntries([
  ...Object.entries(NUCLEUS_ALIASES).map(([key, name]) => {
    const [protons = 0, massNumber = 0] = key.split(':').map(Number);
    return [name, { kind: 'nucleus', protons, massNumber, charge: protons }];
  }),
  ...Object.entries(ATOM_ALIASES).map(([key, name]) => {
    const [protons = 0, massNumber = 0, charge = 0] = key.split(':').map(Number);
    return [name, { kind: 'atom', protons, massNumber, charge }];
  }),
]);

export function matterIdentity(name: ParticleName): MatterIdentity | null {
  const known = CATALOG_IDENTITIES[name];
  if (known !== undefined) {
    return known;
  }
  const [protons = 0, massNumber = 0, charge = 0] = parseMatterName(name);
  if (name.startsWith('nucleus:')) {
    return { kind: 'nucleus', protons, massNumber, charge: protons };
  }
  if (name.startsWith('atom:')) {
    return { kind: 'atom', protons, massNumber, charge };
  }
  return null;
}

export function ionizationEnergyInEv(protons: number, charge: number): number | null {
  return groundStage(protons, charge)?.ionizationEnergyInEv ?? null;
}

export function isCatalogName(name: ParticleName): name is CatalogParticleName {
  return name in PARTICLE_CATALOG;
}
