/* Checks a medium of several components: fusion rates per nuclear component and their competition by rate over total, fusion of a nucleus that the electron component keeps flipping into an atom,
   setMedium with a component list, the old single-species form, the reaction mode and the plan schema, and seeded Monte Carlo at 5 sigma for the channels of one deuteron, the whole chain to helium-4
   within one step, hydrogen ionizing in the same gas and the solarHeliumChain template. */
import { AVOGADRO_CONSTANT, reaclibReactions } from '@standard-model/constants';
import type {
  ExperimentPlan,
  MediumAspect,
  MediumComponent,
  ParticleName,
} from '@standard-model/contracts';
import { markovTransitionMatrix, statisticalTolerance } from '@standard-model/utils';
import { describe, expect, it } from 'vitest';
import {
  EXPERIMENT_TEMPLATES,
  PlanCompilationError,
  chargeChainGenerator,
  chargeChainRates,
  compilePlan,
  continuumLoweringInEv,
  createEngine,
  createEnvironment,
  mediumFusionChannels,
  mediumOutcomeProbabilities,
  mediumTransition,
  reaclibRatePerSecond,
  runExperiment,
} from '../src/index.js';

const SEED = 20261016;
const HYDROGEN_IONIZATION_ENERGY_IN_EV = 13.6;
const LOSCHMIDT_DENSITY_PER_CUBIC_METER = 2.6867811e25;
const PARTIAL_IONIZATION_TEMPERATURE_IN_KELVIN = 2.6e4;
const SHOTS = 10_000;
const MONTE_CARLO_TIMEOUT_IN_MILLISECONDS = 120_000;
const SOLAR_CORE_TEMPERATURE_IN_KELVIN = 1.57e7;
const SOLAR_CORE_PROTON_DENSITY = 3e31;
const RICH_HELION_DENSITY = 1e30;
const TRACE_HELION_DENSITY = 1e22;
const SOLAR_CORE_HELION_DENSITY = 3e26;
const CHAIN_WINDOW_IN_SECONDS = 2e17;
const BALANCE_WINDOW_IN_SECONDS = 1e-9;
const STIFF_WINDOW_IN_SECONDS = 1e17;
const AT_REST = { x: 0, y: 0, z: 0 };

function component(species: MediumComponent['species'], density: number): MediumComponent {
  return { species, numberDensityPerCubicMeter: density, crossSectionInSquareMeters: 0 };
}

function solarMedium(components: readonly MediumComponent[]): MediumAspect {
  return {
    components,
    temperatureInKelvin: SOLAR_CORE_TEMPERATURE_IN_KELVIN,
    bulkVelocityInMetersPerSecond: AT_REST,
    reactionMode: 'oneReactionPerStep',
  };
}

function relative(actual: number, expected: number): number {
  return Math.abs(actual / expected - 1);
}

function hypoexponentialProbability(rates: readonly number[], durationInSeconds: number): number {
  return (
    1 -
    rates.reduce(
      (sum, rate, index) =>
        sum +
        Math.exp(-rate * durationInSeconds) *
          rates.reduce(
            (product, other, otherIndex) =>
              otherIndex === index ? product : (product * other) / (other - rate),
            1,
          ),
      0,
    )
  );
}

function fractionWith(values: Readonly<Record<string, number | null>>, name: string): number {
  return Object.entries(values)
    .filter(([key]) => key.startsWith('system[') && key.includes(name))
    .reduce((sum, [, value]) => sum + (value ?? 0), 0);
}

function solarGasPlan(
  components: readonly MediumComponent[],
  reactionMode: MediumAspect['reactionMode'],
  start: 'proton' | 'hydrogenAtom',
  durationInSeconds: number,
): ExperimentPlan {
  return {
    name: 'solarGas',
    parameters: {},
    shots: SHOTS,
    steps: [
      { operation: 'create', label: 'start', particle: start },
      {
        operation: 'influence',
        influence: 'setMedium',
        parameters: {
          components: components.map((entry) => ({
            species: entry.species,
            numberDensityPerCubicMeter: entry.numberDensityPerCubicMeter,
          })),
          temperatureInKelvin: SOLAR_CORE_TEMPERATURE_IN_KELVIN,
          reactionMode,
        },
      },
      { operation: 'evolve', durationInSeconds },
      { operation: 'measureSystem', record: 'system' },
    ],
    report: [{ statistic: 'frequency', records: ['system'], label: 'system' }],
  };
}

