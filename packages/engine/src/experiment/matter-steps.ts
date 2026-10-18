/* Matter creation steps: turn createNucleus, createAtom and createMolecule into generated particle names (default isotope = most abundant) and explain why a requested nuclide, ion or bond pattern does not exist. */
import {
  atomName,
  defaultMassNumber,
  elementRecord,
  elementSymbol,
  moleculeName,
  nucleusName,
  nuclideRecord,
  MATTER_DATA,
  matterIdentity,
  particleSpec,
  type MoleculeStructure,
} from '@standard-model/constants';
import {
  localizedText,
  type CreateAtomStep,
  type CreateMoleculeStep,
  type CreateNucleusStep,
  type LocalizedText,
  type ParticleName,
} from '@standard-model/contracts';
import { validateMoleculeStructure } from '../molecules/molecular-structure.js';

export type MatterStep = CreateNucleusStep | CreateAtomStep | CreateMoleculeStep;

const LISTED_ISOTOPES = 8;

function knownIsotopes(protons: number): string {
  const masses = MATTER_DATA.nuclides
    .filter(
      (nuclide) =>
        nuclide.protons === protons && (nuclide.stable || nuclide.halfLifeInSeconds !== null),
    )
    .sort(
      (first, second) =>
        Number(second.stable) - Number(first.stable) ||
        (second.halfLifeInSeconds ?? 0) - (first.halfLifeInSeconds ?? 0),
    )
    .slice(0, LISTED_ISOTOPES)
    .map((nuclide) => nuclide.massNumber)
    .sort((first, second) => first - second);
  return masses.length === 0 ? 'none' : masses.join(', ');
}

function nuclideProblem(protons: number, massNumber: number): LocalizedText | null {
  return nuclideRecord(protons, massNumber) === null
    ? localizedText(
        `в NUBASE2020 нет нуклида ${elementSymbol(protons)}-${String(massNumber)} (Z = ${String(protons)}, A = ${String(massNumber)}); известные массовые числа: ${knownIsotopes(protons)}`,
        `there is no nuclide ${elementSymbol(protons)}-${String(massNumber)} (Z = ${String(protons)}, A = ${String(massNumber)}) in NUBASE2020; known mass numbers: ${knownIsotopes(protons)}`,
      )
    : null;
}

export function moleculeStructureOfStep(step: CreateMoleculeStep): MoleculeStructure {
  return {
    atoms: step.atoms.map((atom) => ({
      protons: atom.protons,
      massNumber: atom.massNumber ?? defaultMassNumber(atom.protons),
    })),
    bonds: step.bonds,
    charges: (step.charges ?? []).filter((entry) => entry.charge !== 0),
  };
}

export function matterStepProblem(step: MatterStep): LocalizedText | null {
  switch (step.operation) {
    case 'createNucleus':
      return step.massNumber < step.protons
        ? localizedText(
            `ядру с ${String(step.protons)} протонами нужно массовое число не меньше ${String(step.protons)}`,
            `a nucleus with ${String(step.protons)} protons needs a mass number of at least ${String(step.protons)}`,
          )
        : nuclideProblem(step.protons, step.massNumber);
    case 'createAtom': {
      if (elementRecord(step.protons) === null) {
        return localizedText(
          `в таблицах NIST ASD нет элемента с Z = ${String(step.protons)}`,
          `no element with Z = ${String(step.protons)} in the NIST ASD tables`,
        );
      }
      const charge = step.charge ?? 0;
      if (charge >= step.protons) {
        return localizedText(
          `заряд ${String(charge)} снимает все электроны ${elementSymbol(step.protons)}; для голого ядра используйте createNucleus`,
          `charge ${String(charge)} strips every electron of ${elementSymbol(step.protons)}; use createNucleus for a bare nucleus`,
        );
      }
      return nuclideProblem(step.protons, step.massNumber ?? defaultMassNumber(step.protons));
    }
    case 'createMolecule': {
      const missing = step.atoms.find((atom) => elementRecord(atom.protons) === null);
      if (missing !== undefined) {
        return localizedText(
          `в таблицах NIST ASD нет элемента с Z = ${String(missing.protons)}`,
          `no element with Z = ${String(missing.protons)} in the NIST ASD tables`,
        );
      }
      const structure = moleculeStructureOfStep(step);
      const isotope = structure.atoms
        .map((atom) => nuclideProblem(atom.protons, atom.massNumber))
        .find((problem) => problem !== null);
      return isotope ?? validateMoleculeStructure(structure);
    }
  }
}

export function matterStepName(step: MatterStep): ParticleName {
  switch (step.operation) {
    case 'createNucleus':
      return nucleusName(step.protons, step.massNumber);
    case 'createAtom':
      return atomName(
        step.protons,
        step.massNumber ?? defaultMassNumber(step.protons),
        step.charge ?? 0,
      );
    case 'createMolecule':
      return moleculeName(moleculeStructureOfStep(step));
  }
}

export function labelBaseOf(name: string): string {
  if (!name.includes(':')) {
    return name;
  }
  const identity = matterIdentity(name as ParticleName);
  if (identity === null) {
    return `molecule${particleSpec(name as ParticleName).symbol}`;
  }
  const symbol = elementSymbol(identity.protons);
  if (identity.kind === 'nucleus') {
    return `nucleus${symbol}${String(identity.massNumber)}`;
  }
  return identity.charge === 0
    ? `atom${symbol}${String(identity.massNumber)}`
    : `ion${symbol}${String(identity.massNumber)}plus${String(identity.charge)}`;
}
