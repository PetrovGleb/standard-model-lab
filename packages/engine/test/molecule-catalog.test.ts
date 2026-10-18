/* Checks the molecule catalogue of the species picker: keys and structures are unique, every structure passes the valence and connectivity rules of the configurator, its written formula counts
   the same atoms as the structure, and the generated mass and linearity match the molecular structure law. */
import {
  MOLECULE_CATALOG,
  MOLECULE_CATEGORIES,
  MOLECULE_GROUPS,
  elementSymbol,
} from '@standard-model/constants';
import { describe, expect, it } from 'vitest';
import {
  catalogMoleculeTraits,
  computedMoleculeTraits,
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
