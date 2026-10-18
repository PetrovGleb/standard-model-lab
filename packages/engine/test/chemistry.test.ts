/* Checks bond orders and the many-atom chemistry templates: a bond pairs every free valence it can, so C + O gives C=O, CO + O gives O=C=O and nothing more, N + N gives N≡N and carbon stops at CH₄;
   twenty carbon atoms in atomic hydrogen, the primordial soup and burning carbon end as methane, ammonia, water and CO₂ in the shares their chains predict, at 5 sigma. */
import { BOLTZMANN_CONSTANT_IN_EV_PER_KELVIN, atomName } from '@standard-model/constants';
import type { MediumAspect, ParticleName } from '@standard-model/contracts';
import { absorbingMarkovTransition, statisticalTolerance } from '@standard-model/utils';
import { describe, expect, it } from 'vitest';
import {
  EXPERIMENT_TEMPLATES,
  aggregateState,
  atomTransferChannels,
  experiment,
  partitionFunctionPerCubicMeter,
  transferGeometries,
  transferRateConstantInCubicMetersPerSecond,
  associationChannels,
  chemicalChain,
  molecularStructure,
  runExperiment,
} from '../src/index.js';

const SEED = 20261018;
const SHOTS = 2000;
const MONTE_CARLO_TIMEOUT_IN_MILLISECONDS = 300_000;
const GAS_DENSITY_PER_CUBIC_METER = 1e24;
const CARBON = atomName(6, 12, 0);
const NITROGEN = atomName(7, 14, 0);
const OXYGEN = atomName(8, 16, 0);
const BURNING_TEMPERATURE_IN_KELVIN = 1500;
const BURNING_TIME_IN_SECONDS = 5e-9 + 3e-5;
const BURNING_ATOMS = 12;
const FARM_ATOMS = 20;
const SOUP_ATOMS = 6;
const HYDROGEN_TEMPERATURE_IN_KELVIN = 1000;
const SOUP_TIME_IN_SECONDS = 5e-9 + 1e-6;
const METHANE_ATOMS = 5;
const AMMONIA_ATOMS = 4;
const WATER_ATOMS = 3;

function gas(species: ParticleName, temperatureInKelvin: number): MediumAspect {
  return {
    components: [
      {
        species,
        numberDensityPerCubicMeter: GAS_DENSITY_PER_CUBIC_METER,
        crossSectionInSquareMeters: 0,
      },
    ],
    temperatureInKelvin,
    bulkVelocityInMetersPerSecond: { x: 0, y: 0, z: 0 },
    reactionMode: 'allReactionsInStep',
  };
}

function template(name: string) {
  const plan = EXPERIMENT_TEMPLATES[name];
  if (plan === undefined) {
    throw new Error(`${name} template expected`);
  }
  return plan;
}

describe('bond orders', () => {
  it('pairs every free valence: C=O, then O=C=O, and no CO₃', () => {
    const oxygen = gas(OXYGEN, BURNING_TEMPERATURE_IN_KELVIN);
    const [monoxide] = associationChannels(CARBON, oxygen);
    expect(molecularStructure(monoxide?.product ?? CARBON).bonds.map((bond) => bond.order)).toEqual(
      [2],
    );
    const [dioxide] = associationChannels(monoxide?.product ?? CARBON, oxygen);
    expect(molecularStructure(dioxide?.product ?? CARBON).bonds.map((bond) => bond.order)).toEqual([
      2, 2,
    ]);
    expect(associationChannels(dioxide?.product ?? CARBON, oxygen)).toEqual([]);
  });

  it('makes N≡N from two nitrogen atoms and stops carbon at CH₄', () => {
    const [dinitrogen] = associationChannels(
      NITROGEN,
      gas(NITROGEN, BURNING_TEMPERATURE_IN_KELVIN),
    );
    expect(
      molecularStructure(dinitrogen?.product ?? NITROGEN).bonds.map((bond) => bond.order),
    ).toEqual([3]);
    const chain = chemicalChain(CARBON, gas('hydrogenAtom', BURNING_TEMPERATURE_IN_KELVIN));
    expect(
      chain.states.map(
        (state) =>
          molecularStructure(state === CARBON ? 'molecule:6-12,1-1;0-1-1' : state).atoms.length,
      ),
    ).toEqual([2, 2, 3, 4, 5]);
  });
});