const CUBIC_METERS_PER_CUBIC_CENTIMETER = 1e-6;

function libraryReactivityInCubicMetersPerSecond(
  first: ParticleName,
  second: ParticleName,
  temperatureInKelvin: number,
): number {
  const key = [first, second].sort().join('+');
  return reaclibReactions()
    .filter(
      (reaction) => reaction.weak === 'none' && [...reaction.reactants].sort().join('+') === key,
    )
    .reduce(
      (sum, reaction) =>
        sum +
        (reaclibRatePerSecond(reaction, temperatureInKelvin) * CUBIC_METERS_PER_CUBIC_CENTIMETER) /
          AVOGADRO_CONSTANT.value,
      0,
    );
}

describe('fusion rates per component', () => {
  it('gives each nuclear component its own n⟨σv⟩ and splits the window by rate over total', () => {
    const engine = createEngine({ seed: SEED });
    const medium = solarMedium([
      component('proton', SOLAR_CORE_PROTON_DENSITY),
      component('helion', RICH_HELION_DENSITY),
    ]);
    const transition = mediumTransition(engine.particles.create('deuteron'), medium);
    const expectedRates = [
      ['proton', SOLAR_CORE_PROTON_DENSITY],
      ['helion', RICH_HELION_DENSITY],
    ].map(
      ([partner, density]) =>
        (density as number) *
        libraryReactivityInCubicMetersPerSecond(
          'deuteron',
          partner as 'proton' | 'helion',
          SOLAR_CORE_TEMPERATURE_IN_KELVIN,
        ),
    );
    expect(transition.chain.states).toEqual(['deuteron']);
    expect(transition.fusions.map((fusion) => fusion.partner)).toEqual(['proton', 'helion']);
    transition.fusions.forEach((fusion, index) => {
      expect(relative(fusion.ratePerSecond, expectedRates[index] ?? 0)).toBeLessThan(1e-12);
    });
    const total = expectedRates.reduce((sum, rate) => sum + rate, 0);
    [0.1, 1, 5].forEach((duration) => {
      const [stays = 0, ...fused] = mediumOutcomeProbabilities(transition, duration);
      expect(stays).toBeCloseTo(Math.exp(-total * duration), 12);
      fused.forEach((probability, index) => {
        const expected = ((expectedRates[index] ?? 0) / total) * (1 - Math.exp(-total * duration));
        expect(relative(probability, expected)).toBeLessThan(1e-12);
      });
    });
  });

  it('reacts only with nuclear components and leaves a lone proton in helium-3 just the weak hep channel', () => {
    const medium = solarMedium([
      component('helion', RICH_HELION_DENSITY),
      component('electron', SOLAR_CORE_PROTON_DENSITY),
    ]);
    const [hep, ...others] = mediumFusionChannels('proton', medium);
    expect(others).toEqual([]);
    expect(hep?.channel.products).toEqual(['alphaParticle', 'positron', 'electronNeutrino']);
    expect(hep?.ratePerSecond ?? 1).toBeLessThan(
      RICH_HELION_DENSITY *
        libraryReactivityInCubicMetersPerSecond(
          'helion',
          'helion',
          SOLAR_CORE_TEMPERATURE_IN_KELVIN,
        ),
    );
    expect(mediumFusionChannels('electron', medium)).toEqual([]);
    expect(mediumFusionChannels('helion', medium).map((fusion) => fusion.channel.products)).toEqual(
      [['proton', 'proton', 'alphaParticle']],
    );
  });

  it('pressure-ionizes hydrogen in the solar core, so the proton stays bare and fuses at the full rate', () => {
    const engine = createEngine({ seed: SEED });
    const components = [
      component('proton', SOLAR_CORE_PROTON_DENSITY),
      component('electron', SOLAR_CORE_PROTON_DENSITY),
    ];
    const transition = mediumTransition(engine.particles.create('proton'), solarMedium(components));
    expect(transition.chain.states).toEqual(['hydrogenAtom', 'proton']);
    expect(continuumLoweringInEv(1, components, SOLAR_CORE_TEMPERATURE_IN_KELVIN)).toBeGreaterThan(
      HYDROGEN_IONIZATION_ENERGY_IN_EV,
    );
    expect(transition.rates.radiativePerSecond).toEqual([0]);
    expect(transition.rates.threeBodyPerSecond).toEqual([0]);
    const fusionRate = transition.fusions.reduce((sum, fusion) => sum + fusion.ratePerSecond, 0);
    const fused = mediumOutcomeProbabilities(transition, STIFF_WINDOW_IN_SECONDS)
      .slice(transition.chain.states.length)
      .reduce((sum, probability) => sum + probability, 0);
    expect(relative(fused, 1 - Math.exp(-fusionRate * STIFF_WINDOW_IN_SECONDS))).toBeLessThan(1e-9);
  });

  it('leaves bound levels alone in a dilute plasma, where the lowering is a fraction of an electronvolt', () => {
    const components = [
      component('proton', LOSCHMIDT_DENSITY_PER_CUBIC_METER),
      component('electron', LOSCHMIDT_DENSITY_PER_CUBIC_METER),
    ];
    expect(
      continuumLoweringInEv(1, components, PARTIAL_IONIZATION_TEMPERATURE_IN_KELVIN),
    ).toBeLessThan(1);
    const rates = chargeChainRates(
      ['hydrogenAtom', 'proton'],
      components[1] ?? component('electron', 0),
      PARTIAL_IONIZATION_TEMPERATURE_IN_KELVIN,
      components,
    );
    expect(rates.threeBodyPerSecond[0]).toBeGreaterThan(0);
    expect(rates.radiativePerSecond[0]).toBeGreaterThan(0);
  });
});

