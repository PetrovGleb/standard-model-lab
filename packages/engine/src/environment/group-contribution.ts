/* Joback–Reid group-contribution estimate of the normal boiling point, melting point and critical point of an organic molecule: each heavy atom with its hydrogens falls into one of the 41
   groups (ring groups for atoms on a cycle; acid, ester, aldehyde, ketone, nitrile and nitro groups take their oxygens and nitrogen), the sums give Tb, Tm, Tc and Pc; a molecule without
   carbon, or with an atom no group fits, has no estimate. */
import { JOBACK_METHOD, type MoleculeStructure } from '@standard-model/constants';

const HYDROGEN = 1;
const CARBON = 6;
const NITROGEN = 7;
const OXYGEN = 8;
const SULFUR = 16;
const HALOGEN_GROUPS: Readonly<Record<number, string>> = {
  9: 'fluorine',
  17: 'chlorine',
  35: 'bromine',
  53: 'iodine',
};
const SINGLE = 1;
const DOUBLE = 2;
const TRIPLE = 3;
const PASCALS_PER_BAR = 1e5;

export interface GroupContributionEstimate {
  readonly boilingTemperatureInKelvin: number;
  readonly meltingTemperatureInKelvin: number;
  readonly criticalTemperatureInKelvin: number;
  readonly criticalPressureInPascals: number;
}

interface Neighbour {
  readonly atom: number;
  readonly order: number;
}

class BondGraph {
  readonly neighbours: readonly (readonly Neighbour[])[];
  private readonly cyclic: readonly boolean[];

  constructor(readonly structure: MoleculeStructure) {
    this.neighbours = structure.atoms.map((unused, index) =>
      structure.bonds.flatMap((bond) =>
        bond.first === index
          ? [{ atom: bond.second, order: bond.order }]
          : bond.second === index
            ? [{ atom: bond.first, order: bond.order }]
            : [],
      ),
    );
    this.cyclic = structure.atoms.map(
      (unused, index) =>
        this.neighbours[index]?.some((neighbour) => this.connectedWithout(index, neighbour.atom)) ??
        false,
    );
  }

  protons(atom: number): number {
    return this.structure.atoms[atom]?.protons ?? 0;
  }

  onCycle(atom: number): boolean {
    return this.cyclic[atom] ?? false;
  }

  hydrogens(atom: number): number {
    return this.heavyOrLight(atom, true).length;
  }

  heavy(atom: number, order?: number): readonly Neighbour[] {
    return this.heavyOrLight(atom, false).filter(
      (neighbour) => order === undefined || neighbour.order === order,
    );
  }

  isTerminal(atom: number): boolean {
    return (this.neighbours[atom]?.length ?? 0) === 1;
  }

  private heavyOrLight(atom: number, light: boolean): readonly Neighbour[] {
    return (this.neighbours[atom] ?? []).filter(
      (neighbour) => (this.protons(neighbour.atom) === HYDROGEN) === light,
    );
  }

  private connectedWithout(start: number, goal: number): boolean {
    const seen = new Set([start]);
    const queue = [start];
    for (let atom = queue.pop(); atom !== undefined; atom = queue.pop()) {
      for (const neighbour of this.neighbours[atom] ?? []) {
        const skipped = atom === start && neighbour.atom === goal;
        if (!skipped && !seen.has(neighbour.atom)) {
          if (neighbour.atom === goal) {
            return true;
          }
          seen.add(neighbour.atom);
          queue.push(neighbour.atom);
        }
      }
    }
    return false;
  }
}

