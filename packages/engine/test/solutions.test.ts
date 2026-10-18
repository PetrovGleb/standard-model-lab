/* Checks the chemistry of solutions: the IAPWS R11-24 ionization constant of water against its own test table, neutral water at pKw/2, strong acid and base by charge balance, the Born–Haber
   dissociation of NaCl, HCl and HF in water and in acid, the electrolysis threshold from bond energies and Faraday splitting of water into H₂ and O₂. */
import {
  WATER_IONIZATION,
  ENVIRONMENT_PRESETS,
  AVOGADRO_CONSTANT,
  bondEnergyInEv,
} from '@standard-model/constants';
import type { MediumAspect, ParticleName } from '@standard-model/contracts';
import { describe, expect, it } from 'vitest';
import {
  EXPERIMENT_TEMPLATES,
  decompositionVoltageInVolts,
  dissociatedShare,
  mediumAcidity,
  runExperiment,
  waterIonizationNegativeLogarithm,
} from '../src/index.js';

const TABLE_PRECISION = 1e-6;
const EXACT = 1e-12;
const ROOM_TEMPERATURE_IN_KELVIN = 298.15;
const LITERS_PER_CUBIC_METER = 1000;
const TENTH_MOLAR = 0.1 * AVOGADRO_CONSTANT.value * LITERS_PER_CUBIC_METER;
const PH_PRECISION = 0.02;
const WATER: ParticleName = 'molecule:8-16,1-1,1-1;0-1-1,0-2-1';
const SALT: ParticleName = 'molecule:11-23,17-35;0-1-1';
const HYDROGEN_CHLORIDE: ParticleName = 'molecule:1-1,17-35;0-1-1';
const HYDROGEN_FLUORIDE: ParticleName = 'molecule:1-1,9-19;0-1-1';
const ELECTRONS_PER_WATER = 2;
const SHOTS = 200;
const ELECTROLYSIS_MOLECULES = 6;

const ocean = ENVIRONMENT_PRESETS.find((preset) => preset.name === 'oceanSurface');
const waterDensity =
  ocean?.components.find((component) => component.species === WATER)?.numberDensityPerCubicMeter ??
  0;

function solution(extra: readonly [ParticleName, number][] = []): MediumAspect {
  return {
    components: [
      { species: WATER, numberDensityPerCubicMeter: waterDensity, crossSectionInSquareMeters: 0 },
      ...extra.map(([species, numberDensityPerCubicMeter]) => ({
        species,
        numberDensityPerCubicMeter,
        crossSectionInSquareMeters: 0,
      })),
    ],
    temperatureInKelvin: ROOM_TEMPERATURE_IN_KELVIN,
    pressureInPascals: ocean?.pressureInPascals ?? 0,
    bulkVelocityInMetersPerSecond: { x: 0, y: 0, z: 0 },
    reactionMode: 'oneReactionPerStep',
  };
}

function template(name: string) {
  const plan = EXPERIMENT_TEMPLATES[name];
  if (plan === undefined) {
    throw new Error(`${name} template expected`);
  }
  return plan;
}

describe('acidity of water', () => {
  it('reproduces the IAPWS R11-24 test table', () => {
    WATER_IONIZATION.tests.forEach((test) =>
      expect(
        Math.abs(
          waterIonizationNegativeLogarithm(
            test.temperatureInKelvin,
            test.densityInGramsPerCubicCentimeter,
          ) - test.negativeLogarithm,
        ),
      ).toBeLessThan(TABLE_PRECISION),
    );
  });

  it('puts neutral water at pKw/2 and finds strong acid and base by charge balance', () => {
    const neutral = mediumAcidity(solution());
    expect(neutral).not.toBeNull();
    expect(
      Math.abs((neutral?.pH ?? 0) - (neutral?.ionizationNegativeLogarithm ?? 0) / 2),
    ).toBeLessThan(1e-9);
    expect(Math.abs((neutral?.pH ?? 0) - 7)).toBeLessThan(PH_PRECISION);
    const acid = mediumAcidity(solution([['atom:17:35:-1', TENTH_MOLAR]]));
    expect(Math.abs((acid?.pH ?? 0) - 1)).toBeLessThan(PH_PRECISION);
    const base = mediumAcidity(solution([['atom:11:23:1', TENTH_MOLAR]]));
    expect(Math.abs((base?.pH ?? 0) - ((base?.ionizationNegativeLogarithm ?? 0) - 1))).toBeLessThan(
      PH_PRECISION,
    );
  });
});

describe('Born–Haber dissociation in a solvent', () => {
  const acid = solution([
    ['proton', TENTH_MOLAR],
    ['atom:17:35:-1', TENTH_MOLAR],
  ]);

  it('dissolves salt and hydrogen chloride and keeps hydrogen fluoride whole in acid only', () => {
    expect(dissociatedShare(SALT, solution())?.share).toBeGreaterThan(0.999);
    expect(dissociatedShare(HYDROGEN_CHLORIDE, solution())?.share).toBeGreaterThan(0.999);
    expect(dissociatedShare(HYDROGEN_CHLORIDE, acid)?.share).toBeGreaterThan(0.99);
    expect(dissociatedShare(HYDROGEN_FLUORIDE, solution())?.share).toBeGreaterThan(0.99);
    expect(dissociatedShare(HYDROGEN_FLUORIDE, acid)?.share).toBeLessThan(0.01);
  });

  it('runs the salt and acid templates to their equilibrium outcomes', () => {
    const salt = runExperiment(template('saltInWater'), {
      shots: SHOTS,
      includeSystemReport: false,
    });
    expect(salt.reportValues['Что стало с солью[23Na++35Cl−+ClNa]']).toBe(1);
    const acids = runExperiment(template('acidStrength'), {
      shots: SHOTS,
      includeSystemReport: false,
    });
    expect(acids.reportValues['Молекул HCl осталось']).toBe(0);
    expect(acids.reportValues['Молекул HF осталось']).toBeGreaterThan(0.95);
  });
});

describe('electrolysis', () => {
  it('needs the bond energy balance per transferred electron', () => {
    const expected =
      (2 * bondEnergyInEv(8, 1, 1) - bondEnergyInEv(1, 1, 1) - bondEnergyInEv(8, 8, 2) / 2) /
      ELECTRONS_PER_WATER;
    expect(Math.abs((decompositionVoltageInVolts(WATER) ?? 0) - expected)).toBeLessThan(EXACT);
  });

  it('splits water into hydrogen and oxygen above the threshold and leaves it below', () => {
    const above = runExperiment(template('waterElectrolysis'), {
      shots: SHOTS,
      includeSystemReport: false,
    });
    expect(above.reportValues['Молекул H₂']).toBe(ELECTROLYSIS_MOLECULES);
    expect(above.reportValues['Молекул O₂']).toBe(ELECTROLYSIS_MOLECULES / 2);
    const below = runExperiment(template('waterElectrolysis'), {
      shots: SHOTS,
      includeSystemReport: false,
      parameters: { voltageInVolts: 1 },
    }).reportValues;
    expect(below['Молекул H₂O осталось']).toBe(ELECTROLYSIS_MOLECULES);
  });
});