describe('setMedium', () => {
  const engine = createEngine({ seed: SEED });
  const apply = (parameters: Parameters<typeof engine.influences.create>[1]) =>
    engine.influences
      .create('setMedium', parameters)
      .apply([], engine.contextFor(createEnvironment(), []))
      .environment.get('medium');

  it('reads the old single-species form as one component', () => {
    expect(
      apply({
        species: 'triton',
        numberDensityPerCubicMeter: 1e20,
        temperatureInKelvin: 1e8,
        crossSectionInSquareMeters: 2e-19,
      }),
    ).toEqual(
      apply({
        components: [
          {
            species: 'triton',
            numberDensityPerCubicMeter: 1e20,
            crossSectionInSquareMeters: 2e-19,
          },
        ],
        temperatureInKelvin: 1e8,
      }),
    );
    expect(
      apply({ species: 'proton', numberDensityPerCubicMeter: 1, temperatureInKelvin: 1 })
        ?.reactionMode,
    ).toBe('oneReactionPerStep');
  });

  it('keeps every component with its own density and the chosen reaction mode', () => {
    expect(
      apply({
        components: [
          { species: 'proton', numberDensityPerCubicMeter: 3e31 },
          { species: 'helion', numberDensityPerCubicMeter: 3e26 },
          { species: 'electron', numberDensityPerCubicMeter: 3.00006e31 },
        ],
        temperatureInKelvin: SOLAR_CORE_TEMPERATURE_IN_KELVIN,
        reactionMode: 'allReactionsInStep',
      }),
    ).toMatchObject({
      components: [
        component('proton', 3e31),
        component('helion', 3e26),
        component('electron', 3.00006e31),
      ],
      temperatureInKelvin: SOLAR_CORE_TEMPERATURE_IN_KELVIN,
      bulkVelocityInMetersPerSecond: AT_REST,
      reactionMode: 'allReactionsInStep',
    });
  });

  it('rejects repeated species, two lepton components, an empty list and an unknown mode', () => {
    const proton = { species: 'proton', numberDensityPerCubicMeter: 1 };
    const electron = { species: 'electron', numberDensityPerCubicMeter: 1 };
    const positron = { species: 'positron', numberDensityPerCubicMeter: 1 };
    expect(() => apply({ components: [proton, proton], temperatureInKelvin: 1 })).toThrow(/repeat/);
    expect(() => apply({ components: [electron, positron], temperatureInKelvin: 1 })).toThrow(
      /at most one/,
    );
    expect(() => apply({ components: [], temperatureInKelvin: 1 })).toThrow(/at least one/);
    expect(() =>
      apply({ components: [proton], temperatureInKelvin: 1, reactionMode: 'sometimes' }),
    ).toThrow(/reactionMode/);
  });

  it('passes the component list through the plan schema and rejects nested values', () => {
    const plan = solarGasPlan(
      [component('proton', SOLAR_CORE_PROTON_DENSITY)],
      'oneReactionPerStep',
      'proton',
      1,
    );
    expect(compilePlan(plan).steps[1]).toEqual(plan.steps[1]);
    const nested = {
      ...plan,
      steps: plan.steps.map((step) =>
        step.operation === 'influence'
          ? { ...step, parameters: { components: [{ species: { name: 'proton' } }] } }
          : step,
      ),
    };
    expect(() => compilePlan(nested)).toThrow(PlanCompilationError);
  });
});

