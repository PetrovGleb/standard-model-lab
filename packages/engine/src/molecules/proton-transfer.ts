/* Brønsted proton transfer in water: every system of data/acid-base.json becomes a chain of forms, from the most protonated to the least, each a charged molecule built from its catalogue structure;
   the share of each form at the pH of the solution follows the law of mass action, share(k) ∝ Π_{j<k} Ka_j / [H₃O⁺]^k, and a complete step leaves no form above it. Forms are recognised by
   their bond graph, so the atom order of a molecule does not matter; the catalogue molecule itself joins the form with as many protons (glycine H₂N–CH₂–COOH joins the zwitterion). */
import {
  ACID_BASE_SYSTEMS,
  MOLECULE_CATALOG,
  moleculeName,
  moleculeStructureOf,
  stepNegativeLogarithm,
  substanceKey,
  type AcidBaseSystem,
  type FormalCharge,
  type MoleculeStructure,
} from '@standard-model/constants';
import type { ParticleName } from '@standard-model/contracts';

const HYDROGEN = 1;
const HYDROGEN_MASS_NUMBER = 1;
const WATER: ParticleName = 'molecule:8-16,1-1,1-1;0-1-1,0-2-1';

export interface AcidBaseChain {
  readonly molecule: string;
  readonly forms: readonly ParticleName[];
  readonly charges: readonly number[];
  readonly negativeLogarithms: readonly number[];
}

export interface ChainMembership {
  readonly chain: AcidBaseChain;
  readonly level: number;
}

function withCharge(
  charges: readonly FormalCharge[],
  atom: number,
  change: number,
): FormalCharge[] {
  const current = charges.find((entry) => entry.atom === atom)?.charge ?? 0;
  return [
    ...charges.filter((entry) => entry.atom !== atom),
    ...(current + change === 0 ? [] : [{ atom, charge: current + change }]),
  ];
}

function protonated(structure: MoleculeStructure, site: number): MoleculeStructure {
  const added = structure.atoms.length;
  return {
    atoms: [...structure.atoms, { protons: HYDROGEN, massNumber: HYDROGEN_MASS_NUMBER }],
    bonds: [...structure.bonds, { first: site, second: added, order: 1 }],
    charges: withCharge(structure.charges ?? [], site, 1),
  };
}

function deprotonated(
  structure: MoleculeStructure,
  site: number,
): { readonly structure: MoleculeStructure; readonly removed: number } {
  const removed = Math.max(
    ...structure.bonds.flatMap((bond) => {
      const other = bond.first === site ? bond.second : bond.second === site ? bond.first : -1;
      return other >= 0 && structure.atoms[other]?.protons === HYDROGEN ? [other] : [];
    }),
  );
  if (!Number.isFinite(removed)) {
    throw new Error(`Atom ${String(site)} carries no hydrogen to give away`);
  }
  const shifted = (atom: number): number => (atom > removed ? atom - 1 : atom);
  return {
    structure: {
      atoms: structure.atoms.filter((unused, index) => index !== removed),
      bonds: structure.bonds
        .filter((bond) => bond.first !== removed && bond.second !== removed)
        .map((bond) => ({ ...bond, first: shifted(bond.first), second: shifted(bond.second) })),
      charges: withCharge(structure.charges ?? [], site, -1).map((entry) => ({
        ...entry,
        atom: shifted(entry.atom),
      })),
    },
    removed,
  };
}

function chainOf(system: AcidBaseSystem): AcidBaseChain {
  const catalogued = MOLECULE_CATALOG.find((entry) => entry.key === system.molecule);
  if (catalogued === undefined) {
    throw new Error(`acid-base.json names ${system.molecule}, which molecules.json lacks`);
  }
  let structure = system.protonatedSites.reduce(protonated, catalogued.structure);
  let sites = system.steps.map((step) => step.site);
  const forms: ParticleName[] = [moleculeName(structure)];
  sites.forEach((unused, step) => {
    const site = sites[step] ?? 0;
    const next = deprotonated(structure, site);
    structure = next.structure;
    sites = sites.map((later) => (later > next.removed ? later - 1 : later));
    forms.push(moleculeName(structure));
  });
  const topCharge = system.protonatedSites.length;
  return {
    molecule: system.molecule,
    forms,
    charges: forms.map((unused, level) => topCharge - level),
    negativeLogarithms: system.steps.map(stepNegativeLogarithm),
  };
}

const CHAINS: readonly AcidBaseChain[] = ACID_BASE_SYSTEMS.map(chainOf);

const MEMBERS = new Map<string, ChainMembership>(
  CHAINS.flatMap((chain, index) => {
    const system = ACID_BASE_SYSTEMS[index];
    const parent = MOLECULE_CATALOG.find((entry) => entry.key === chain.molecule)?.name;
    return [
      ...(parent === undefined || system === undefined
        ? []
        : [[substanceKey(parent), { chain, level: system.protonatedSites.length }] as const]),
      ...chain.forms.map((form, level) => [substanceKey(form), { chain, level }] as const),
    ];
  }),
);

export function acidBaseChains(): readonly AcidBaseChain[] {
  return CHAINS;
}

export function chainMembership(species: ParticleName): ChainMembership | null {
  return species.startsWith('molecule:') ? (MEMBERS.get(substanceKey(species)) ?? null) : null;
}

export function protonationShares(chain: AcidBaseChain, acidityValue: number): number[] {
  const firstPossible = chain.negativeLogarithms.reduce(
    (first, negativeLogarithm, step) =>
      negativeLogarithm === Number.NEGATIVE_INFINITY ? step + 1 : first,
    0,
  );
  const logarithms = chain.forms.map(() => Number.NEGATIVE_INFINITY);
  let running = 0;
  for (let level = firstPossible; level < chain.forms.length; level += 1) {
    running +=
      level === firstPossible ? 0 : acidityValue - (chain.negativeLogarithms[level - 1] ?? 0);
    logarithms[level] = running;
  }
  const highest = Math.max(...logarithms);
  const weights = logarithms.map((logarithm) => 10 ** (logarithm - highest));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  return weights.map((weight) => weight / total);
}

export function meanChainCharge(chain: AcidBaseChain, acidityValue: number): number {
  return protonationShares(chain, acidityValue).reduce(
    (sum, share, level) => sum + share * (chain.charges[level] ?? 0),
    0,
  );
}

function waterIon(change: 1 | -1): ParticleName {
  const water = moleculeStructureOf(WATER);
  return moleculeName(change === 1 ? protonated(water, 0) : deprotonated(water, 0).structure);
}

export const HYDRONIUM: ParticleName = waterIon(1);
export const HYDROXIDE: ParticleName = waterIon(-1);

export function waterIonCharge(species: ParticleName): number {
  if (!species.startsWith('molecule:')) {
    return 0;
  }
  const key = substanceKey(species);
  return key === substanceKey(HYDRONIUM) ? 1 : key === substanceKey(HYDROXIDE) ? -1 : 0;
}