function functionalGroup(graph: BondGraph, atom: number, claimed: Set<number>): string | null {
  const protons = graph.protons(atom);
  const singles = graph.heavy(atom, SINGLE).filter((neighbour) => !claimed.has(neighbour.atom));
  if (protons === CARBON) {
    const carbonyl = graph
      .heavy(atom, DOUBLE)
      .find(
        (neighbour) => graph.protons(neighbour.atom) === OXYGEN && graph.isTerminal(neighbour.atom),
      );
    const nitrile = graph
      .heavy(atom, TRIPLE)
      .find(
        (neighbour) =>
          graph.protons(neighbour.atom) === NITROGEN && graph.isTerminal(neighbour.atom),
      );
    if (nitrile !== undefined && graph.heavy(atom, SINGLE).length === 1) {
      claimed.add(nitrile.atom);
      return 'nitrile';
    }
    if (carbonyl === undefined || graph.heavy(atom).length + graph.hydrogens(atom) !== 3) {
      return null;
    }
    const oxygens = singles.filter((neighbour) => graph.protons(neighbour.atom) === OXYGEN);
    const hydroxyl = oxygens.find(
      (neighbour) =>
        graph.hydrogens(neighbour.atom) === 1 && graph.heavy(neighbour.atom).length === 1,
    );
    const bridge = oxygens.find((neighbour) => graph.heavy(neighbour.atom).length === 2);
    const others = graph.heavy(atom, SINGLE).length;
    const take = (group: string, ...atoms: number[]) => {
      [carbonyl.atom, ...atoms].forEach((taken) => claimed.add(taken));
      return group;
    };
    if (hydroxyl !== undefined && others === 2) {
      return take('carboxylicAcid', hydroxyl.atom);
    }
    if (bridge !== undefined && others === 2) {
      return take('ester', bridge.atom);
    }
    if (graph.hydrogens(atom) === 1 && others === 1) {
      return take('aldehyde');
    }
    if (others === 2) {
      return take(graph.onCycle(atom) ? 'ringKetone' : 'ketone');
    }
    return null;
  }
  if (protons === NITROGEN) {
    const oxygens = graph
      .heavy(atom)
      .filter(
        (neighbour) => graph.protons(neighbour.atom) === OXYGEN && graph.isTerminal(neighbour.atom),
      );
    if (oxygens.length === 2 && graph.heavy(atom).length === 3) {
      oxygens.forEach((oxygen) => claimed.add(oxygen.atom));
      return 'nitro';
    }
  }
  return null;
}

function isAromaticCarbon(graph: BondGraph, atom: number): boolean {
  return (
    graph.protons(atom) === CARBON &&
    graph.onCycle(atom) &&
    graph.heavy(atom, DOUBLE).some((neighbour) => graph.onCycle(neighbour.atom))
  );
}

function plainGroup(graph: BondGraph, atom: number): string | null {
  const hydrogens = graph.hydrogens(atom);
  const singles = graph.heavy(atom, SINGLE).length;
  const doubles = graph.heavy(atom, DOUBLE).length;
  const triples = graph.heavy(atom, TRIPLE).length;
  const ring = graph.onCycle(atom);
  const shape = `${String(hydrogens)}${String(singles)}${String(doubles)}${String(triples)}`;
  const protons = graph.protons(atom);
  if (protons === CARBON) {
    const carbonGroups: Readonly<Record<string, string>> = {
      '3100': 'methyl',
      '2200': ring ? 'ringMethylene' : 'methylene',
      '1300': ring ? 'ringMethine' : 'methine',
      '0400': ring ? 'ringQuaternaryCarbon' : 'quaternaryCarbon',
      '2010': 'doubleBondedMethylene',
      '1110': ring ? 'ringDoubleBondedMethine' : 'doubleBondedMethine',
      '0210': ring ? 'ringDoubleBondedCarbon' : 'doubleBondedCarbon',
      '0020': 'cumulatedCarbon',
      '1001': 'terminalAlkyneCarbon',
      '0101': 'internalAlkyneCarbon',
    };
    return carbonGroups[shape] ?? null;
  }
  if (protons === OXYGEN) {
    const carbon = graph.heavy(atom)[0]?.atom ?? -1;
    const oxygenGroups: Readonly<Record<string, string>> = {
      '1100': isAromaticCarbon(graph, carbon) ? 'phenolHydroxyl' : 'alcoholHydroxyl',
      '0200': ring ? 'ringEther' : 'ether',
      '0010': 'otherDoubleBondedOxygen',
    };
    return oxygenGroups[shape] ?? null;
  }
  if (protons === NITROGEN) {
    const nitrogenGroups: Readonly<Record<string, string>> = {
      '2100': 'primaryAmine',
      '1200': ring ? 'ringSecondaryAmine' : 'secondaryAmine',
      '0110': ring ? 'ringImineNitrogen' : 'imineNitrogen',
      '1010': 'imine',
    };
    return shape === '0300' && !ring ? 'tertiaryAmine' : (nitrogenGroups[shape] ?? null);
  }
  if (protons === SULFUR) {
    const sulfurGroups: Readonly<Record<string, string>> = {
      '1100': 'thiol',
      '0200': ring ? 'ringThioether' : 'thioether',
    };
    return sulfurGroups[shape] ?? null;
  }
  return shape === '0100' ? (HALOGEN_GROUPS[protons] ?? null) : null;
}