describe('several components, Monte Carlo', () => {
  it(
    'samples the channels of a deuteron in protons, helium-3 and electrons by their probabilities',
    () => {
      const engine = createEngine({ seed: SEED });
      const medium = solarMedium([
        component('proton', SOLAR_CORE_PROTON_DENSITY),
        component('helion', RICH_HELION_DENSITY),
        component('electron', SOLAR_CORE_PROTON_DENSITY),
      ]);
      const transition = mediumTransition(engine.particles.create('deuteron'), medium);
      expect(transition.chain.states).toEqual(['deuteriumAtom', 'deuteron']);
      const expected = mediumOutcomeProbabilities(transition, 1);
      const counts = expected.map(() => 0);
      for (let shot = 0; shot < SHOTS; shot += 1) {
        const outcome = engine.mediumReactions.react(
          engine.particles.create('deuteron'),
          medium,
          1,
        );
        const names = outcome?.products.map((product) => product.spec.name) ?? [];
        const index =
          outcome === null
            ? 1
            : outcome.kind === 'recombination'
              ? 0
              : names.includes('helion')
                ? 2
                : 3;
        counts[index] = (counts[index] ?? 0) + 1;
      }
      expect(expected[2]).toBeGreaterThan(0.1);
      expect(expected[3]).toBeGreaterThan(0.1);
      expected.forEach((probability, index) => {
        expect(Math.abs((counts[index] ?? 0) / SHOTS - probability)).toBeLessThanOrEqual(
          statisticalTolerance(probability, SHOTS),
        );
      });
    },
    MONTE_CARLO_TIMEOUT_IN_MILLISECONDS,
  );

  it(
    'carries a proton to helium-3 within one step when all reactions run in the step, then it dissolves',
    () => {
      const gas = [
        component('proton', SOLAR_CORE_PROTON_DENSITY),
        component('helion', TRACE_HELION_DENSITY),
      ];
      const medium = solarMedium(gas);
      const [protonFusion] = mediumFusionChannels('proton', medium);
      const deuteronRates = mediumFusionChannels('deuteron', medium).map(
        (fusion) => fusion.ratePerSecond,
      );
      const deuteronTotal = deuteronRates.reduce((sum, rate) => sum + rate, 0);
      const first = protonFusion?.ratePerSecond ?? 0;
      const expected = hypoexponentialProbability([first, deuteronTotal], CHAIN_WINDOW_IN_SECONDS);
      const chain = runExperiment(
        solarGasPlan(gas, 'allReactionsInStep', 'proton', CHAIN_WINDOW_IN_SECONDS),
        { seed: SEED, includeSystemReport: false },
      ).reportValues;
      expect(
        Math.abs(fractionWith(chain, 'helion') + fractionWith(chain, 'alphaParticle') - expected),
      ).toBeLessThanOrEqual(statisticalTolerance(expected, SHOTS));
      const single = runExperiment(
        solarGasPlan(gas, 'oneReactionPerStep', 'proton', CHAIN_WINDOW_IN_SECONDS),
        { seed: SEED, includeSystemReport: false },
      ).reportValues;
      const fused = 1 - Math.exp(-first * CHAIN_WINDOW_IN_SECONDS);
      expect(fractionWith(single, 'alphaParticle')).toBe(0);
      expect(
        Math.abs((single['system[deuteron+electronNeutrino+positron]'] ?? 0) - fused),
      ).toBeLessThanOrEqual(statisticalTolerance(fused, SHOTS));
    },
    MONTE_CARLO_TIMEOUT_IN_MILLISECONDS,
  );

  it(
    'ionizes hydrogen in the same gas at the rate of the electron component',
    () => {
      const electrons = component(
        'electron',
        SOLAR_CORE_PROTON_DENSITY + 2 * SOLAR_CORE_HELION_DENSITY,
      );
      const gas = [
        component('proton', SOLAR_CORE_PROTON_DENSITY),
        component('helion', SOLAR_CORE_HELION_DENSITY),
        electrons,
      ];
      const expected =
        markovTransitionMatrix(
          chargeChainGenerator(
            chargeChainRates(
              ['hydrogenAtom', 'proton'],
              electrons,
              SOLAR_CORE_TEMPERATURE_IN_KELVIN,
            ),
          ),
          BALANCE_WINDOW_IN_SECONDS,
        )[0]?.[1] ?? 0;
      const observed = runExperiment(
        solarGasPlan(gas, 'oneReactionPerStep', 'hydrogenAtom', BALANCE_WINDOW_IN_SECONDS),
        { seed: SEED, includeSystemReport: false },
      ).reportValues['system[electron+proton]'];
      expect(expected).toBeGreaterThan(0.5);
      expect(Math.abs((observed ?? 0) - expected)).toBeLessThanOrEqual(
        statisticalTolerance(expected, SHOTS),
      );
    },
    MONTE_CARLO_TIMEOUT_IN_MILLISECONDS,
  );

  it(
    'turns about seven in ten protons into helium-3 in the solarHeliumChain template, which then dissolves into the gas',
    () => {
      const plan = EXPERIMENT_TEMPLATES.solarHeliumChain;
      if (plan === undefined) {
        throw new Error('solarHeliumChain template expected');
      }
      const compiled = compilePlan(plan);
      const setMedium = compiled.steps.find((step) => step.operation === 'influence');
      const engine = createEngine({ seed: SEED });
      const medium = engine.influences
        .create('setMedium', setMedium?.operation === 'influence' ? setMedium.parameters : {})
        .apply([], engine.contextFor(createEnvironment(), []))
        .environment.get('medium');
      if (medium === undefined) {
        throw new Error('medium expected');
      }
      const transition = mediumTransition(engine.particles.create('proton'), medium);
      const ionization = transition.rates.ionizationPerSecond[0] ?? 0;
      const recombination =
        (transition.rates.radiativePerSecond[0] ?? 0) +
        (transition.rates.threeBodyPerSecond[0] ?? 0);
      const duration = compiled.parameters.durationInSeconds ?? 0;
      const expected =
        1 -
        Math.exp(
          -(ionization / (ionization + recombination)) *
            (transition.fusions[0]?.ratePerSecond ?? 0) *
            duration,
        );
      const values = runExperiment(
        { ...plan, report: [{ statistic: 'frequency', records: ['system'], label: 'system' }] },
        { seed: SEED, includeSystemReport: false },
      ).reportValues;
      const observed = Object.entries(values)
        .filter(([key]) => key.includes('helion'))
        .reduce((sum, [, value]) => sum + (value ?? 0), 0);
      expect(expected).toBeGreaterThan(0.6);
      expect(Math.abs(observed - expected)).toBeLessThanOrEqual(
        statisticalTolerance(expected, SHOTS),
      );
    },
    MONTE_CARLO_TIMEOUT_IN_MILLISECONDS,
  );
});
