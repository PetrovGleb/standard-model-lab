/* Catalog entries for the PDG 2026 mesons and baryons: masses, widths, lifetimes and decays from data/pdg2026.json; charge, flavour, baryon number and statistics follow from the quark content, two-body modes between isospin multiplets are split by Clebsch–Gordan coefficients. */
import type {
  DecayChannel,
  DecayProduct,
  FlavorNumbers,
  ParticleFamily,
  ParticleName,
  ParticleSpec,
} from '@standard-model/contracts';
import { PDG_2026, pdgQuantity } from '../pdg.js';
import { isospinChannels, type IsospinMode } from './isospin.js';
import { QUARK_SPECS } from './quarks.js';
import { NO_FLAVOR_NUMBERS, NO_LEPTON_NUMBERS, sameForBothChiralities } from './shared.js';

const GELL_MANN_NISHIJIMA_FACTOR = 2;
const CHARGE_CONJUGATE_MODES_PER_ENTRY = 2;
const INTEGER_TOLERANCE = 1e-9;

interface MeasuredValue {
  readonly value: number;
  readonly uncertainty: number | null;
}

interface HadronEntry {
  readonly symbol: string;
  readonly pdgId: number;
  readonly quarkContent: readonly string[];
  readonly isospin: number | null;
  readonly isospinThirdComponent: number | null;
  readonly spin: number;
  readonly parity: number;
  readonly massInGev: MeasuredValue;
  readonly widthInGev: MeasuredValue | null;
  readonly meanLifeInSeconds: MeasuredValue | null;
  readonly selfConjugate: boolean;
  readonly antiparticle: string | null;
}

interface BranchingEntry extends MeasuredValue {
  readonly products?: readonly string[];
  readonly isospinFamilies?: readonly string[];
  readonly mode?: string;
  readonly chargeConjugatesTogether?: boolean;
}

type BranchingTable = Readonly<Record<string, readonly BranchingEntry[]>>;

export function quarkOf(name: string): { readonly spec: ParticleSpec; readonly sign: number } {
  const quark = QUARK_SPECS.find((spec) => spec.name === name);
  if (quark !== undefined) {
    return { spec: quark, sign: 1 };
  }
  const antiquark = QUARK_SPECS.find((spec) => spec.antiparticleName === name);
  if (antiquark === undefined) {
    throw new Error(`${name} is not a quark`);
  }
  return { spec: antiquark, sign: -1 };
}

export function flavorOfQuarks(content: readonly string[]): FlavorNumbers {
  return content.map(quarkOf).reduce(
    (total, { spec, sign }) => ({
      strangeness: total.strangeness + sign * spec.flavorNumbers.strangeness,
      charm: total.charm + sign * spec.flavorNumbers.charm,
      bottomness: total.bottomness + sign * spec.flavorNumbers.bottomness,
      topness: total.topness + sign * spec.flavorNumbers.topness,
    }),
    NO_FLAVOR_NUMBERS,
  );
}

export function sumOverQuarks(
  content: readonly string[],
  property: (spec: ParticleSpec) => number,
): number {
  return content.map(quarkOf).reduce((total, { spec, sign }) => total + sign * property(spec), 0);
}

function isInteger(value: number): boolean {
  return Math.abs(value - Math.round(value)) < INTEGER_TOLERANCE;
}

function channels(
  name: string,
  entry: HadronEntry,
  table: BranchingTable,
): readonly DecayChannel[] {
  return (table[name] ?? []).flatMap((branching): readonly DecayChannel[] => {
    if (branching.isospinFamilies !== undefined) {
      return isospinChannels(
        name,
        entry.isospin ?? 0,
        entry.isospinThirdComponent ?? 0,
        branching as IsospinMode,
      );
    }
    const modes =
      branching.chargeConjugatesTogether === true ? CHARGE_CONJUGATE_MODES_PER_ENTRY : 1;
    return [
      {
        products: (branching.products ?? []) as readonly DecayProduct[],
        branchingFraction: pdgQuantity(
          {
            value: branching.value / modes,
            uncertainty: branching.uncertainty === null ? null : branching.uncertainty / modes,
          },
          `${name} branching fraction`,
          '',
        ),
      },
    ];
  });
}

function hadron(
  name: string,
  entry: HadronEntry,
  family: ParticleFamily,
  table: BranchingTable,
): ParticleSpec {
  const charge = sumOverQuarks(entry.quarkContent, (spec) => spec.electricChargeInElementaryUnits);
  const isospinThird = entry.isospinThirdComponent ?? 0;
  return {
    name: name as ParticleName,
    symbol: entry.symbol,
    pdgId: entry.pdgId,
    family,
    generation: null,
    statistics: isInteger(entry.spin) ? 'boseEinstein' : 'fermiDirac',
    massInGev: pdgQuantity(entry.massInGev, `${name} mass`, 'GeV'),
    massScheme: 'measured',
    widthInGev:
      entry.widthInGev === null ? null : pdgQuantity(entry.widthInGev, `${name} width`, 'GeV'),
    meanLifeInSeconds:
      entry.meanLifeInSeconds === null
        ? null
        : pdgQuantity(entry.meanLifeInSeconds, `${name} mean life`, 's'),
    electricChargeInElementaryUnits: charge,
    spinInReducedPlanckUnits: entry.spin,
    parity: entry.parity as 1 | -1,
    colorRepresentation: 'singlet',
    baryonNumber: sumOverQuarks(entry.quarkContent, (spec) => spec.baryonNumber),
    leptonNumbers: NO_LEPTON_NUMBERS,
    isospin: entry.isospin === null ? null : { total: entry.isospin, thirdComponent: isospinThird },
    flavorNumbers: entry.selfConjugate ? NO_FLAVOR_NUMBERS : flavorOfQuarks(entry.quarkContent),
    weakIsospinThirdComponent: sameForBothChiralities(isospinThird),
    weakHypercharge: sameForBothChiralities(GELL_MANN_NISHIJIMA_FACTOR * (charge - isospinThird)),
    gFactor: null,
    magneticMomentInJoulesPerTesla: null,
    decays: channels(name, entry, table),
    antiparticleName: (entry.antiparticle ?? name) as ParticleName,
    isSelfConjugate: entry.selfConjugate,
    constituents: entry.quarkContent as readonly ParticleName[],
  };
}

function hadrons(
  entries: Readonly<Record<string, HadronEntry>>,
  family: ParticleFamily,
  table: BranchingTable,
): readonly ParticleSpec[] {
  return Object.entries(entries).map(([name, entry]) => hadron(name, entry, family, table));
}

export const MESON_SPECS = hadrons(
  PDG_2026.mesons as Readonly<Record<string, HadronEntry>>,
  'meson',
  PDG_2026.mesonBranchingFractions as BranchingTable,
);

export const BARYON_SPECS = hadrons(
  PDG_2026.baryons as Readonly<Record<string, HadronEntry>>,
  'baryon',
  PDG_2026.baryonBranchingFractions as BranchingTable,
);