function jobackGroups(structure: MoleculeStructure): readonly string[] | null {
  const graph = new BondGraph(structure);
  const heavyAtoms = structure.atoms
    .map((atom, index) => ({ protons: atom.protons, index }))
    .filter((atom) => atom.protons !== HYDROGEN);
  if (!heavyAtoms.some((atom) => atom.protons === CARBON)) {
    return null;
  }
  const claimed = new Set<number>();
  const groups: string[] = [];
  for (const { index } of heavyAtoms) {
    if (!claimed.has(index)) {
      const group = functionalGroup(graph, index, claimed);
      if (group !== null) {
        claimed.add(index);
        groups.push(group);
      }
    }
  }
  for (const { index } of heavyAtoms) {
    if (!claimed.has(index)) {
      const group = plainGroup(graph, index);
      if (group === null) {
        return null;
      }
      groups.push(group);
    }
  }
  return groups;
}

export function groupContributionEstimate(
  structure: MoleculeStructure,
): GroupContributionEstimate | null {
  const groups = jobackGroups(structure);
  if (groups === null) {
    return null;
  }
  const contributions = groups.map((key) =>
    JOBACK_METHOD.groups.find((candidate) => candidate.key === key),
  );
  const sum = (pick: (group: (typeof JOBACK_METHOD.groups)[number]) => number | null) =>
    contributions.reduce<number | null>((total, group) => {
      const value = group === undefined ? null : pick(group);
      return total === null || value === null ? null : total + value;
    }, 0);
  const boiling = sum((group) => group.boilingTemperatureInKelvin);
  const melting = sum((group) => group.meltingTemperatureInKelvin);
  const critical = sum((group) => group.criticalTemperatureShare);
  const pressure = sum((group) => group.criticalPressureShareInInverseRootBar);
  if (boiling === null || melting === null || critical === null || pressure === null) {
    return null;
  }
  const boilingTemperatureInKelvin = JOBACK_METHOD.boilingTemperatureBaseInKelvin + boiling;
  return {
    boilingTemperatureInKelvin,
    meltingTemperatureInKelvin: JOBACK_METHOD.meltingTemperatureBaseInKelvin + melting,
    criticalTemperatureInKelvin:
      boilingTemperatureInKelvin /
      (JOBACK_METHOD.criticalTemperatureDenominatorConstant +
        JOBACK_METHOD.criticalTemperatureDenominatorLinear * critical -
        critical ** 2),
    criticalPressureInPascals:
      PASCALS_PER_BAR *
      (JOBACK_METHOD.criticalPressureBaseInInverseRootBar +
        JOBACK_METHOD.criticalPressurePerAtomInInverseRootBar * structure.atoms.length -
        pressure) **
        -2,
  };
}
