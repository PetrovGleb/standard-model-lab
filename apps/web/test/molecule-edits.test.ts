/* Checks the molecule configurator helpers: Hill formulas with the ion charge, valence sums, formal charges per atom, atom removal and the problems shown before the engine sees the plan. */
import type { CreateMoleculeStep } from '@standard-model/contracts';
import { describe, expect, it } from 'vitest';
import {
  atomFromSpecies,
  formalChargeAt,
  formalChargeOptions,
  moleculeChargeText,
  moleculeFormula,
  moleculeFromSpecies,
  moleculeProblems,
  valenceUsed,
  withFormalCharge,
  withoutAtom,
} from '../src/molecule-edits';

const WATER: CreateMoleculeStep = {
  operation: 'createMolecule',
  label: 'water',
  atoms: [{ protons: 8 }, { protons: 1 }, { protons: 1 }],
  bonds: [
    { first: 0, second: 1, order: 1 },
    { first: 0, second: 2, order: 1 },
  ],
};
const VALENCE: Readonly<Record<number, number>> = { 1: 1, 6: 4, 8: 3 };
const valenceOf = (protons: number): number => VALENCE[protons] ?? 0;

describe('molecule configurator', () => {
  it('writes Hill formulas with carbon and hydrogen first', () => {
    expect(moleculeFormula(['O', 'H', 'H'])).toBe('H2O');
    expect(moleculeFormula(['O', 'C', 'H', 'H', 'H', 'H'])).toBe('CH4O');
  });

  it('accepts water and sums bond orders per atom', () => {
    expect(moleculeProblems(WATER, valenceOf)).toEqual([]);
    expect(valenceUsed(WATER, 0)).toBe(2);
  });

  it('reports valence overflow, repeated bonds and loose atoms', () => {
    const broken: CreateMoleculeStep = {
      ...WATER,
      atoms: [...WATER.atoms, { protons: 1 }],
      bonds: [...WATER.bonds, { first: 1, second: 0, order: 1 }],
    };
    const problems = moleculeProblems(broken, valenceOf);
    expect(problems.some((problem) => problem.includes('дважды'))).toBe(true);
    expect(problems.some((problem) => problem.includes('валентность'))).toBe(true);
    expect(problems.some((problem) => problem.includes('соединены'))).toBe(true);
  });

  it('reads atoms and bonds back from picked species names', () => {
    const defaults: Readonly<Record<number, number>> = { 1: 1, 8: 16 };
    const defaultMassNumber = (protons: number): number | undefined => defaults[protons];
    expect(moleculeFromSpecies('molecule:8-16,1-1,1-1;0-1-1,0-2-1', defaultMassNumber)).toEqual({
      atoms: WATER.atoms,
      bonds: WATER.bonds,
    });
    expect(
      moleculeFromSpecies('molecule:1-2,8-16,1-2;0-1-1,1-2-1', defaultMassNumber)?.atoms,
    ).toEqual([{ protons: 1, massNumber: 2 }, { protons: 8 }, { protons: 1, massNumber: 2 }]);
    expect(atomFromSpecies('atom:8:18:0', defaultMassNumber)).toEqual({
      protons: 8,
      massNumber: 18,
    });
    expect(atomFromSpecies('atom:8:16:0', defaultMassNumber)).toEqual({ protons: 8 });
    expect(atomFromSpecies('atom:8:16:-1', defaultMassNumber)).toBeNull();
    expect(moleculeFromSpecies('electron', defaultMassNumber)).toBeNull();
  });

  it('reads formal charges back from molecular ion names', () => {
    const defaults: Readonly<Record<number, number>> = { 1: 1, 6: 12, 7: 14, 8: 16 };
    const defaultMassNumber = (protons: number): number | undefined => defaults[protons];
    expect(moleculeFromSpecies('molecule:8-16,1-1;0-1-1;0-1', defaultMassNumber)).toEqual({
      atoms: [{ protons: 8 }, { protons: 1 }],
      bonds: [{ first: 0, second: 1, order: 1 }],
      charges: [{ atom: 0, charge: -1 }],
    });
    const zwitterion = moleculeFromSpecies(
      'molecule:7-14,6-12,6-12,8-16,8-16,1-1,1-1,1-1,1-1,1-1;0-1-1,0-5-1,0-6-1,0-7-1,1-2-1,1-8-1,1-9-1,2-3-2,2-4-1;0+1,4-1',
      defaultMassNumber,
    );
    expect(zwitterion?.charges).toEqual([
      { atom: 0, charge: 1 },
      { atom: 4, charge: -1 },
    ]);
    expect(moleculeChargeText(zwitterion?.charges)).toBe('±');
  });

  it('sets, clears and shifts formal charges and writes the ion charge', () => {
    const hydroxide = withFormalCharge(withoutAtom(WATER, 2), 0, -1);
    expect(hydroxide.charges).toEqual([{ atom: 0, charge: -1 }]);
    expect(formalChargeAt(hydroxide, 0)).toBe(-1);
    expect(moleculeChargeText(hydroxide.charges)).toBe('−');
    expect(withFormalCharge(hydroxide, 0, 0)).not.toHaveProperty('charges');
    const shifted = withoutAtom(withFormalCharge(WATER, 2, 1), 1);
    expect(shifted.charges).toEqual([{ atom: 1, charge: 1 }]);
    expect(withoutAtom(withFormalCharge(WATER, 2, 1), 2)).not.toHaveProperty('charges');
    expect(
      moleculeChargeText([
        { atom: 0, charge: 1 },
        { atom: 1, charge: 1 },
      ]),
    ).toBe('2+');
    expect(moleculeChargeText(WATER.charges)).toBe('');
    expect(formalChargeOptions(1)).toEqual([-1, 0]);
    expect(formalChargeOptions(8)).toEqual([-1, 0, 1]);
  });
});
