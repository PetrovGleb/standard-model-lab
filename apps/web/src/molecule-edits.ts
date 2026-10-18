/* Pure molecule configurator helpers: the Hill formula with the ion charge, bond-order sums and formal charges per atom, the problems the engine would reject (self bonds, repeated bonds,
   valence overflow, disconnected atoms), removing an atom, and the atoms, bonds and formal charges read back from a picked molecule or atom species name. */
import type {
  BondOrder,
  CreateMoleculeStep,
  MoleculeAtom,
  MoleculeBond,
  MoleculeFormalCharge,
} from '@standard-model/contracts';
import { say } from './language';

const MOLECULE_FORMAL_CHARGES: readonly number[] = [-1, 0, 1];

export function moleculeFormula(symbols: readonly string[]): string {
  const counts = new Map<string, number>();
  symbols.forEach((symbol) => counts.set(symbol, (counts.get(symbol) ?? 0) + 1));
  const sorted = [...counts.keys()].sort();
  const ordered = counts.has('C')
    ? [
        'C',
        ...(counts.has('H') ? ['H'] : []),
        ...sorted.filter((symbol) => symbol !== 'C' && symbol !== 'H'),
      ]
    : sorted;
  return ordered
    .map((symbol) => {
      const count = counts.get(symbol) ?? 0;
      return count === 1 ? symbol : `${symbol}${String(count)}`;
    })
    .join('');
}

export function moleculeChargeText(charges: readonly MoleculeFormalCharge[] = []): string {
  const charge = charges.reduce((sum, entry) => sum + entry.charge, 0);
  if (charge === 0) {
    return charges.some((entry) => entry.charge !== 0) ? '±' : '';
  }
  const magnitude = Math.abs(charge) === 1 ? '' : String(Math.abs(charge));
  return `${magnitude}${charge > 0 ? '+' : '−'}`;
}

export function formalChargeAt(step: CreateMoleculeStep, atom: number): number {
  return (step.charges ?? [])
    .filter((entry) => entry.atom === atom)
    .reduce((sum, entry) => sum + entry.charge, 0);
}

export function withFormalCharges(
  step: CreateMoleculeStep,
  entries: readonly MoleculeFormalCharge[],
): CreateMoleculeStep {
  const kept = entries
    .filter((entry) => entry.charge !== 0)
    .sort((first, second) => first.atom - second.atom);
  const { charges, ...rest } = step;
  void charges;
  return kept.length === 0 ? rest : { ...rest, charges: kept };
}

export function withFormalCharge(
  step: CreateMoleculeStep,
  atom: number,
  charge: number,
): CreateMoleculeStep {
  return withFormalCharges(step, [
    ...(step.charges ?? []).filter((entry) => entry.atom !== atom),
    { atom, charge },
  ]);
}

export function formalChargeOptions(protons: number): readonly number[] {
  return MOLECULE_FORMAL_CHARGES.filter((charge) => charge < protons);
}

export function withoutAtom(step: CreateMoleculeStep, removed: number): CreateMoleculeStep {
  const shift = (index: number): number => (index > removed ? index - 1 : index);
  return withFormalCharges(
    {
      ...step,
      atoms: step.atoms.filter((unused, index) => index !== removed),
      bonds: step.bonds
        .filter((bond) => bond.first !== removed && bond.second !== removed)
        .map((bond) => ({ ...bond, first: shift(bond.first), second: shift(bond.second) })),
    },
    (step.charges ?? [])
      .filter((entry) => entry.atom !== removed)
      .map((entry) => ({ ...entry, atom: shift(entry.atom) })),
  );
}

export function valenceUsed(step: CreateMoleculeStep, atom: number): number {
  return step.bonds
    .filter((bond) => bond.first === atom || bond.second === atom)
    .reduce((sum, bond) => sum + bond.order, 0);
}

