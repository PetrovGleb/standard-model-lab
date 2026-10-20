/* Checks environments aimed at some particles: a gas set on one atom reacts with that atom only, an inner medium replaces the shared one for its members while other aspects add up,
   products inherit the regions of their parents, every frame lists each region with its living members, a temperature set or changed after the medium heats the gas itself for the
   whole system or the picked particles and reaches inside a region with its own medium, and a molecule made before the gas warms up in it without given cross sections. */
import { atomName, ENVIRONMENT_PRESETS } from '@standard-model/constants';
import type { InfluenceStep } from '@standard-model/contracts';
import { describe, expect, it } from 'vitest';
import { createEnvironment } from '../src/environment/environment.js';
import { ShotContext } from '../src/experiment/experiment-runner.js';
import { createEngine, experiment, runExperiment } from '../src/index.js';

const SEED = 20261017;
const SHOTS = 200;
const OXYGEN = 8;
const OXYGEN_MASS_NUMBER = 16;
const FLAME_TEMPERATURE_IN_KELVIN = 2000;
const HYDROGEN_DENSITY_PER_CUBIC_METER = 1e24;
const HELIUM_DENSITY_PER_CUBIC_METER = 1e25;
const MICROSECOND = 1e-6;

function gas(species: string, density: number): InfluenceStep['parameters'] {
  return {
    components: [{ species, numberDensityPerCubicMeter: density }],
    temperatureInKelvin: FLAME_TEMPERATURE_IN_KELVIN,
    reactionMode: 'allReactionsInStep',
  };
}

function twoOxygens() {
  return experiment('twoOxygens')
    .createAtom('inBubble', OXYGEN, { massNumber: OXYGEN_MASS_NUMBER })
    .createAtom('outside', OXYGEN, { massNumber: OXYGEN_MASS_NUMBER });
}

describe('environment regions in a shot', () => {
  it('adds aspects of different kinds and lets products inherit the region', () => {
    const engine = createEngine({ seed: SEED });
    const context = new ShotContext();
    const first = engine.particles.create(atomName(OXYGEN, OXYGEN_MASS_NUMBER, 0));
    const second = engine.particles.create(atomName(OXYGEN, OXYGEN_MASS_NUMBER, 0));
    context.add('first', first, []);
    context.add('second', second, []);
    context.environment = createEnvironment({ temperature: { temperatureInKelvin: 300 } });
    const before = context.environmentFor(second);
    context.scope(
      [second],
      before,
      before.with('magneticField', { fieldInTesla: { x: 0, y: 0, z: 1 } }),
    );
    expect(context.environmentFor(first).aspectKeys).toEqual(['temperature']);
    expect([...context.environmentFor(second).aspectKeys].sort()).toEqual([
      'magneticField',
      'temperature',
    ]);
    const product = engine.particles.create('hydrogenAtom');
    context.add('product', product, [second]);
    expect(context.environmentFor(product).get('magneticField')?.fieldInTesla.z).toBe(1);
  });

  it('lets only the atom inside a hydrogen bubble become water', () => {
    const plan = twoOxygens()
      .influence('setMedium', gas('hydrogenAtom', HYDROGEN_DENSITY_PER_CUBIC_METER), ['inBubble'])
      .evolve(MICROSECOND)
      .measureSystem('after')
      .report('frequency', ['after'], 'after')
      .build();
    const values = runExperiment(plan, { seed: SEED, shots: SHOTS }).reportValues;
    expect(values['after[16O+H2O]']).toBe(1);
  });

  it('replaces the shared medium inside an inner region and reports the region with its members', () => {
    const plan = twoOxygens()
      .influence('setMedium', gas('hydrogenAtom', HYDROGEN_DENSITY_PER_CUBIC_METER))
      .influence('setMedium', gas('heliumAtom', HELIUM_DENSITY_PER_CUBIC_METER), ['outside'])
      .evolve(MICROSECOND)
      .measureSystem('after')
      .report('frequency', ['after'], 'after')
      .build();
    const result = runExperiment(plan, { seed: SEED, shots: SHOTS, includeSystemReport: true });
    expect(result.reportValues['after[16O+H2O]']).toBe(1);
    const last = result.systemReport?.frames.at(-1);
    expect(last?.regions ?? []).toHaveLength(1);
    expect(last?.regions?.[0]?.aspect).toBe('medium');
    expect(last?.regions?.[0]?.members).toEqual(['outside']);
    expect(Object.keys(last?.environment ?? {})).toEqual(['medium']);
  });
});

const COLD_MIXTURE_IN_KELVIN = 600;
const HOT_MIXTURE_IN_KELVIN = 1200;
const SPARK_ATOMS = 3;
const IGNITION_TIME_IN_SECONDS = 1.2e-6;
const IGNITION_SHOTS = 100;

function mixture(temperatureInKelvin: number): InfluenceStep['parameters'] {
  return {
    components: [
      { species: 'molecule:1-1,1-1;0-1-1', numberDensityPerCubicMeter: 4e24 },
      { species: 'molecule:8-16,8-16;0-1-2', numberDensityPerCubicMeter: 2e24 },
    ],
    temperatureInKelvin,
    reactionMode: 'allReactionsInStep',
  };
}

function sparks(name: string) {
  return experiment(name)
    .createAtom('spark', 1, { massNumber: 1, count: SPARK_ATOMS })
    .createAtom('idle', 1, { massNumber: 1, count: SPARK_ATOMS });
}

function outcome(builder: ReturnType<typeof experiment>) {
  return runExperiment(
    builder
      .evolve(IGNITION_TIME_IN_SECONDS)
      .measureSystem('after')
      .report('mean', ['after.particleCount'], 'particles')
      .report('mean', ['after.count.H2O'], 'water')
      .build(),
    { seed: SEED, shots: IGNITION_SHOTS },
  ).reportValues;
}

