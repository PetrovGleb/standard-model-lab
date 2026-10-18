/* Typed access to data/critical-points.json and data/phase-points.json (critical, boiling, melting and decomposition points, looked up by a substance key that ignores isotopes and atom order
   but tells isomers and charge forms apart by refining atom labels over the bond graph), data/joback1987.json (Joback group contributions) and data/allotropes.json (solid allotropes of an element). */
import type { ParticleName } from '@standard-model/contracts';
import allotropesJson from '../data/allotropes.json' with { type: 'json' };
import criticalPointsJson from '../data/critical-points.json' with { type: 'json' };
import jobackJson from '../data/joback1987.json' with { type: 'json' };
import phasePointsJson from '../data/phase-points.json' with { type: 'json' };
import { MOLECULE_CATALOG } from './molecule-catalog.js';
import {
  formalChargeOf,
  matterIdentity,
  moleculeStructureOf,
  type MoleculeStructure,
} from './particles/matter.js';

export interface SubstanceCriticalData {
  readonly species: string;
  readonly formula: string;
  readonly criticalTemperatureInKelvin: number;
  readonly criticalPressureInPascals: number;
  readonly boilingTemperatureInKelvin: number;
  readonly meltingTemperatureInKelvin: number | null;
  readonly triplePointTemperatureInKelvin: number | null;
  readonly triplePointPressureInPascals: number | null;
}

interface CriticalPointsFile {
  readonly source: string;
  readonly substances: readonly SubstanceCriticalData[];
}

const file = criticalPointsJson as unknown as CriticalPointsFile;

export const CRITICAL_POINTS_SOURCE = file.source;

function bondGraphKey(structure: MoleculeStructure): string {
  const neighbours = structure.atoms.map((unused, index) =>
    structure.bonds.flatMap((bond) =>
      bond.first === index
        ? [{ atom: bond.second, order: bond.order }]
        : bond.second === index
          ? [{ atom: bond.first, order: bond.order }]
          : [],
    ),
  );
  const rounds: string[] = [];
  let labels = structure.atoms.map(
    (atom, index) => `${String(atom.protons)}:${String(formalChargeOf(structure, index))}`,
  );
  for (;;) {
    rounds.push([...labels].sort().join(','));
    const distinct = [...new Set(labels)].sort();
    const rank = (label: string | undefined) => String(distinct.indexOf(label ?? ''));
    const refined = labels.map(
      (label, index) =>
        `${rank(label)}(${(neighbours[index] ?? [])
          .map((neighbour) => `${String(neighbour.order)}-${rank(labels[neighbour.atom])}`)
          .sort()
          .join(' ')})`,
    );
    if (new Set(refined).size === distinct.length) {
      rounds.push([...refined].sort().join(','));
      return rounds.join('|');
    }
    labels = refined;
  }
}

export function substanceKey(name: ParticleName): string {
  if (name.startsWith('molecule:')) {
    return `molecule:${bondGraphKey(moleculeStructureOf(name))}`;
  }
  const identity = matterIdentity(name);
  return identity !== null && identity.kind === 'atom' && identity.charge === 0
    ? `atom:${String(identity.protons)}`
    : name;
}

const byKey = new Map(
  file.substances.map((substance) => [substanceKey(substance.species as ParticleName), substance]),
);

export function criticalData(name: ParticleName): SubstanceCriticalData | null {
  return byKey.get(substanceKey(name)) ?? null;
}

export interface SubstancePhasePoints {
  readonly molecule: string;
  readonly formula: string;
  readonly meltingTemperatureInKelvin: number | null;
  readonly boilingTemperatureInKelvin: number | null;
  readonly decompositionTemperatureInKelvin: number | null;
  readonly reference: string;
}

interface PhasePointsFile {
  readonly source: string;
  readonly substances: readonly SubstancePhasePoints[];
}

const phasePointsFile = phasePointsJson as unknown as PhasePointsFile;

export const PHASE_POINTS_SOURCE = phasePointsFile.source;
export const PHASE_POINTS: readonly SubstancePhasePoints[] = phasePointsFile.substances;

const phasePointsByKey = new Map(
  PHASE_POINTS.map((points) => {
    const entry = MOLECULE_CATALOG.find((molecule) => molecule.key === points.molecule);
    if (entry === undefined) {
      throw new Error(
        `phase-points.json names ${points.molecule}, which the molecule catalogue lacks`,
      );
    }
    return [substanceKey(entry.name), points];
  }),
);

export function phasePoints(name: ParticleName): SubstancePhasePoints | null {
  return phasePointsByKey.get(substanceKey(name)) ?? null;
}

export interface GroupContribution {
  readonly key: string;
  readonly group: string;
  readonly criticalTemperatureShare: number | null;
  readonly criticalPressureShareInInverseRootBar: number | null;
  readonly boilingTemperatureInKelvin: number | null;
  readonly meltingTemperatureInKelvin: number | null;
}

export interface GroupContributionMethod {
  readonly source: string;
  readonly boilingTemperatureBaseInKelvin: number;
  readonly meltingTemperatureBaseInKelvin: number;
  readonly criticalTemperatureDenominatorConstant: number;
  readonly criticalTemperatureDenominatorLinear: number;
  readonly criticalPressureBaseInInverseRootBar: number;
  readonly criticalPressurePerAtomInInverseRootBar: number;
  readonly groups: readonly GroupContribution[];
}

export const JOBACK_METHOD = jobackJson as unknown as GroupContributionMethod;

export interface AllotropeName {
  readonly key: string;
  readonly ru: string;
  readonly en: string;
}

export interface MeltingPoint {
  readonly pressureInPascals: number;
  readonly temperatureInKelvin: number;
}

export interface ElementAllotropes {
  readonly protons: number;
  readonly lowPressureSolid: AllotropeName;
  readonly highPressureSolid: AllotropeName;
  readonly solidBoundaryInterceptInPascals: number;
  readonly solidBoundarySlopeInPascalsPerKelvin: number;
  readonly solidBoundaryReferenceTemperatureInKelvin: number;
  readonly lowPressureMelting: readonly MeltingPoint[];
  readonly highPressureMelting: readonly MeltingPoint[];
  readonly vaporTriplePointTemperatureInKelvin: number;
  readonly vaporTriplePointPressureInPascals: number;
  readonly sublimationEnthalpyInJoulesPerMole: number;
}

interface AllotropesFile {
  readonly source: string;
  readonly elements: readonly ElementAllotropes[];
}

const allotropesFile = allotropesJson as unknown as AllotropesFile;

export const ALLOTROPES_SOURCE = allotropesFile.source;

export function elementAllotropes(protons: number): ElementAllotropes | null {
  return allotropesFile.elements.find((element) => element.protons === protons) ?? null;
}

export const ALLOTROPE_NAMES: readonly AllotropeName[] = allotropesFile.elements.flatMap(
  (element) => [element.lowPressureSolid, element.highPressureSolid],
);
