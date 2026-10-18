/* Checks deconfinement: the equilibrium gluon density against 16ζ(3)T³/π² of a massless Bose gas, the crossover temperature from the PDG data, nucleons melting into their quarks in a plasma hotter
   than the crossover with the quark–gluon plasma phase, and the quarks binding back into two hadrons once the plasma has cooled below it. */
import {
  BOLTZMANN_CONSTANT_IN_EV_PER_KELVIN,
  PDG_2026,
  REDUCED_PLANCK_CONSTANT_IN_EV_SECOND,
  SPEED_OF_LIGHT_IN_VACUUM,
} from '@standard-model/constants';
import { describe, expect, it } from 'vitest';
import {
  CROSSOVER_TEMPERATURE_IN_GEV,
  EXPERIMENT_TEMPLATES,
  equilibriumNumberDensityPerCubicMeter,
  runExperiment,
} from '../src/index.js';

const APERY_CONSTANT = 1.2020569031595942;
const GLUON_STATES = 16;
const TEMPERATURE_IN_EV = 3e8;
const DENSITY_PRECISION = 1e-6;
const SHOTS = 300;
const NUCLEONS = 2;

describe('deconfinement', () => {
  it('fills the plasma with gluons at the density of a massless Bose gas', () => {
    const kelvin = TEMPERATURE_IN_EV / BOLTZMANN_CONSTANT_IN_EV_PER_KELVIN.value;
    const inverseLength =
      TEMPERATURE_IN_EV /
      (REDUCED_PLANCK_CONSTANT_IN_EV_SECOND.value * SPEED_OF_LIGHT_IN_VACUUM.value);
    const expected = (GLUON_STATES * APERY_CONSTANT * inverseLength ** 3) / Math.PI ** 2;
    expect(
      Math.abs(equilibriumNumberDensityPerCubicMeter('gluon', kelvin) / expected - 1),
    ).toBeLessThan(DENSITY_PRECISION);
    expect(CROSSOVER_TEMPERATURE_IN_GEV).toBe(
      PDG_2026.couplings.qcdCrossoverTemperatureInGev.value,
    );
  });

  it('melts nucleons into quarks above the crossover and binds them back below it', () => {
    const plan = EXPERIMENT_TEMPLATES.quarkGluonSoup;
    if (plan === undefined) {
      throw new Error('quarkGluonSoup template expected');
    }
    const values = runExperiment(plan, { shots: SHOTS, includeSystemReport: false }).reportValues;
    expect(values['Состав в горячей плазме[down+down+down+up+up+up]']).toBe(1);
    expect(values['Фаза в горячей плазме[quarkGluonPlasma]']).toBe(1);
    expect(values['Адронов после остывания']).toBe(NUCLEONS);
  });
});
