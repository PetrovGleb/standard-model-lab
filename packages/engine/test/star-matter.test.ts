/* Checks the pp-II and pp-III laws added for star matter: the three Solar Fusion II S-factors read from the data file exactly, continuum electron capture of a bare ion scaling with the electron density and reproducing the Solar Fusion II solar rate within its atomic-structure factor, nuclear decay as a channel of the medium chain, and the branch shares of helium-3 in a star gas at 5 sigma against the rates. */
import { ATOMIC_MASS_CONSTANT, nucleusName, NUCLEAR_DATA } from '@standard-model/constants';
import type { MediumAspect, MediumComponent } from '@standard-model/contracts';
import { statisticalTolerance } from '@standard-model/utils';
import { describe, expect, it } from 'vitest';
import { createEnvironment } from '../src/environment/environment.js';
import {
  EXPERIMENT_TEMPLATES,
  compilePlan,
  continuumElectronCaptureRatePerSecond,
  createEngine,
  decayChannelsInMedium,
  gamowConstantInSqrtKev,
  isNuclearSpecies,
  mediumFusionChannels,
  mediumOutcomeProbabilities,
  mediumTransition,
  reactionChannels,
  runExperiment,
} from '../src/index.js';

const SEED = 20261017;
const SHOTS = 10_000;
const MONTE_CARLO_TIMEOUT_IN_MILLISECONDS = 300_000;
const EXACT_DIGITS = 12;
const KEV_PER_MEV = 1e3;
const BERYLLIUM_SEVEN = nucleusName(4, 7);
const LITHIUM_SEVEN = nucleusName(3, 7);
const BORON_EIGHT = nucleusName(5, 8);
const SOLAR_CORE_TEMPERATURE_IN_KELVIN = 1.57e7;
const SOLAR_FUSION_II_EQUATION_40_PREFACTOR_PER_SECOND = 5.6e-9;
const SOLAR_FUSION_II_EQUATION_40_SLOPE_PER_MILLION_KELVIN = 0.004;
const SOLAR_FUSION_II_EQUATION_40_REFERENCE_IN_MILLION_KELVIN = 16;
const SOLAR_FUSION_II_TOTAL_TO_CONTINUUM_CAPTURE_RATIO = 1.217;
const SOLAR_CORE_MASS_DENSITY_IN_GRAMS_PER_CUBIC_CENTIMETER = 150;
const SOLAR_CORE_MEAN_MOLECULAR_WEIGHT_PER_ELECTRON = 1.17;
const GRAMS_PER_KILOGRAM = 1e3;
const ATOMIC_MASS_UNIT_IN_GRAMS = ATOMIC_MASS_CONSTANT.value * GRAMS_PER_KILOGRAM;
const CUBIC_CENTIMETERS_PER_CUBIC_METER = 1e6;
const ELECTRON_CAPTURE_AGREEMENT = 0.15;

function component(species: MediumComponent['species'], density: number): MediumComponent {
  return { species, numberDensityPerCubicMeter: density, crossSectionInSquareMeters: 0 };
}

function starMedium(components: readonly MediumComponent[]): MediumAspect {
  return {
    components,
    temperatureInKelvin: SOLAR_CORE_TEMPERATURE_IN_KELVIN,
    bulkVelocityInMetersPerSecond: { x: 0, y: 0, z: 0 },
    reactionMode: 'allReactionsInStep',
  };
}

function sFactorEntry(first: string, second: string) {
  const key = [first, second].sort().join('+');
  const entry = NUCLEAR_DATA.chargedReactions.find(
    (candidate) => [...candidate.reactants].sort().join('+') === key,
  );
  if (entry === undefined) {
    throw new Error(`no data entry for ${key}`);
  }
  return entry as (typeof NUCLEAR_DATA.chargedReactions)[number] & {
    readonly atZeroInMevBarn: number;
    readonly firstDerivativeInBarn: number;
    readonly secondDerivativeInBarnPerMev: number;
  };
}

