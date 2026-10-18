/* Checks the CODATA name mapping on representative names and that the generated module covers the whole table. */
import { describe, expect, it } from 'vitest';
import { CODATA_CONSTANT_COUNT } from '../src/codata.generated.js';
import { toConstantName } from '../src/constant-name.js';

const CODATA_TABLE_SIZE = 355;

describe('toConstantName', () => {
  it.each([
    ['speed of light in vacuum', 'SPEED_OF_LIGHT_IN_VACUUM'],
    ['electron mag. mom. anomaly', 'ELECTRON_MAGNETIC_MOMENT_ANOMALY'],
    ['proton-electron mass ratio', 'PROTON_TO_ELECTRON_MASS_RATIO'],
    ['Bohr magneton in K/T', 'BOHR_MAGNETON_IN_KELVIN_PER_TESLA'],
    ['Loschmidt constant (273.15 K, 100 kPa)', 'LOSCHMIDT_CONSTANT_AT_273_15_K_100_KPA'],
    ['hyperfine transition frequency of Cs-133', 'HYPERFINE_TRANSITION_FREQUENCY_OF_CESIUM_133'],
    ['elementary charge over h-bar', 'ELEMENTARY_CHARGE_OVER_REDUCED_PLANCK_CONSTANT'],
    ['fine-structure constant', 'FINE_STRUCTURE_CONSTANT'],
    ['alpha particle mass in u', 'ALPHA_PARTICLE_MASS_IN_ATOMIC_MASS_UNITS'],
  ])('maps "%s"', (codataName, expected) => {
    expect(toConstantName(codataName)).toBe(expected);
  });

  it('covers the whole CODATA table', () => {
    expect(CODATA_CONSTANT_COUNT).toBe(CODATA_TABLE_SIZE);
  });
});
