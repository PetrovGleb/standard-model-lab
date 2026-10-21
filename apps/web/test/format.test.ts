/* Checks display formatting: ASCII catalog symbols become particle glyphs, lengths pick a readable unit, outcomes split into species only at a + that starts a new one. */
import { describe, expect, it } from 'vitest';
import { formatLength, formatMass, formatOutcome, formatSymbol } from '../src/format';

describe('format', () => {
  it('turns catalog symbols into glyphs with overlines for antiparticles', () => {
    expect(['gamma', 'mu-', 'e+', 'nu_mu', 'anti-nu_e', 'anti-u', 'W+'].map(formatSymbol)).toEqual([
      'γ',
      'μ⁻',
      'e⁺',
      'νμ',
      'ν̄ₑ',
      'ū',
      'W⁺',
    ]);
    expect(['etaMeson', 'omegaMeson', 'phiMeson'].map(formatSymbol)).toEqual(['η', 'ω', 'φ']);
  });

  it('writes masses in the largest fitting energy unit', () => {
    expect(formatMass(0.000511)).toBe('511 кэВ');
    expect(formatMass(91.19)).toBe('91.19 ГэВ');
    expect(formatMass(0)).toBe('без массы');
  });

  it('writes lengths in the largest fitting unit and noise as zero', () => {
    expect(formatLength(1.6e-9)).toContain('нм');
    expect(formatLength(0.13)).toContain('см');
    expect(formatLength(0.32)).toContain('см');
    expect(formatLength(2)).toContain('м');
    expect(formatLength(-3.98e-10)).toContain('пм');
    expect(formatLength(-9.5e-27)).toBe('0');
  });

  it('splits outcomes into species and keeps the sign of cations', () => {
    expect(formatOutcome('C2H6NO2+')).toBe('C2H6NO2+');
    expect(formatOutcome('23Na+')).toBe('23Na+');
    expect(formatOutcome('23Na++35Cl-')).toBe('23Na+ + 35Cl-');
    expect(formatOutcome('C2H6NO2++HO4S−')).toBe('C2H6NO2+ + HO4S−');
    expect(formatOutcome('4He+4He')).toBe('4He + 4He');
    expect(formatOutcome('electron+positron')).toBe('электрон + позитрон');
    expect(formatOutcome('-0.5')).toBe('↓ −½');
    expect(formatOutcome('1e+21')).toBe('1·10²¹');
  });
});