describe('pp-II and pp-III reactions from Solar Fusion II', () => {
  it.each([
    ['helion', 'alphaParticle', [BERYLLIUM_SEVEN, 'photon']],
    ['proton', BERYLLIUM_SEVEN, [BORON_EIGHT, 'photon']],
    ['proton', LITHIUM_SEVEN, ['alphaParticle', 'alphaParticle']],
  ] as const)(
    'evaluates the %s + %s S-factor exactly from the data file',
    (first, second, products) => {
      const [channel] = reactionChannels(first, second);
      expect(channel?.products).toEqual(products);
      const entry = sFactorEntry(first, second);
      const energyInKev = 20;
      const energyInMev = energyInKev / KEV_PER_MEV;
      const sFactorInKevBarn =
        (entry.atZeroInMevBarn +
          entry.firstDerivativeInBarn * energyInMev +
          (entry.secondDerivativeInBarnPerMev * energyInMev * energyInMev) / 2) *
        KEV_PER_MEV;
      const gamow = gamowConstantInSqrtKev(first, second);
      const crossSection = channel?.crossSectionInBarn(energyInKev) ?? 0;
      expect(crossSection * energyInKev * Math.exp(gamow / Math.sqrt(energyInKev))).toBeCloseTo(
        sFactorInKevBarn,
        EXACT_DIGITS,
      );
    },
  );

  it('treats any NUBASE nucleus as nuclear matter for fusion and ignores leptons', () => {
    expect(isNuclearSpecies(BERYLLIUM_SEVEN)).toBe(true);
    expect(isNuclearSpecies('proton')).toBe(true);
    expect(isNuclearSpecies('electron')).toBe(false);
    expect(isNuclearSpecies('hydrogenAtom')).toBe(false);
  });
});

describe('continuum electron capture in an electron medium', () => {
  const solarElectronDensity =
    ((SOLAR_CORE_MASS_DENSITY_IN_GRAMS_PER_CUBIC_CENTIMETER /
      SOLAR_CORE_MEAN_MOLECULAR_WEIGHT_PER_ELECTRON) *
      CUBIC_CENTIMETERS_PER_CUBIC_METER) /
    ATOMIC_MASS_UNIT_IN_GRAMS;
  const electrons = component('electron', solarElectronDensity);

  it('scales with the electron density and vanishes for a stable nucleus', () => {
    const rate = continuumElectronCaptureRatePerSecond(
      BERYLLIUM_SEVEN,
      electrons,
      SOLAR_CORE_TEMPERATURE_IN_KELVIN,
    );
    const doubled = continuumElectronCaptureRatePerSecond(
      BERYLLIUM_SEVEN,
      component('electron', 2 * solarElectronDensity),
      SOLAR_CORE_TEMPERATURE_IN_KELVIN,
    );
    expect(doubled / rate).toBeCloseTo(2, EXACT_DIGITS);
    expect(
      continuumElectronCaptureRatePerSecond('helion', electrons, SOLAR_CORE_TEMPERATURE_IN_KELVIN),
    ).toBe(0);
  });

  it('reproduces the Solar Fusion II solar 7Be capture rate up to its atomic-structure factor', () => {
    const rate = continuumElectronCaptureRatePerSecond(
      BERYLLIUM_SEVEN,
      electrons,
      SOLAR_CORE_TEMPERATURE_IN_KELVIN,
    );
    const millionKelvin = SOLAR_CORE_TEMPERATURE_IN_KELVIN / 1e6;
    const equation40 =
      SOLAR_FUSION_II_EQUATION_40_PREFACTOR_PER_SECOND *
      (SOLAR_CORE_MASS_DENSITY_IN_GRAMS_PER_CUBIC_CENTIMETER /
        SOLAR_CORE_MEAN_MOLECULAR_WEIGHT_PER_ELECTRON) *
      millionKelvin ** -0.5 *
      (1 +
        SOLAR_FUSION_II_EQUATION_40_SLOPE_PER_MILLION_KELVIN *
          (millionKelvin - SOLAR_FUSION_II_EQUATION_40_REFERENCE_IN_MILLION_KELVIN));
    expect(Math.abs(rate / equation40 - 1)).toBeLessThan(ELECTRON_CAPTURE_AGREEMENT);
    expect(rate * SOLAR_FUSION_II_TOTAL_TO_CONTINUUM_CAPTURE_RATIO).toBeGreaterThan(rate);
  });

  it('lists decays of unstable nuclei as medium channels, with capture only when electrons are present', () => {
    const withElectrons = starMedium([component('proton', 1e31), electrons]);
    const withoutElectrons = starMedium([component('proton', 1e31)]);
    expect(
      decayChannelsInMedium(BERYLLIUM_SEVEN, withElectrons).map((channel) => channel.kind),
    ).toEqual(['electronCapture']);
    expect(decayChannelsInMedium(BERYLLIUM_SEVEN, withoutElectrons)).toEqual([]);
    const boron = decayChannelsInMedium(BORON_EIGHT, withoutElectrons);
    expect(boron.map((channel) => channel.kind)).toEqual(['spontaneous', 'photodisintegration']);
    expect(boron[1]?.ratePerSecond ?? 1).toBeLessThan((boron[0]?.ratePerSecond ?? 0) * 1e-12);
    expect(decayChannelsInMedium('alphaParticle', withElectrons)).toEqual([]);
  });
});

