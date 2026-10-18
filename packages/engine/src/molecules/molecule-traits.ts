/* Traits of the catalogue molecules shown by the species picker: mass in daltons and linearity from the molecular structure law, kept in molecule-traits.generated.json by
   pnpm generate:molecules because building every structure takes seconds; whether a molecule is a radical follows from the parity of its electrons. */
import type { MoleculeStructure } from '@standard-model/constants';
import type { ParticleName } from '@standard-model/contracts';
import traitsJson from './molecule-traits.generated.json' with { type: 'json' };
import { molecularStructure } from './molecular-structure.js';

export interface MoleculeTraits {
  readonly massInDaltons: number;
  readonly linear: boolean;
}

const GENERATED = traitsJson.traits as Readonly<Record<string, MoleculeTraits>>;

export function computedMoleculeTraits(name: ParticleName): MoleculeTraits {
  const structure = molecularStructure(name);
  return {
    massInDaltons: structure.massInAtomicMassUnits,
    linear: structure.linear,
  };
}

export function catalogMoleculeTraits(key: string): MoleculeTraits | null {
  return GENERATED[key] ?? null;
}

export function isRadical(structure: MoleculeStructure): boolean {
  return structure.atoms.reduce((sum, atom) => sum + atom.protons, 0) % 2 === 1;
}
