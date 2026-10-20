/* Checks the molecule catalogue of the species picker: keys and structures are unique, every structure passes the valence and connectivity rules of the configurator, its written formula counts
   the same atoms as the structure, the generated mass and linearity match the molecular structure law, and a built molecule is recognised by its bond graph whatever its atom order, apart
   from its isomers, with the isotopologue of its own isotopes, and named so on the system stage and in its events. */
import {
  MOLECULE_CATALOG,
  MOLECULE_CATEGORIES,
  MOLECULE_GROUPS,
  catalogMoleculeOf,
  elementSymbol,
  moleculeName,
} from '@standard-model/constants';
import { describe, expect, it } from 'vitest';
import {
  catalogMoleculeTraits,
  computedMoleculeTraits,
  experiment,
  runExperiment,
  validateMoleculeStructure,
} from '../src/index.js';

const MASS_PRECISION = 1e-5;
const DEUTERIUM = { protons: 1, massNumber: 2, symbol: 'D' } as const;
const TRAITS_TIMEOUT_IN_MILLISECONDS = 120_000;

const SUBSCRIPTS = '₀₁₂₃₄₅₆₇₈₉';

function countOf(text: string): number {
  return text === ''
    ? 1
    : Number(
        text
          .split('')
          .map((glyph) => String(SUBSCRIPTS.indexOf(glyph)))
          .join(''),
      );
}

function atomsOfFormula(formula: string): ReadonlyMap<string, number> {
  const tokens = formula.match(/[A-Z][a-z]?|\(|\)|[₀-₉]+/g) ?? [];
  const stack: Map<string, number>[] = [new Map()];
  tokens.forEach((token, index) => {
    const next = tokens[index + 1] ?? '';
    const multiplier = /^[₀-₉]+$/.test(next) ? countOf(next) : 1;
    if (token === '(') {
      stack.push(new Map());
    } else if (token === ')') {
      const inner = stack.pop() ?? new Map<string, number>();
      const outer = stack[stack.length - 1] ?? new Map<string, number>();
      inner.forEach((count, symbol) =>
        outer.set(symbol, (outer.get(symbol) ?? 0) + count * multiplier),
      );
    } else if (!/^[₀-₉]+$/.test(token)) {
      const current = stack[stack.length - 1] ?? new Map<string, number>();
      current.set(token, (current.get(token) ?? 0) + multiplier);
    }
  });
  return stack[0] ?? new Map();
}

describe('molecule catalogue', () => {
  it('names every molecule and structure once', () => {
    expect(new Set(MOLECULE_CATALOG.map((entry) => entry.key)).size).toBe(MOLECULE_CATALOG.length);
    expect(new Set(MOLECULE_CATALOG.map((entry) => entry.name)).size).toBe(MOLECULE_CATALOG.length);
  });

  it('holds only structures the configurator accepts, in known categories', () => {
    const groups = new Set(MOLECULE_GROUPS.map((group) => group.key));
    MOLECULE_CATEGORIES.forEach((category) =>
      expect(groups.has(category.group), category.key).toBe(true),
    );
    const categories = new Set(MOLECULE_CATEGORIES.map((category) => category.key));
    MOLECULE_CATALOG.forEach((entry) => {
      expect(validateMoleculeStructure(entry.structure), entry.key).toBeNull();
      expect(categories.has(entry.category), entry.key).toBe(true);
    });
  });

  it('writes formulas that count the atoms of the structure', () => {
    MOLECULE_CATALOG.forEach((entry) => {
      const expected = new Map<string, number>();
      entry.structure.atoms.forEach((atom) => {
        const symbol =
          atom.protons === DEUTERIUM.protons && atom.massNumber === DEUTERIUM.massNumber
            ? DEUTERIUM.symbol
            : elementSymbol(atom.protons);
        expected.set(symbol, (expected.get(symbol) ?? 0) + 1);
      });
      expect(Object.fromEntries(atomsOfFormula(entry.formula)), entry.key).toEqual(
        Object.fromEntries(expected),
      );
    });
  });

  it(
    'keeps the generated mass and linearity equal to the structure law',
    () => {
      MOLECULE_CATALOG.forEach((entry) => {
        const generated = catalogMoleculeTraits(entry.key);
        const computed = computedMoleculeTraits(entry.name);
        expect(generated, entry.key).not.toBeNull();
        expect(generated?.linear, entry.key).toBe(computed.linear);
        expect(
          Math.abs((generated?.massInDaltons ?? 0) - computed.massInDaltons) /
            computed.massInDaltons,
          entry.key,
        ).toBeLessThan(MASS_PRECISION);
      });
    },
    TRAITS_TIMEOUT_IN_MILLISECONDS,
  );
});