describe('branch shares of helium-3 in a star gas, Monte Carlo', () => {
  it(
    'splits helium-3 between pp-I and pp-II by the fusion rates and sends 7Be through electron capture',
    () => {
      const plan = EXPERIMENT_TEMPLATES.heliumThreeBranches;
      if (plan === undefined) {
        throw new Error('heliumThreeBranches template expected');
      }
      const compiled = compilePlan(plan);
      const engine = createEngine({ seed: SEED });
      const setMedium = compiled.steps.find((step) => step.operation === 'influence');
      const medium = engine.influences
        .create('setMedium', setMedium?.operation === 'influence' ? setMedium.parameters : {})
        .apply([], engine.contextFor(createEnvironment(), []))
        .environment.get('medium');
      if (medium === undefined) {
        throw new Error('medium expected');
      }
      const helion = mediumFusionChannels('helion', medium);
      const withHelion = helion.find((fusion) => fusion.partner === 'helion')?.ratePerSecond ?? 0;
      const withAlpha =
        helion.find((fusion) => fusion.partner === 'alphaParticle')?.ratePerSecond ?? 0;
      const protonCapture =
        mediumFusionChannels(BERYLLIUM_SEVEN, medium).find((fusion) => fusion.partner === 'proton')
          ?.ratePerSecond ?? 0;
      const electronCapture =
        decayChannelsInMedium(BERYLLIUM_SEVEN, medium).find(
          (channel) => channel.kind === 'electronCapture',
        )?.ratePerSecond ?? 0;
      const transition = mediumTransition(engine.particles.create('helion'), medium);
      const window = compiled.parameters.helionBurnInSeconds ?? 0;
      const burnt = mediumOutcomeProbabilities(transition, window)
        .slice(transition.chain.states.length)
        .reduce((sum, probability) => sum + probability, 0);
      const secondBranch = burnt * (withAlpha / (withHelion + withAlpha));
      const expectedTwoAlphas =
        secondBranch * (electronCapture / (electronCapture + protonCapture));
      const expectedBoron = secondBranch * (protonCapture / (electronCapture + protonCapture));
      expect(secondBranch).toBeGreaterThan(0.05);
      expect(secondBranch).toBeLessThan(0.3);
      const values = runExperiment(plan, {
        seed: SEED,
        shots: SHOTS,
        includeSystemReport: false,
      }).reportValues;
      const twoAlphasObserved = values['Ядер гелия-4 на один ³He'] ?? 0;
      const expectedAlphas = burnt - secondBranch + 2 * secondBranch;
      expect(Math.abs(twoAlphasObserved - expectedAlphas)).toBeLessThanOrEqual(
        2 * statisticalTolerance(Math.min(secondBranch, 1 - secondBranch), SHOTS),
      );
      const positrons = values['Позитронов на один ³He: ветка pp-III'] ?? 0;
      expect(Math.abs(positrons - expectedBoron)).toBeLessThanOrEqual(
        statisticalTolerance(expectedBoron, SHOTS),
      );
      expect(expectedTwoAlphas).toBeGreaterThan(expectedBoron);
    },
    MONTE_CARLO_TIMEOUT_IN_MILLISECONDS,
  );
});
