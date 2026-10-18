/* Checks the aggregate-state law and thermal radiation: water, carbon dioxide, nitrogen and helium against NIST critical data, the plasma rules, the Lennard-Jones estimate for an atom, molecules
   from CRC points (amino acids and sugars solid, glycine decomposed, isomers apart), the Joback–Reid acetone example and an untabulated amino acid, sea-level air pressure, Planck photoionization
   of hydrogen against recombination through Saha, and the three preset templates with their phase events. */
import {
  BOLTZMANN_CONSTANT_IN_EV_PER_KELVIN,
  ELECTRON_MASS_ENERGY_EQUIVALENT_IN_MEV,
  ENVIRONMENT_PRESETS,
  MOLECULE_CATALOG,
  PLANCK_CONSTANT_IN_EV_PER_HERTZ,
  SPEED_OF_LIGHT_IN_VACUUM,
  atomName,
  criticalData,
  moleculeName,
  phasePoints,
} from '@standard-model/constants';
import type { ParticleName } from '@standard-model/contracts';
import { textIn } from '@standard-model/contracts';
import { describe, expect, it } from 'vitest';
import {
  EXPERIMENT_TEMPLATES,
  aggregateState,
  bindingEnergyInEv,
  groupContributionEstimate,
  idealGasPressureInPascals,
  runExperiment,
  thermalPhotoionizationRatePerSecond,
} from '../src/index.js';

const SEED = 20261017;
const SHOTS = 200;
const MONTE_CARLO_TIMEOUT_IN_MILLISECONDS = 120_000;
const EV_PER_MEV = 1e6;
const STANDARD_ATMOSPHERE_IN_PASCALS = 101325;
const ICE_IN_KELVIN = 250;
const ROOM_IN_KELVIN = 300;
const STEAM_IN_KELVIN = 400;
const LOW_PRESSURE_IN_PASCALS = 100;
const SUPERCRITICAL_WATER_IN_KELVIN = 700;
const SUPERCRITICAL_WATER_IN_PASCALS = 3e7;
const VENUS_IN_KELVIN = 737;
const VENUS_IN_PASCALS = 9.2e6;
const MARS_IN_KELVIN = 210;
const MARS_IN_PASCALS = 610;
const LIQUID_NITROGEN_IN_KELVIN = 77;
const BOILED_NITROGEN_IN_KELVIN = 80;
const LIQUID_HELIUM_IN_KELVIN = 4;
const STELLAR_IN_KELVIN = 1e8;
const STELLAR_IN_PASCALS = 1e10;
const FROZEN_KRYPTON_IN_KELVIN = 50;
const KRYPTON = 36;
const KRYPTON_MASS_NUMBER = 84;
const IDEAL_GAS_AGREEMENT = 0.01;
const OSTERBROCK_GROUND_STATE_RECOMBINATION_AT_TEN_THOUSAND_KELVIN_IN_CUBIC_METERS_PER_SECOND = 1.58e-19;
const TEN_THOUSAND_KELVIN = 1e4;
const DETAILED_BALANCE_AGREEMENT = 0.15;
const NEUTRAL_RADIATION_IN_KELVIN = 3000;
const MOSTLY_IONIZED_SHARE = 0.5;
const ALMOST_ALL = 0.99;
const ACID_MEDIUM_IN_KELVIN = 274;
const DECOMPOSED_GLYCINE_IN_KELVIN = 600;
const MOLTEN_SALT_IN_KELVIN = 1100;
const BIOMOLECULE_CATEGORIES = new Set(['aminoAcids', 'sugars']);
const UNTABULATED_SPECIES = [
  'borane',
  'kryptonDifluoride',
  'nitrousAcid',
  'sulfurousAcid',
  'carbonicAcid',
  'hypochlorousAcid',
  'thiocyanicAcid',
  'sodiumHypochlorite',
];
const JOBACK_ACETONE_BOILING_IN_KELVIN = 322.11;
const JOBACK_ACETONE_MELTING_IN_KELVIN = 173.5;
const JOBACK_ACETONE_CRITICAL_TEMPERATURE_IN_KELVIN = 500.559;
const JOBACK_ACETONE_CRITICAL_PRESSURE_IN_BAR = 48.025;
const JOBACK_EXAMPLE_DECIMALS = 2;
const PASCALS_PER_BAR = 1e5;

