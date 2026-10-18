/* Monte Carlo tier for decoherence and thermalization: sampled trajectories reproduce the Lindblad and Boltzmann expectations within tolerance. */
import { BOLTZMANN_CONSTANT_IN_EV_PER_KELVIN } from '@standard-model/constants';
import { ELECTRON_GYROMAGNETIC_RATIO } from '@standard-model/constants';
import {
  angularFrequencyToEnergyInEv,
  DEFAULT_MONTE_CARLO_SHOTS,
  DEFAULT_SIGMA_MULTIPLIER,
  frequency,
  isWithinTolerance,
  statisticalTolerance,
} from '@standard-model/utils';
import { describe, expect, it } from 'vitest';
import {
  createEngine,
  createEnvironment,
  Thermalize,
  X_DIRECTION,
  Z_DIRECTION,
} from '../src/index.js';

const SEED = 20261015;
const BOLTZMANN_IN_EV_PER_KELVIN = BOLTZMANN_CONSTANT_IN_EV_PER_KELVIN.value;

describe('quantum jump decoherence', () => {
  it('dephases |+x> so that <sigma_x> decays to one half after T2 ln 2', () => {
    const engine = createEngine({ seed: SEED });
    const dephasingTime = 1e-6;
    const environment = createEnvironment({
      coherenceTimes: { dephasingTimeInSeconds: dephasingTime, relaxationTimeInSeconds: null },
    });
    const electron = engine.particles.create('electron');
    let signSum = 0;
    for (let shot = 0; shot < DEFAULT_MONTE_CARLO_SHOTS; shot += 1) {
      engine.quantum.prepare(electron, 'spin', 'plusX');
      engine.dynamics.evolve(electron, environment, dephasingTime * Math.LN2);
      signSum += Math.sign(engine.quantum.measure(electron, 'spin', X_DIRECTION).eigenvalue);
      engine.quantum.release(electron, 'spin');
    }
    const observed = signSum / DEFAULT_MONTE_CARLO_SHOTS;
    const standardError = Math.sqrt((1 - 0.25) / DEFAULT_MONTE_CARLO_SHOTS);
    expect(isWithinTolerance(observed, 0.5, DEFAULT_SIGMA_MULTIPLIER * standardError)).toBe(true);
  });

  it('relaxes the excited electron level to half after T1 ln 2 in a field', () => {
    const engine = createEngine({ seed: SEED });
    const relaxationTime = 1e-9;
    const environment = createEnvironment({
      magneticField: { fieldInTesla: { x: 0, y: 0, z: 1 } },
      coherenceTimes: { dephasingTimeInSeconds: null, relaxationTimeInSeconds: relaxationTime },
    });
    const electron = engine.particles.create('electron');
    let excitedCount = 0;
    for (let shot = 0; shot < DEFAULT_MONTE_CARLO_SHOTS; shot += 1) {
      engine.quantum.prepare(electron, 'spin', 'up');
      engine.dynamics.evolve(electron, environment, relaxationTime * Math.LN2);
      if (engine.quantum.measure(electron, 'spin', Z_DIRECTION).eigenvalue > 0) {
        excitedCount += 1;
      }
      engine.quantum.release(electron, 'spin');
    }
    const observed = frequency(excitedCount, DEFAULT_MONTE_CARLO_SHOTS);
    expect(
      isWithinTolerance(observed, 0.5, statisticalTolerance(0.5, DEFAULT_MONTE_CARLO_SHOTS)),
    ).toBe(true);
  });

  it('thermalizes the electron spin to the Boltzmann polarization at hbar omega = kT', () => {
    const engine = createEngine({ seed: SEED });
    const splittingInEv = angularFrequencyToEnergyInEv(ELECTRON_GYROMAGNETIC_RATIO.value);
    const environment = createEnvironment({
      magneticField: { fieldInTesla: { x: 0, y: 0, z: 1 } },
      temperature: { temperatureInKelvin: splittingInEv / BOLTZMANN_IN_EV_PER_KELVIN },
    });
    const electron = engine.particles.create('electron');
    const context = engine.contextFor(environment, [electron]);
    const thermalize = new Thermalize();
    let upCount = 0;
    for (let shot = 0; shot < DEFAULT_MONTE_CARLO_SHOTS; shot += 1) {
      engine.quantum.prepare(electron, 'spin', 'up');
      thermalize.apply([electron], context);
      if (engine.quantum.measure(electron, 'spin', Z_DIRECTION).eigenvalue > 0) {
        upCount += 1;
      }
      engine.quantum.release(electron, 'spin');
    }
    const expectedUp = 1 / (1 + Math.E);
    const observed = frequency(upCount, DEFAULT_MONTE_CARLO_SHOTS);
    expect(
      isWithinTolerance(
        observed,
        expectedUp,
        statisticalTolerance(expectedUp, DEFAULT_MONTE_CARLO_SHOTS),
      ),
    ).toBe(true);
    expect(2 * (observed - 0.5)).toBeLessThan(-0.4);
  });
});