function finalShare(
  start: ParticleName,
  medium: MediumAspect,
  durationInSeconds: number,
  atoms: number,
): number {
  const chain = chemicalChain(start, medium);
  const index = chain.states.findIndex(
    (state) => state !== start && molecularStructure(state).atoms.length === atoms,
  );
  const { survivingProbabilities } = absorbingMarkovTransition(
    chain.generatorPerSecond,
    chain.absorptionRatesPerSecond,
    durationInSeconds,
  );
  return survivingProbabilities[0]?.[index] ?? 0;
}

function expectShare(observedMean: number | null | undefined, atoms: number, expected: number) {
  expect(expected).toBeGreaterThan(0.5);
  expect(Math.abs((observedMean ?? 0) / atoms - expected)).toBeLessThanOrEqual(
    statisticalTolerance(expected, SHOTS * atoms),
  );
}

describe('many-atom chemistry templates, Monte Carlo', () => {
  it(
    'turns twenty carbon atoms into methane and the soup into CH₄, NH₃ and H₂O as their chains predict',
    () => {
      const hydrogen = gas('hydrogenAtom', HYDROGEN_TEMPERATURE_IN_KELVIN);
      const farm = runExperiment(template('methaneFarm'), {
        seed: SEED,
        shots: SHOTS,
        includeSystemReport: false,
      }).reportValues;
      expectShare(
        farm['Молекул CH₄ через микросекунду'],
        FARM_ATOMS,
        finalShare(CARBON, hydrogen, SOUP_TIME_IN_SECONDS, METHANE_ATOMS),
      );
      const soup = runExperiment(template('primordialSoup'), {
        seed: SEED,
        shots: SHOTS,
        includeSystemReport: false,
      }).reportValues;
      expectShare(
        soup['Метан CH₄'],
        SOUP_ATOMS,
        finalShare(CARBON, hydrogen, SOUP_TIME_IN_SECONDS, METHANE_ATOMS),
      );
      expectShare(
        soup['Аммиак NH₃'],
        SOUP_ATOMS,
        finalShare(NITROGEN, hydrogen, SOUP_TIME_IN_SECONDS, AMMONIA_ATOMS),
      );
      expectShare(
        soup['Вода H₂O'],
        SOUP_ATOMS,
        finalShare(OXYGEN, hydrogen, SOUP_TIME_IN_SECONDS, WATER_ATOMS),
      );
    },
    MONTE_CARLO_TIMEOUT_IN_MILLISECONDS,
  );

  it(
    'burns carbon in atomic oxygen to the CO₂ share its chain predicts',
    () => {
      const values = runExperiment(template('carbonInAtomicOxygen'), {
        seed: SEED,
        shots: SHOTS,
        includeSystemReport: false,
      }).reportValues;
      expectShare(
        values['Молекул CO₂ через 30 мкс'],
        BURNING_ATOMS,
        finalShare(CARBON, gas(OXYGEN, BURNING_TEMPERATURE_IN_KELVIN), BURNING_TIME_IN_SECONDS, 3),
      );
    },
    MONTE_CARLO_TIMEOUT_IN_MILLISECONDS,
  );
});

