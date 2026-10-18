/* Checks species display symbols: catalog particles, nuclei and ions with mass number and charge, and molecules as Hill formulas with subscripts and the charge of their formal charges. */
import { describe, expect, it } from 'vitest';
import { speciesSymbolResolver } from '../src/species';

const symbolOf = speciesSymbolResolver({
  particles: [
    { name: 'electron', symbol: 'e-' },
    { name: 'heliumAtom', symbol: 'He' },
  ],
  elements: [
    { protons: 1, symbol: 'H' },
    { protons: 6, symbol: 'C' },
    { protons: 7, symbol: 'N' },
    { protons: 8, symbol: 'O' },
    { protons: 15, symbol: 'P' },
    { protons: 18, symbol: 'Ar' },
  ],
});

describe('species symbols', () => {
  it('uses the catalog symbol of known particles', () => {
    expect(symbolOf('electron')).toBe('e⁻');
    expect(symbolOf('heliumAtom')).toBe('He');
  });

  it('writes nuclei and atoms with mass number, element and charge', () => {
    expect(symbolOf('atom:18:40:0')).toBe('⁴⁰Ar');
    expect(symbolOf('atom:8:16:2')).toBe('¹⁶O²⁺');
    expect(symbolOf('atom:8:16:-1')).toBe('¹⁶O⁻');
    expect(symbolOf('nucleus:6:12')).toBe('¹²C⁶⁺');
  });

  it('writes molecules as Hill formulas with subscripts', () => {
    expect(symbolOf('molecule:7-14,7-14;0-1-3')).toBe('N₂');
    expect(symbolOf('molecule:6-12,8-16,8-16;0-1-2,0-2-2')).toBe('CO₂');
    expect(symbolOf('molecule:8-16,1-1,1-1;0-1-1,0-2-1')).toBe('H₂O');
    expect(symbolOf('molecule:8-16,1-1;0-1-1;0-1')).toBe('HO⁻');
    expect(symbolOf('molecule:8-16,1-1,1-1,1-1;0-1-1,0-2-1,0-3-1;0+1')).toBe('H₃O⁺');
    expect(symbolOf('molecule:15-31,8-16,8-16,8-16,8-16;0-1-2,0-2-1,0-3-1,0-4-1;2-1,3-1,4-1')).toBe(
      'O₄P³⁻',
    );
    expect(
      symbolOf(
        'molecule:7-14,6-12,6-12,8-16,8-16,1-1,1-1,1-1,1-1,1-1;0-1-1,0-5-1,0-6-1,0-9-1,1-2-1,1-7-1,1-8-1,2-3-2,2-4-1;0+1,4-1',
      ),
    ).toBe('C₂H₅NO₂±');
    expect(symbolOf('unknownThing')).toBe('unknownThing');
  });

  it('prefers the written catalogue formula of a molecule', () => {
    const withCatalogue = speciesSymbolResolver({
      particles: [],
      elements: [
        { protons: 1, symbol: 'H' },
        { protons: 17, symbol: 'Cl' },
      ],
      molecules: [{ name: 'molecule:1-1,17-35;0-1-1', formula: 'HCl' }],
    });
    expect(withCatalogue('molecule:1-1,17-35;0-1-1')).toBe('HCl');
    expect(withCatalogue('molecule:17-35,17-35;0-1-1')).toBe('Cl₂');
  });
});