const WATER = moleculeName({
  atoms: [
    { protons: 8, massNumber: 16 },
    { protons: 1, massNumber: 1 },
    { protons: 1, massNumber: 1 },
  ],
  bonds: [
    { first: 0, second: 1, order: 1 },
    { first: 0, second: 2, order: 1 },
  ],
});
const CARBON_DIOXIDE = moleculeName({
  atoms: [
    { protons: 6, massNumber: 12 },
    { protons: 8, massNumber: 16 },
    { protons: 8, massNumber: 16 },
  ],
  bonds: [
    { first: 0, second: 1, order: 2 },
    { first: 0, second: 2, order: 2 },
  ],
});
const NITROGEN = moleculeName({
  atoms: [
    { protons: 7, massNumber: 14 },
    { protons: 7, massNumber: 14 },
  ],
  bonds: [{ first: 0, second: 1, order: 3 }],
});

const BETA_ALANINE = moleculeName({
  atoms: [
    { protons: 7, massNumber: 14 },
    { protons: 6, massNumber: 12 },
    { protons: 6, massNumber: 12 },
    { protons: 6, massNumber: 12 },
    { protons: 8, massNumber: 16 },
    { protons: 8, massNumber: 16 },
    { protons: 1, massNumber: 1 },
    { protons: 1, massNumber: 1 },
    { protons: 1, massNumber: 1 },
    { protons: 1, massNumber: 1 },
    { protons: 1, massNumber: 1 },
    { protons: 1, massNumber: 1 },
    { protons: 1, massNumber: 1 },
  ],
  bonds: [
    { first: 0, second: 1, order: 1 },
    { first: 1, second: 2, order: 1 },
    { first: 2, second: 3, order: 1 },
    { first: 3, second: 4, order: 2 },
    { first: 3, second: 5, order: 1 },
    { first: 0, second: 6, order: 1 },
    { first: 0, second: 7, order: 1 },
    { first: 1, second: 8, order: 1 },
    { first: 1, second: 9, order: 1 },
    { first: 2, second: 10, order: 1 },
    { first: 2, second: 11, order: 1 },
    { first: 5, second: 12, order: 1 },
  ],
});

function catalogued(key: string) {
  const entry = MOLECULE_CATALOG.find((molecule) => molecule.key === key);
  if (entry === undefined) {
    throw new Error(`${key} expected in the molecule catalogue`);
  }
  return entry;
}

function sahaRatioPerCubicMeter(atom: ParticleName, temperatureInKelvin: number): number {
  const thermal = BOLTZMANN_CONSTANT_IN_EV_PER_KELVIN.value * temperatureInKelvin;
  const wavelength =
    (PLANCK_CONSTANT_IN_EV_PER_HERTZ.value * SPEED_OF_LIGHT_IN_VACUUM.value) /
    Math.sqrt(2 * Math.PI * ELECTRON_MASS_ENERGY_EQUIVALENT_IN_MEV.value * EV_PER_MEV * thermal);
  return Math.exp(-bindingEnergyInEv(atom) / thermal) / wavelength ** 3;
}

function template(name: string) {
  const plan = EXPERIMENT_TEMPLATES[name];
  if (plan === undefined) {
    throw new Error(`${name} template expected`);
  }
  return plan;
}