describe('carbon allotropes', () => {
  it('gives graphite at room conditions, diamond above the Kennedy line, liquid above melting, vapour below the sublimation curve', () => {
    expect(aggregateState(CARBON, 293, 101325)).toEqual({
      phase: 'solid',
      estimated: false,
      allotrope: 'graphite',
    });
    const boundaryAt1700 = 1.94e9 + 2.5e6 * (1700 - 273.15);
    expect(aggregateState(CARBON, 1700, boundaryAt1700 * 1.01).allotrope).toBe('diamond');
    expect(aggregateState(CARBON, 1700, boundaryAt1700 * 0.99).allotrope).toBe('graphite');
    expect(aggregateState(CARBON, 5000, 6e9).phase).toBe('liquid');
    expect(aggregateState(CARBON, 4200, 20e9)).toEqual({
      phase: 'solid',
      estimated: false,
      allotrope: 'diamond',
    });
    expect(aggregateState(CARBON, 3000, 1).phase).toBe('gas');
  });

  it('reads graphite, diamond and liquid in the press template', () => {
    const values = runExperiment(template('diamondUnderPressure'), {
      seed: SEED,
      shots: 10,
      includeSystemReport: false,
    }).reportValues;
    expect(values['Форма углерода при 1 атм[graphite]']).toBe(1);
    expect(values['Форма углерода в прессе[diamond]']).toBe(1);
    expect(values['Углерод при 5000 К[liquid]']).toBe(1);
  });
});

const HYDROGEN_MOLECULE: ParticleName = 'molecule:1-1,1-1;0-1-1';
const OXYGEN_MOLECULE: ParticleName = 'molecule:8-16,8-16;0-1-2';
const HYDROXYL: ParticleName = 'molecule:8-16,1-1;0-1-1';
const METHANE: ParticleName = 'molecule:6-12,1-1,1-1,1-1,1-1;0-1-1,0-2-1,0-3-1,0-4-1';
const TRANSFER_TEMPERATURE_IN_KELVIN = 1500;
const DETAILED_BALANCE_PRECISION = 1e-6;
const METHANE_HYDROGENS = 4;
const SPARK_WINDOW_IN_SECONDS = 2e-7;
const MIXTURE_HYDROGEN_DENSITY = 4e24;
const MIXTURE_OXYGEN_DENSITY = 2e24;

function onlyGeometry(acceptor: ParticleName, donor: ParticleName, remainder: ParticleName) {
  const geometry = transferGeometries(acceptor, donor).find(
    (candidate) => candidate.donorRemainder === remainder,
  );
  if (geometry === undefined) {
    throw new Error(`no transfer ${acceptor} + ${donor} → … + ${remainder}`);
  }
  return geometry;
}

