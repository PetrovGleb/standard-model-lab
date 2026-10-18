/* Checks the charge balance of hydrogen and helium in an electron medium: the Voronov 1997 fit as parsed from cfit.f, three-body recombination by detailed balance, the Saha and coronal limits, the charge-state chains, and seeded Monte Carlo runs that keep hydrogen cold, strip it when hot and land on the model equilibrium in between. */
import { readFileSync } from 'node:fs';
import {
  BOLTZMANN_CONSTANT_IN_EV_PER_KELVIN,
  ELECTRON_MASS_ENERGY_EQUIVALENT_IN_MEV,
  LOSCHMIDT_CONSTANT_AT_273_15_K_101_325_KPA,
  PLANCK_CONSTANT_IN_EV_PER_HERTZ,
  SPEED_OF_LIGHT_IN_VACUUM,
  collisionalIonizationFit,
  groundStatisticalWeight,
} from '@standard-model/constants';
import type { ExperimentPlan, MediumComponent, ParticleName } from '@standard-model/contracts';
import { markovTransitionMatrix, statisticalTolerance } from '@standard-model/utils';
import { describe, expect, it } from 'vitest';
import {
  EXPERIMENT_TEMPLATES,
  bindingEnergyInEv,
  chargeChain,
  chargeChainGenerator,
  chargeChainRates,
  electronImpactIonizationRateCoefficientInCubicMetersPerSecond,
  radiativeRecombinationRateCoefficientInCubicMetersPerSecond,
  runExperiment,
  threeBodyRecombinationRateCoefficientInMetersToTheSixthPerSecond,
} from '../src/index.js';

const SHOTS = 10_000;
const EV_PER_MEV = 1e6;
const CUBIC_METERS_PER_CUBIC_CENTIMETER = 1e-6;
const LOSCHMIDT_DENSITY = LOSCHMIDT_CONSTANT_AT_273_15_K_101_325_KPA.value;
const DILUTE_DENSITY = 1e10;
const CRUSHING_DENSITY = 1e28;
const RADIATIVE_SHARE_AT_CRUSHING_DENSITY = 1e-4;
const COLD_TEMPERATURE_IN_KELVIN = 3000;
const LAB_TEMPERATURE_IN_KELVIN = 1e4;
const HALF_IONIZED_TEMPERATURE_IN_KELVIN = 2.6e4;
const MILLION_KELVIN = 1e6;
const USER_TEMPERATURE_IN_KELVIN = 1.57e8;
const BALANCE_WAIT_IN_SECONDS = 1e-6;
const VORONOV_FILE = new URL('../../../libs/constants/data/voronov1997/cfit.f', import.meta.url);

function electrons(density: number): MediumComponent {
  return {
    species: 'electron',
    numberDensityPerCubicMeter: density,
    crossSectionInSquareMeters: 0,
  };
}

function voronovLine(protons: number, electrons: number): readonly number[] {
  const line = readFileSync(VORONOV_FILE, 'utf8')
    .split('\n')
    .find((candidate) =>
      new RegExp(`DATA\\(CF\\(I,\\s*${String(protons)},\\s*${String(electrons)}\\),`).test(
        candidate,
      ),
    );
  return (line?.split('/')[1] ?? '').split(',').map((value) => Number(value));
}

function sahaRatio(atom: ParticleName, density: number, temperatureInKelvin: number): number {
  const thermal = BOLTZMANN_CONSTANT_IN_EV_PER_KELVIN.value * temperatureInKelvin;
  const wavelength =
    (PLANCK_CONSTANT_IN_EV_PER_HERTZ.value * SPEED_OF_LIGHT_IN_VACUUM.value) /
    Math.sqrt(2 * Math.PI * ELECTRON_MASS_ENERGY_EQUIVALENT_IN_MEV.value * EV_PER_MEV * thermal);
  return Math.exp(-bindingEnergyInEv(atom) / thermal) / (wavelength ** 3 * density);
}

function protonFraction(values: Readonly<Record<string, number | null>>): number {
  return Object.entries(values)
    .filter(([key]) => key.includes('proton') && !key.includes('hydrogenAtom'))
    .reduce((sum, [, value]) => sum + (value ?? 0), 0);
}