describe('aggregate state from critical data', () => {
  it.each([
    ['water', WATER, ICE_IN_KELVIN, STANDARD_ATMOSPHERE_IN_PASCALS, 'solid'],
    ['water', WATER, ROOM_IN_KELVIN, STANDARD_ATMOSPHERE_IN_PASCALS, 'liquid'],
    ['water', WATER, STEAM_IN_KELVIN, STANDARD_ATMOSPHERE_IN_PASCALS, 'gas'],
    ['water', WATER, ROOM_IN_KELVIN, LOW_PRESSURE_IN_PASCALS, 'gas'],
    [
      'water',
      WATER,
      SUPERCRITICAL_WATER_IN_KELVIN,
      SUPERCRITICAL_WATER_IN_PASCALS,
      'supercritical',
    ],
    ['carbon dioxide', CARBON_DIOXIDE, VENUS_IN_KELVIN, VENUS_IN_PASCALS, 'supercritical'],
    ['carbon dioxide', CARBON_DIOXIDE, MARS_IN_KELVIN, MARS_IN_PASCALS, 'gas'],
    ['nitrogen', NITROGEN, LIQUID_NITROGEN_IN_KELVIN, STANDARD_ATMOSPHERE_IN_PASCALS, 'liquid'],
    ['nitrogen', NITROGEN, BOILED_NITROGEN_IN_KELVIN, STANDARD_ATMOSPHERE_IN_PASCALS, 'gas'],
    ['helium', 'heliumAtom', LIQUID_HELIUM_IN_KELVIN, STANDARD_ATMOSPHERE_IN_PASCALS, 'liquid'],
    ['helium', 'heliumAtom', ROOM_IN_KELVIN, STANDARD_ATMOSPHERE_IN_PASCALS, 'gas'],
    ['helium', 'heliumAtom', STELLAR_IN_KELVIN, STELLAR_IN_PASCALS, 'plasma'],
  ] as const)('%s at %i K and %i Pa', (unused, species, temperature, pressure, phase) => {
    expect(aggregateState(species, temperature, pressure)).toEqual({ phase, estimated: false });
  });

  it('calls charged species and bare nuclei plasma and estimates untabulated substances', () => {
    expect(aggregateState('proton', ROOM_IN_KELVIN, STANDARD_ATMOSPHERE_IN_PASCALS)).toEqual({
      phase: 'plasma',
      estimated: false,
    });
    expect(aggregateState('electron', ROOM_IN_KELVIN, STANDARD_ATMOSPHERE_IN_PASCALS).phase).toBe(
      'plasma',
    );
    const krypton = atomName(KRYPTON, KRYPTON_MASS_NUMBER);
    expect(aggregateState(krypton, ROOM_IN_KELVIN, STANDARD_ATMOSPHERE_IN_PASCALS)).toEqual({
      phase: 'gas',
      estimated: true,
      estimateMethod: 'lennardJones',
    });
    expect(
      aggregateState(krypton, FROZEN_KRYPTON_IN_KELVIN, STANDARD_ATMOSPHERE_IN_PASCALS),
    ).toEqual({ phase: 'solid', estimated: true, estimateMethod: 'lennardJones' });
  });

  it('gives sea-level air the standard atmosphere as its ideal-gas pressure', () => {
    const air = ENVIRONMENT_PRESETS.find((preset) => preset.name === 'earthSeaLevel');
    if (air === undefined) {
      throw new Error('earthSeaLevel preset expected');
    }
    const pressure = idealGasPressureInPascals(air.components, air.temperatureInKelvin);
    expect(Math.abs(pressure / STANDARD_ATMOSPHERE_IN_PASCALS - 1)).toBeLessThan(
      IDEAL_GAS_AGREEMENT,
    );
  });
});

describe('aggregate state of molecules beyond the critical-point table', () => {
  it('reads every amino acid and sugar as a solid in a 274 K acid medium and at room temperature', () => {
    MOLECULE_CATALOG.filter((entry) => BIOMOLECULE_CATEGORIES.has(entry.category)).forEach(
      (entry) => {
        [ACID_MEDIUM_IN_KELVIN, ROOM_IN_KELVIN].forEach((temperature) => {
          expect(
            aggregateState(entry.name, temperature, STANDARD_ATMOSPHERE_IN_PASCALS),
            entry.key,
          ).toEqual({ phase: 'solid', estimated: false });
        });
      },
    );
  });

  it('decomposes glycine above its CRC decomposition point and melts salt above its melting point', () => {
    expect(
      aggregateState(
        catalogued('glycine').name,
        DECOMPOSED_GLYCINE_IN_KELVIN,
        STANDARD_ATMOSPHERE_IN_PASCALS,
      ),
    ).toEqual({ phase: 'decomposed', estimated: false });
    const salt = catalogued('sodiumChloride').name;
    expect(aggregateState(salt, ROOM_IN_KELVIN, STANDARD_ATMOSPHERE_IN_PASCALS).phase).toBe(
      'solid',
    );
    expect(aggregateState(salt, MOLTEN_SALT_IN_KELVIN, STANDARD_ATMOSPHERE_IN_PASCALS).phase).toBe(
      'liquid',
    );
  });

  it('tells liquid ethanol from its isomer dimethyl ether, a gas', () => {
    expect(
      aggregateState(catalogued('ethanol').name, ROOM_IN_KELVIN, STANDARD_ATMOSPHERE_IN_PASCALS),
    ).toEqual({ phase: 'liquid', estimated: false });
    expect(
      aggregateState(
        catalogued('dimethylEther').name,
        ROOM_IN_KELVIN,
        STANDARD_ATMOSPHERE_IN_PASCALS,
      ),
    ).toEqual({ phase: 'gas', estimated: false });
  });

  it('tabulates every catalogue molecule with a quoted point at one atmosphere', () => {
    const untabulated = MOLECULE_CATALOG.filter(
      (entry) => criticalData(entry.name) === null && phasePoints(entry.name) === null,
    ).map((entry) => entry.key);
    expect(untabulated).toEqual(UNTABULATED_SPECIES);
  });

  it('reproduces the worked acetone example of the Joback–Reid method', () => {
    const estimate = groupContributionEstimate(catalogued('acetone').structure);
    expect(estimate?.boilingTemperatureInKelvin).toBeCloseTo(
      JOBACK_ACETONE_BOILING_IN_KELVIN,
      JOBACK_EXAMPLE_DECIMALS,
    );
    expect(estimate?.meltingTemperatureInKelvin).toBeCloseTo(
      JOBACK_ACETONE_MELTING_IN_KELVIN,
      JOBACK_EXAMPLE_DECIMALS,
    );
    expect(estimate?.criticalTemperatureInKelvin).toBeCloseTo(
      JOBACK_ACETONE_CRITICAL_TEMPERATURE_IN_KELVIN,
      JOBACK_EXAMPLE_DECIMALS,
    );
    expect((estimate?.criticalPressureInPascals ?? 0) / PASCALS_PER_BAR).toBeCloseTo(
      JOBACK_ACETONE_CRITICAL_PRESSURE_IN_BAR,
      JOBACK_EXAMPLE_DECIMALS,
    );
    expect(groupContributionEstimate(catalogued('sodiumChloride').structure)).toBeNull();
  });

  it('estimates an untabulated amino acid, beta-alanine, as a solid by group contributions', () => {
    expect(
      aggregateState(BETA_ALANINE, ACID_MEDIUM_IN_KELVIN, STANDARD_ATMOSPHERE_IN_PASCALS),
    ).toEqual({ phase: 'solid', estimated: true, estimateMethod: 'groupContribution' });
  });
});