describe('atom transfer between molecules', () => {
  it('obeys detailed balance to the precision of the saddle search: forward over reverse equals K(T) times the path ratio', () => {
    const forward = onlyGeometry(OXYGEN, HYDROGEN_MOLECULE, 'hydrogenAtom');
    const reverse = onlyGeometry('hydrogenAtom', HYDROXYL, OXYGEN);
    expect(forward.acceptorProduct).toBe(HYDROXYL);
    expect(reverse.acceptorProduct).toBe(HYDROGEN_MOLECULE);
    const temperature = TRANSFER_TEMPERATURE_IN_KELVIN;
    const ahead = transferRateConstantInCubicMetersPerSecond(forward, temperature);
    const back = transferRateConstantInCubicMetersPerSecond(reverse, temperature);
    const constant =
      ((partitionFunctionPerCubicMeter(HYDROXYL, temperature) *
        partitionFunctionPerCubicMeter('hydrogenAtom', temperature)) /
        (partitionFunctionPerCubicMeter(OXYGEN, temperature) *
          partitionFunctionPerCubicMeter(HYDROGEN_MOLECULE, temperature))) *
      Math.exp(
        -ahead.barrier.reactionEnergyInEv /
          (BOLTZMANN_CONSTANT_IN_EV_PER_KELVIN.value * temperature),
      );
    const ratio =
      ahead.rateConstant / back.rateConstant / (forward.pathDegeneracy / reverse.pathDegeneracy);
    expect(Math.abs(ratio / constant - 1)).toBeLessThan(DETAILED_BALANCE_PRECISION);
    expect(
      Math.abs(
        back.barrier.barrierInEv - ahead.barrier.barrierInEv + ahead.barrier.reactionEnergyInEv,
      ),
    ).toBeLessThan(DETAILED_BALANCE_PRECISION);
  });

  it('keeps every barrier at or above the reaction energy and counts the four methane hydrogens', () => {
    (
      [
        [OXYGEN, HYDROGEN_MOLECULE],
        ['hydrogenAtom', OXYGEN_MOLECULE],
        [HYDROXYL, HYDROGEN_MOLECULE],
        [OXYGEN, METHANE],
      ] as const
    ).forEach(([acceptor = OXYGEN, donor = METHANE]) =>
      transferGeometries(acceptor, donor).forEach((geometry) => {
        const { barrier } = transferRateConstantInCubicMetersPerSecond(
          geometry,
          TRANSFER_TEMPERATURE_IN_KELVIN,
        );
        expect(barrier.barrierInEv).toBeGreaterThanOrEqual(Math.max(0, barrier.reactionEnergyInEv));
      }),
    );
    const symmetric = onlyGeometry('hydrogenAtom', HYDROGEN_MOLECULE, 'hydrogenAtom');
    const { barrier } = transferRateConstantInCubicMetersPerSecond(
      symmetric,
      TRANSFER_TEMPERATURE_IN_KELVIN,
    );
    expect(barrier.reactionEnergyInEv).toBe(0);
    expect(barrier.barrierInEv).toBeGreaterThan(0);
    expect(
      onlyGeometry(OXYGEN, METHANE, 'molecule:6-12,1-1,1-1,1-1;0-1-1,0-2-1,0-3-1').pathDegeneracy,
    ).toBe(METHANE_HYDROGENS);
  });

  it(
    'lets a spark atom survive the window with probability exp(−k n t), Monte Carlo',
    () => {
      const medium: MediumAspect = {
        components: [
          {
            species: HYDROGEN_MOLECULE,
            numberDensityPerCubicMeter: MIXTURE_HYDROGEN_DENSITY,
            crossSectionInSquareMeters: 0,
          },
          {
            species: OXYGEN_MOLECULE,
            numberDensityPerCubicMeter: MIXTURE_OXYGEN_DENSITY,
            crossSectionInSquareMeters: 0,
          },
        ],
        temperatureInKelvin: TRANSFER_TEMPERATURE_IN_KELVIN,
        bulkVelocityInMetersPerSecond: { x: 0, y: 0, z: 0 },
        reactionMode: 'allReactionsInStep',
      };
      const leaving = atomTransferChannels('hydrogenAtom', medium)
        .filter((channel) =>
          channel.products.some(
            (product) => product !== 'hydrogenAtom' && product !== HYDROGEN_MOLECULE,
          ),
        )
        .reduce((sum, channel) => sum + channel.ratePerSecond, 0);
      const survival = Math.exp(-leaving * SPARK_WINDOW_IN_SECONDS);
      expect(survival).toBeGreaterThan(0.05);
      expect(survival).toBeLessThan(0.95);
      const plan = experiment('spark')
        .influence('setTemperature', { temperatureInKelvin: TRANSFER_TEMPERATURE_IN_KELVIN })
        .influence('setMedium', {
          components: medium.components.map((component) => ({
            species: component.species,
            numberDensityPerCubicMeter: component.numberDensityPerCubicMeter,
          })),
          temperatureInKelvin: TRANSFER_TEMPERATURE_IN_KELVIN,
          reactionMode: 'allReactionsInStep',
        })
        .createAtom('spark', 1, { massNumber: 1 })
        .evolve(SPARK_WINDOW_IN_SECONDS)
        .measureSystem('after')
        .report('frequency', ['after'])
        .build();
      const values = runExperiment(plan, {
        seed: SEED,
        shots: SHOTS,
        includeSystemReport: false,
      }).reportValues;
      const observed = values['frequency(after)[hydrogenAtom]'] ?? 0;
      expect(Math.abs(observed - survival)).toBeLessThanOrEqual(
        statisticalTolerance(survival, SHOTS),
      );
    },
    MONTE_CARLO_TIMEOUT_IN_MILLISECONDS,
  );
});