function balancePlan(temperatureInKelvin: number): ExperimentPlan {
  const plan = EXPERIMENT_TEMPLATES.hydrogenPlasmaBalance;
  if (plan === undefined) {
    throw new Error('hydrogenPlasmaBalance template expected');
  }
  return { ...plan, parameters: { ...plan.parameters, temperatureInKelvin } };
}

function modelProtonFraction(density: number, temperatureInKelvin: number): number {
  const rates = chargeChainRates(
    ['hydrogenAtom', 'proton'],
    electrons(density),
    temperatureInKelvin,
  );
  return markovTransitionMatrix(chargeChainGenerator(rates), BALANCE_WAIT_IN_SECONDS)[0]?.[1] ?? 0;
}

describe('electron-impact ionization (Voronov 1997)', () => {
  it('reads every fit from cfit.f unchanged', () => {
    [
      [1, 1],
      [2, 1],
      [26, 26],
      [26, 1],
    ].forEach(([protons = 0, electrons = 0]) => {
      const [threshold, squareRoot, amplitude, offset, exponent] = voronovLine(protons, electrons);
      expect(collisionalIonizationFit(protons, electrons)).toEqual({
        thresholdInEv: threshold,
        squareRootCoefficient: squareRoot,
        amplitudeInCubicCentimetersPerSecond: amplitude,
        denominatorOffset: offset,
        exponent,
      });
    });
  });

  it('evaluates the fit formula for hydrogen and rises with temperature', () => {
    const [threshold = 0, squareRoot = 0, amplitude = 0, offset = 0, exponent = 0] = voronovLine(
      1,
      1,
    );
    const reduced =
      threshold / (BOLTZMANN_CONSTANT_IN_EV_PER_KELVIN.value * LAB_TEMPERATURE_IN_KELVIN);
    const expected =
      ((amplitude * (1 + squareRoot * Math.sqrt(reduced))) / (offset + reduced)) *
      reduced ** exponent *
      Math.exp(-reduced) *
      CUBIC_METERS_PER_CUBIC_CENTIMETER;
    const actual = electronImpactIonizationRateCoefficientInCubicMetersPerSecond(
      'hydrogenAtom',
      LAB_TEMPERATURE_IN_KELVIN,
    );
    expect(Math.abs(actual / expected - 1)).toBeLessThan(1e-12);
    const temperatures = [COLD_TEMPERATURE_IN_KELVIN, LAB_TEMPERATURE_IN_KELVIN, MILLION_KELVIN];
    const rates = temperatures.map((temperature) =>
      electronImpactIonizationRateCoefficientInCubicMetersPerSecond('hydrogenAtom', temperature),
    );
    expect(rates[0]).toBeLessThan(rates[1] ?? 0);
    expect(rates[1]).toBeLessThan(rates[2] ?? 0);
    expect(
      electronImpactIonizationRateCoefficientInCubicMetersPerSecond('proton', MILLION_KELVIN),
    ).toBe(0);
  });
});

describe('three-body recombination by detailed balance', () => {
  it('takes ground-level statistical weights from NIST', () => {
    expect([
      groundStatisticalWeight(1, 0),
      groundStatisticalWeight(1, 1),
      groundStatisticalWeight(2, 0),
      groundStatisticalWeight(2, 1),
      groundStatisticalWeight(2, 2),
    ]).toEqual([2, 1, 1, 2, 1]);
  });

  it.each([
    ['hydrogenAtom', 1],
    ['heliumAtom', 1 / 4],
    ['heliumIon', 1],
  ] as const)('%s: k3 / k_ion is the Saha factor', (atom, weightRatio) => {
    const ionization = electronImpactIonizationRateCoefficientInCubicMetersPerSecond(
      atom,
      HALF_IONIZED_TEMPERATURE_IN_KELVIN,
    );
    const threeBody = threeBodyRecombinationRateCoefficientInMetersToTheSixthPerSecond(
      atom,
      'electron',
      HALF_IONIZED_TEMPERATURE_IN_KELVIN,
    );
    const saha = sahaRatio(atom, 1, HALF_IONIZED_TEMPERATURE_IN_KELVIN);
    expect(Math.abs((threeBody / ionization) * (saha / weightRatio) - 1)).toBeLessThan(1e-12);
  });

  it('reaches Saha in a dense gas and the coronal ratio in a dilute one', () => {
    const dense = chargeChainRates(
      ['hydrogenAtom', 'proton'],
      electrons(CRUSHING_DENSITY),
      HALF_IONIZED_TEMPERATURE_IN_KELVIN,
    );
    const denseRatio =
      (dense.ionizationPerSecond[0] ?? 0) /
      ((dense.radiativePerSecond[0] ?? 0) + (dense.threeBodyPerSecond[0] ?? 0));
    expect(
      Math.abs(
        denseRatio /
          sahaRatio('hydrogenAtom', CRUSHING_DENSITY, HALF_IONIZED_TEMPERATURE_IN_KELVIN) -
          1,
      ),
    ).toBeLessThan(RADIATIVE_SHARE_AT_CRUSHING_DENSITY);
    const dilute = chargeChainRates(
      ['hydrogenAtom', 'proton'],
      electrons(DILUTE_DENSITY),
      HALF_IONIZED_TEMPERATURE_IN_KELVIN,
    );
    const diluteRatio =
      (dilute.ionizationPerSecond[0] ?? 0) /
      ((dilute.radiativePerSecond[0] ?? 0) + (dilute.threeBodyPerSecond[0] ?? 0));
    const coronal =
      electronImpactIonizationRateCoefficientInCubicMetersPerSecond(
        'hydrogenAtom',
        HALF_IONIZED_TEMPERATURE_IN_KELVIN,
      ) /
      radiativeRecombinationRateCoefficientInCubicMetersPerSecond(
        'proton',
        'electron',
        HALF_IONIZED_TEMPERATURE_IN_KELVIN,
      );
    expect(Math.abs(diluteRatio / coronal - 1)).toBeLessThan(1e-6);
  });
});