describe('temperature after the medium', () => {
  it('heats the gas the same way whether the temperature comes before or after the medium', () => {
    const before = outcome(
      experiment('temperatureFirst')
        .influence('setTemperature', { temperatureInKelvin: HOT_MIXTURE_IN_KELVIN })
        .influence('setMedium', mixture(HOT_MIXTURE_IN_KELVIN))
        .createAtom('spark', 1, { massNumber: 1, count: SPARK_ATOMS }),
    );
    const after = outcome(
      experiment('temperatureLast')
        .createAtom('spark', 1, { massNumber: 1, count: SPARK_ATOMS })
        .influence('setMedium', mixture(COLD_MIXTURE_IN_KELVIN))
        .influence('setTemperature', { temperatureInKelvin: HOT_MIXTURE_IN_KELVIN }),
    );
    expect(after).toEqual(before);
  });

  it('heats only the picked sparks: they burn as in a hot gas, the rest stays in the cold one', () => {
    const heatedSparks = outcome(
      sparks('heatedSparks')
        .influence('setMedium', mixture(COLD_MIXTURE_IN_KELVIN))
        .influence('heat', { byKelvin: HOT_MIXTURE_IN_KELVIN - COLD_MIXTURE_IN_KELVIN }, ['spark']),
    );
    const hotBubble = outcome(
      sparks('hotBubble')
        .influence('setMedium', mixture(COLD_MIXTURE_IN_KELVIN))
        .influence('setMedium', mixture(HOT_MIXTURE_IN_KELVIN), ['spark']),
    );
    const allCold = outcome(
      sparks('allCold').influence('setMedium', mixture(COLD_MIXTURE_IN_KELVIN)),
    );
    expect(heatedSparks).toEqual(hotBubble);
    expect(heatedSparks['particles']).toBeGreaterThan(allCold['particles'] ?? 0);
  });
});

const AIR = ENVIRONMENT_PRESETS.find((preset) => preset.name === 'earthSeaLevel');
const HOT_AIR_IN_KELVIN = 2810;
const ETHANOL_SHOTS = 40;
const ETHANOL_TIMEOUT_IN_MILLISECONDS = 60_000;
const ETHANOL_ATOMS = [
  { protons: 6, massNumber: 12 },
  { protons: 6, massNumber: 12 },
  { protons: 8, massNumber: 16 },
  ...Array.from({ length: 6 }, () => ({ protons: 1, massNumber: 1 })),
];
const ETHANOL_BONDS = (
  [
    [0, 1],
    [1, 2],
    [0, 3],
    [0, 4],
    [0, 5],
    [1, 6],
    [1, 7],
    [2, 8],
  ] as const
).map(([first, second]) => ({ first, second, order: 1 as const }));

function air(): InfluenceStep['parameters'] {
  return {
    components: (AIR?.components ?? []).map((component) => ({
      species: component.species,
      numberDensityPerCubicMeter: component.numberDensityPerCubicMeter,
    })),
    temperatureInKelvin: AIR?.temperatureInKelvin ?? 0,
  };
}

function ethanolAfter(builder: ReturnType<typeof experiment>) {
  return runExperiment(
    builder
      .evolve(MICROSECOND)
      .measureSystem('after')
      .report('mean', ['after.count.C2H6O'], 'ethanol')
      .report('mean', ['after.fuel.internalTemperatureInKelvin'], 'internal')
      .build(),
    { seed: SEED, shots: ETHANOL_SHOTS },
  ).reportValues;
}

describe('molecules made before their environment', () => {
  it(
    'warm up in a gas without given cross sections and break when the system is heated, inside their own medium too',
    () => {
      const fuel = () =>
        experiment('fuelFirst').createMolecule('fuel', ETHANOL_ATOMS, ETHANOL_BONDS);
      const cold = ethanolAfter(fuel().influence('setMedium', air()));
      expect(cold['ethanol']).toBe(1);
      expect(cold['internal']).toBeCloseTo(AIR?.temperatureInKelvin ?? 0, 6);
      const heated = ethanolAfter(
        fuel()
          .influence('setMedium', air())
          .influence('setTemperature', { temperatureInKelvin: HOT_AIR_IN_KELVIN }),
      );
      const heatedInOwnMedium = ethanolAfter(
        fuel()
          .influence('setMedium', air(), ['fuel'])
          .influence('setTemperature', { temperatureInKelvin: HOT_AIR_IN_KELVIN }),
      );
      expect(heated['ethanol']).toBe(0);
      expect(heatedInOwnMedium['ethanol']).toBe(0);
    },
    ETHANOL_TIMEOUT_IN_MILLISECONDS,
  );

  it('lets a system-wide heat reach a region from the temperature its members see', () => {
    const engine = createEngine({ seed: SEED });
    const context = new ShotContext();
    const inside = engine.particles.create(atomName(OXYGEN, OXYGEN_MASS_NUMBER, 0));
    context.add('inside', inside, []);
    context.environment = createEnvironment({ temperature: { temperatureInKelvin: 300 } });
    const before = context.environmentFor(inside);
    context.scope([inside], before, before.with('temperature', { temperatureInKelvin: 1000 }));
    context.reshapeRegions(context.environment, (environment) =>
      environment.with('temperature', {
        temperatureInKelvin: (environment.get('temperature')?.temperatureInKelvin ?? 0) + 50,
      }),
    );
    expect(context.environmentFor(inside).get('temperature')?.temperatureInKelvin).toBe(1050);
  });
});
