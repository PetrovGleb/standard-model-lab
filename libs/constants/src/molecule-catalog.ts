/* Typed access to data/molecules.json: a catalogue of common molecules in categories gathered into groups (inorganic, acids and bases, salts, organic, biomolecules) with their written formulas, structures and species names. */
import type { ParticleName } from '@standard-model/contracts';
import moleculesJson from '../data/molecules.json' with { type: 'json' };
import { moleculeName, type MoleculeStructure } from './particles/matter.js';

export interface MoleculeCatalogRecord {
  readonly key: string;
  readonly formula: string;
  readonly ru: string;
  readonly en: string;
  readonly category: string;
  readonly name: ParticleName;
  readonly structure: MoleculeStructure;
}

export interface MoleculeGroupRecord {
  readonly key: string;
  readonly ru: string;
  readonly en: string;
}

export interface MoleculeCategoryRecord extends MoleculeGroupRecord {
  readonly group: string;
}

interface MoleculesFile {
  readonly source: string;
  readonly groups: readonly MoleculeGroupRecord[];
  readonly categories: readonly MoleculeCategoryRecord[];
  readonly molecules: readonly {
    readonly key: string;
    readonly formula: string;
    readonly ru: string;
    readonly en: string;
    readonly category: string;
    readonly atoms: readonly (readonly [number, number])[];
    readonly bonds: readonly (readonly [number, number, number])[];
  }[];
}

const file = moleculesJson as unknown as MoleculesFile;

export const MOLECULE_CATALOG_SOURCE = file.source;
export const MOLECULE_GROUPS: readonly MoleculeGroupRecord[] = file.groups;
export const MOLECULE_CATEGORIES: readonly MoleculeCategoryRecord[] = file.categories;
export const MOLECULE_CATALOG: readonly MoleculeCatalogRecord[] = file.molecules.map((entry) => {
  const structure: MoleculeStructure = {
    atoms: entry.atoms.map(([protons, massNumber]) => ({ protons, massNumber })),
    bonds: entry.bonds.map(([first, second, order]) => ({ first, second, order })),
  };
  return {
    key: entry.key,
    formula: entry.formula,
    ru: entry.ru,
    en: entry.en,
    category: entry.category,
    name: moleculeName(structure),
    structure,
  };
});