describe('charge-state chains', () => {
  it('links every charge state a lepton of the medium can reach', () => {
    expect(chargeChain('proton', 'electron')).toEqual({
      states: ['hydrogenAtom', 'proton'],
      startIndex: 1,
    });
    expect(chargeChain('heliumAtom', 'electron')).toEqual({
      states: ['heliumAtom', 'heliumIon', 'alphaParticle'],
      startIndex: 0,
    });
    expect(chargeChain('antiHydrogenAtom', 'electron')).toEqual({
      states: ['antiHydrogenAtom'],
      startIndex: 0,
    });
    expect(chargeChain('antiProton', 'positron').states).toEqual([
      'antiHydrogenAtom',
      'antiProton',
    ]);
  });
});

describe('hydrogen in an electron gas, Monte Carlo', () => {
  it.each([
    [COLD_TEMPERATURE_IN_KELVIN],
    [HALF_IONIZED_TEMPERATURE_IN_KELVIN],
    [MILLION_KELVIN],
    [USER_TEMPERATURE_IN_KELVIN],
  ])('lands on the model equilibrium at %d K', (temperature) => {
    const expected = modelProtonFraction(LOSCHMIDT_DENSITY, temperature);
    const observed = protonFraction(
      runExperiment(balancePlan(temperature), { shots: SHOTS, seed: 1 }).reportValues,
    );
    expect(Math.abs(observed - expected)).toBeLessThanOrEqual(
      statisticalTolerance(expected, SHOTS),
    );
  });

  it('keeps cold hydrogen whole and strips hot hydrogen', () => {
    expect(modelProtonFraction(LOSCHMIDT_DENSITY, COLD_TEMPERATURE_IN_KELVIN)).toBeLessThan(1e-15);
    expect(modelProtonFraction(LOSCHMIDT_DENSITY, MILLION_KELVIN)).toBeGreaterThan(0.9999);
  });

  it('never turns a proton into hydrogen at 1.57e8 K', () => {
    const plan: ExperimentPlan = {
      name: 'hotProton',
      parameters: {},
      shots: SHOTS,
      steps: [
        { operation: 'create', label: 'proton', particle: 'proton' },
        {
          operation: 'influence',
          influence: 'setMedium',
          parameters: {
            species: 'electron',
            numberDensityPerCubicMeter: LOSCHMIDT_DENSITY,
            temperatureInKelvin: USER_TEMPERATURE_IN_KELVIN,
            crossSectionInSquareMeters: 0,
          },
        },
        { operation: 'evolve', durationInSeconds: 1 },
        { operation: 'measureSystem', record: 'system' },
      ],
      report: [{ statistic: 'frequency', records: ['system'] }],
    };
    expect(runExperiment(plan, { shots: SHOTS, seed: 1 }).reportValues).toEqual({
      'frequency(system)[proton]': 1,
    });
  });
});