export function moleculeProblems(
  step: CreateMoleculeStep,
  maximumValence: (protons: number) => number,
): readonly string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  step.bonds.forEach((bond) => {
    if (bond.first === bond.second) {
      problems.push(
        say(
          `Связь атома ${String(bond.first + 1)} с самим собой`,
          `Atom ${String(bond.first + 1)} is bonded to itself`,
        ),
      );
    }
    const key = [bond.first, bond.second].sort((left, right) => left - right).join('-');
    if (seen.has(key)) {
      problems.push(
        say(
          `Атомы ${key.replace('-', ' и ')} связаны дважды: оставьте одну связь нужного порядка`,
          `Atoms ${key.replace('-', ' and ')} are bonded twice: keep one bond of the right order`,
        ),
      );
    }
    seen.add(key);
  });
  step.atoms.forEach((atom, index) => {
    const used = valenceUsed(step, index);
    const allowed = maximumValence(atom.protons);
    if (used > allowed) {
      problems.push(
        say(
          `У атома ${String(index + 1)} сумма связей ${String(used)}, а валентность не больше ${String(allowed)}`,
          `Atom ${String(index + 1)} has bonds summing to ${String(used)}, but its valence is at most ${String(allowed)}`,
        ),
      );
    }
  });
  const reached = new Set<number>([0]);
  let grew = true;
  while (grew) {
    grew = false;
    step.bonds.forEach((bond) => {
      if (reached.has(bond.first) !== reached.has(bond.second)) {
        reached.add(bond.first);
        reached.add(bond.second);
        grew = true;
      }
    });
  }
  if (reached.size < step.atoms.length) {
    problems.push(
      say(
        'Не все атомы соединены связями: молекула должна быть одним целым',
        'Not all atoms are connected by bonds: the molecule must be one piece',
      ),
    );
  }
  return problems;
}

const MOLECULE_NAME = /^molecule:([\d,-]+);([\d,-]*)(?:;([\d,+-]*))?$/;
const FORMAL_CHARGE = /^(\d+)([+-]\d+)$/;
const NEUTRAL_ATOM_NAME = /^atom:(\d+):(\d+):0$/;
const BOND_ORDERS: readonly BondOrder[] = [1, 2, 3];

function atomWithIsotope(
  protons: number,
  massNumber: number,
  defaultMassNumber: (protons: number) => number | undefined,
): MoleculeAtom {
  return defaultMassNumber(protons) === massNumber ? { protons } : { protons, massNumber };
}

export function atomFromSpecies(
  species: string,
  defaultMassNumber: (protons: number) => number | undefined,
): MoleculeAtom | null {
  const match = NEUTRAL_ATOM_NAME.exec(species);
  return match === null
    ? null
    : atomWithIsotope(Number(match[1]), Number(match[2]), defaultMassNumber);
}

export function moleculeFromSpecies(
  species: string,
  defaultMassNumber: (protons: number) => number | undefined,
): {
  readonly atoms: readonly MoleculeAtom[];
  readonly bonds: readonly MoleculeBond[];
  readonly charges?: readonly MoleculeFormalCharge[];
} | null {
  const match = MOLECULE_NAME.exec(species);
  if (match === null) {
    return null;
  }
  const atoms = (match[1] ?? '').split(',').map((atom) => {
    const [protons = 0, massNumber = 0] = atom.split('-').map(Number);
    return atomWithIsotope(protons, massNumber, defaultMassNumber);
  });
  const bonds = (match[2] ?? '')
    .split(',')
    .filter((bond) => bond !== '')
    .flatMap((bond) => {
      const [first = 0, second = 0, order = 0] = bond.split('-').map(Number);
      const bondOrder = BOND_ORDERS.find((candidate) => candidate === order);
      return bondOrder === undefined ? [] : [{ first, second, order: bondOrder }];
    });
  const charges = (match[3] ?? '').split(',').flatMap((entry) => {
    const charge = FORMAL_CHARGE.exec(entry);
    return charge === null ? [] : [{ atom: Number(charge[1]), charge: Number(charge[2]) }];
  });
  return charges.length === 0 ? { atoms, bonds } : { atoms, bonds, charges };
}
