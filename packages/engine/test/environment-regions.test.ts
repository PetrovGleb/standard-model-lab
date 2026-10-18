/* Checks environments aimed at some particles: a gas set on one atom reacts with that atom only, an inner medium replaces the shared one for its members while other aspects add up,
   products inherit the regions of their parents, and every frame of the system report lists each region with the labels of its living members. */
import { atomName } from '@standard-model/constants';
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