const CARBON = { protons: 6, massNumber: 12 };
const OXYGEN = { protons: 8, massNumber: 16 };
const HYDROGEN = { protons: 1, massNumber: 1 };
const HEAVY_HYDROGEN = { protons: 1, massNumber: 2 };

function single(pairs: readonly (readonly [number, number])[]) {
  return pairs.map(([first, second]) => ({ first, second, order: 1 as const }));
}

const ETHANOL_IN_ANOTHER_ORDER = {
  atoms: [HYDROGEN, OXYGEN, CARBON, HYDROGEN, HYDROGEN, CARBON, HYDROGEN, HYDROGEN, HYDROGEN],
  bonds: single([
    [0, 1],
    [1, 2],
    [2, 3],
    [2, 4],
    [2, 5],
    [5, 6],
    [5, 7],
    [5, 8],
  ]),
};

describe('molecules recognised by the catalogue', () => {
  it('finds a molecule by its bond graph, tells isomers apart and picks the isotopologue', () => {
    expect(catalogMoleculeOf(moleculeName(ETHANOL_IN_ANOTHER_ORDER))?.key).toBe('ethanol');
    const ether = {
      atoms: [CARBON, OXYGEN, CARBON, ...Array.from({ length: 6 }, () => HYDROGEN)],
      bonds: single([
        [0, 1],
        [1, 2],
        [0, 3],
        [0, 4],
        [0, 5],
        [2, 6],
        [2, 7],
        [2, 8],
      ]),
    };
    expect(catalogMoleculeOf(moleculeName(ether))?.key).toBe('dimethylEther');
    const water = (hydrogen: typeof HYDROGEN) => ({
      atoms: [OXYGEN, hydrogen, hydrogen],
      bonds: single([
        [0, 1],
        [0, 2],
      ]),
    });
    expect(catalogMoleculeOf(moleculeName(water(HYDROGEN)))?.key).toBe('water');
    expect(catalogMoleculeOf(moleculeName(water(HEAVY_HYDROGEN)))?.key).toBe('heavyWater');
    const methyl = {
      atoms: [CARBON, HYDROGEN, HYDROGEN, HYDROGEN],
      bonds: single([
        [0, 1],
        [0, 2],
        [0, 3],
      ]),
    };
    expect(catalogMoleculeOf(moleculeName(methyl))).toBeNull();
    expect(catalogMoleculeOf('electron')).toBeNull();
  });

  it('names a known molecule on the stage and in its creation event', () => {
    const plan = experiment('namedEthanol')
      .createMolecule('fuel', ETHANOL_IN_ANOTHER_ORDER.atoms, ETHANOL_IN_ANOTHER_ORDER.bonds)
      .measureSystem('after')
      .report('frequency', ['after.heaviest'], 'heaviest')
      .build();
    const report = runExperiment(plan, { shots: 1, includeSystemReport: true }).systemReport;
    const frames = report?.frames ?? [];
    expect(frames.at(-1)?.particles[0]?.catalogName).toEqual({ ru: 'этанол', en: 'ethanol' });
    expect(JSON.stringify(frames.map((frame) => frame.events))).toContain('этанол');
  });
});