describe('thermal photoionization by Planck photons', () => {
  it('balances ground-state recombination through the Saha ratio at 10 000 K', () => {
    const rate = thermalPhotoionizationRatePerSecond('hydrogenAtom', TEN_THOUSAND_KELVIN);
    const expected =
      OSTERBROCK_GROUND_STATE_RECOMBINATION_AT_TEN_THOUSAND_KELVIN_IN_CUBIC_METERS_PER_SECOND *
      sahaRatioPerCubicMeter('hydrogenAtom', TEN_THOUSAND_KELVIN);
    expect(Math.abs(rate / expected - 1)).toBeLessThan(DETAILED_BALANCE_AGREEMENT);
    expect(thermalPhotoionizationRatePerSecond('hydrogenAtom', 0)).toBe(0);
    expect(
      thermalPhotoionizationRatePerSecond('hydrogenAtom', NEUTRAL_RADIATION_IN_KELVIN),
    ).toBeLessThan(rate);
  });
});

describe('preset templates', () => {
  it('melts and boils water in sea-level air and logs the phase changes', () => {
    const result = runExperiment(template('waterPhases'), {
      seed: SEED,
      shots: 1,
      includeSystemReport: true,
    });
    expect(result.outcomeCounts['cold.phase']).toEqual({ solid: 1 });
    expect(result.outcomeCounts['warm.phase']).toEqual({ liquid: 1 });
    expect(result.outcomeCounts['hot.phase']).toEqual({ gas: 1 });
    expect(result.outcomeCounts['cold.water.phase']).toEqual({ solid: 1 });
    const events = (result.systemReport?.frames ?? [])
      .flatMap((frame) => frame.events)
      .filter((event) => event.kind === 'phaseChanged')
      .map((event) => textIn(event.text, 'ru'));
    expect(events).toHaveLength(3);
    expect(events[0]).toContain('твердое тело');
    expect(events[1]).toContain('твердое тело → жидкость');
    expect(events[2]).toContain('жидкость → газ');
  });

  it('makes carbon dioxide supercritical on Venus and a gas on Mars and Earth', () => {
    const result = runExperiment(template('carbonDioxideOnPlanets'), {
      seed: SEED,
      shots: 1,
      includeSystemReport: false,
    });
    expect(result.outcomeCounts['onVenus.phase']).toEqual({ supercritical: 1 });
    expect(result.outcomeCounts['onMars.phase']).toEqual({ gas: 1 });
    expect(result.outcomeCounts['onEarth.phase']).toEqual({ gas: 1 });
  });

  it(
    'keeps hydrogen ionized in 4000 K radiation and neutral in 3000 K radiation',
    () => {
      const plan = template('recombinationEpoch');
      const hot = runExperiment(plan, { seed: SEED, shots: SHOTS, includeSystemReport: false });
      const hotCounts = hot.outcomeCounts.afterThousandsOfYears ?? {};
      expect((hotCounts['electron+proton'] ?? 0) / SHOTS).toBeGreaterThan(MOSTLY_IONIZED_SHARE);
      const cold = runExperiment(plan, {
        seed: SEED,
        shots: SHOTS,
        includeSystemReport: false,
        parameters: { temperatureInKelvin: NEUTRAL_RADIATION_IN_KELVIN },
      });
      const coldCounts = cold.outcomeCounts.afterThousandsOfYears ?? {};
      expect((coldCounts.hydrogenAtom ?? 0) / SHOTS).toBeGreaterThanOrEqual(ALMOST_ALL);
    },
    MONTE_CARLO_TIMEOUT_IN_MILLISECONDS,
  );
});
