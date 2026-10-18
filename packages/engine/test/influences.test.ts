/* Checks the influence commands and their registry: temperature bounds, field aspects, boost, spin rotation, thermalize and evolve through the context. */
import { describe, expect, it } from 'vitest';
import {
  ApplyMagneticField,
  Boost,
  cool,
  createEngine,
  createEnvironment,
  Evolve,
  heat,
  RotateSpin,
  SetTemperature,
  spinHalfStateAlong,
  Thermalize,
  X_DIRECTION,
} from '../src/index.js';

const SEED = 13;
const PRECISION = 12;

describe('temperature influences', () => {
  it('sets, heats and cools without crossing absolute zero', () => {
    const engine = createEngine({ seed: SEED });
    const context = engine.contextFor(createEnvironment(), []);
    const warm = new SetTemperature(300).apply([], context).environment;
    const warmer = heat(50).apply([], engine.contextFor(warm, [])).environment;
    expect(warmer.get('temperature')?.temperatureInKelvin).toBe(350);
    const cooler = cool(349.5).apply([], engine.contextFor(warmer, [])).environment;
    expect(cooler.get('temperature')?.temperatureInKelvin).toBeCloseTo(0.5, PRECISION);
    expect(() => cool(1).apply([], engine.contextFor(cooler, []))).toThrow(/absolute zero/);
    expect(() => new SetTemperature(-1)).toThrow(/absolute zero/);
    expect(() => cool(1).apply([], context)).toThrow(/Set a temperature/);
  });
});

describe('particle influences', () => {
  it('applies a field, boosts and rotates a spin', () => {
    const engine = createEngine({ seed: SEED });
    const electron = engine.particles.create('electron');
    engine.quantum.prepare(electron, 'spin', 'up');
    const context = engine.contextFor(createEnvironment(), [electron]);
    const withField = new ApplyMagneticField({ x: 0, y: 0, z: 2 }).apply(
      [electron],
      context,
    ).environment;
    expect(withField.get('magneticField')?.fieldInTesla.z).toBe(2);
    new Boost({ x: 0.6, y: 0, z: 0 }).apply([electron], context);
    expect(electron.kinematics.fourMomentumInGev.momentum.x).toBeCloseTo(
      1.25 * 0.6 * electron.massInGev,
      15,
    );
    new RotateSpin(X_DIRECTION, Math.PI).apply([electron], context);
    const [outcome] = engine.quantum.probabilities(electron, 'spin');
    expect(outcome?.eigenvalue).toBe(-0.5);
    expect(outcome?.probability).toBeCloseTo(1, PRECISION);
  });

  it('thermalizes to the ground state at very low temperature', () => {
    const engine = createEngine({ seed: SEED });
    const electron = engine.particles.create('electron');
    engine.quantum.prepare(electron, 'spin', 'up');
    const environment = createEnvironment({
      magneticField: { fieldInTesla: { x: 0, y: 0, z: 1 } },
      temperature: { temperatureInKelvin: 1e-3 },
    });
    new Thermalize().apply([electron], engine.contextFor(environment, [electron]));
    const [outcome] = engine.quantum.probabilities(electron, 'spin');
    expect(outcome?.eigenvalue).toBe(-0.5);
    expect(outcome?.probability).toBeCloseTo(1, PRECISION);
  });

  it('refuses to thermalize an entangled particle', () => {
    const engine = createEngine({ seed: SEED });
    const electronA = engine.particles.create('electron');
    const electronB = engine.particles.create('electron');
    engine.quantum.entangle([electronA, electronB], 'spin', 'spinSinglet');
    const environment = createEnvironment({ temperature: { temperatureInKelvin: 1 } });
    expect(() =>
      new Thermalize().apply([electronA], engine.contextFor(environment, [electronA, electronB])),
    ).toThrow(/entangled/);
  });

  it('evolves through the context and keeps the state without aspects', () => {
    const engine = createEngine({ seed: SEED });
    const electron = engine.particles.create('electron');
    engine.quantum.prepare(electron, 'spin', 'plusX');
    new Evolve(2e-6).apply([electron], engine.contextFor(createEnvironment(), [electron]));
    expect(electron.kinematics.properTimeInSeconds).toBeCloseTo(2e-6, 15);
    expect(
      engine.quantum.stateOf(electron, 'spin').fidelityWith(spinHalfStateAlong(X_DIRECTION)),
    ).toBeCloseTo(1, PRECISION);
  });
});

describe('influence registry', () => {
  it('builds influences by name from parameters and rejects unknown ones', () => {
    const engine = createEngine({ seed: SEED });
    const context = engine.contextFor(createEnvironment(), []);
    const influence = engine.influences.create('applyMagneticField', { zInTesla: 1.5 });
    expect(influence.name).toBe('applyMagneticField');
    expect(influence.apply([], context).environment.get('magneticField')?.fieldInTesla).toEqual({
      x: 0,
      y: 0,
      z: 1.5,
    });
    expect(
      engine.influences.create('setMedium', {
        species: 'electron',
        numberDensityPerCubicMeter: 1,
        temperatureInKelvin: 1,
        crossSectionInSquareMeters: 1,
      }).name,
    ).toBe('setMedium');
    expect(() => engine.influences.create('teleport')).toThrow(/Unknown influence/);
    expect(() => engine.influences.create('evolve', { durationInSeconds: 'soon' })).toThrow(
      /must be a number/,
    );
    expect(() => engine.influences.create('setMedium', { species: 'graviton' })).toThrow(
      /particle name/,
    );
    expect(engine.influences.names).toContain('thermalize');
    const definitions = engine.influences.definitions;
    expect(definitions.map((definition) => definition.name)).toEqual(engine.influences.names);
    const [components] = engine.influences.definition('setMedium').parameters;
    expect(components?.kind).toBe('list');
    expect(components?.fields?.map((field) => field.kind)).toContain('particleName');
    expect(
      engine.influences
        .definition('applyMagneticField')
        .parameters.every((parameter) => !parameter.required),
    ).toBe(true);
    expect(() => engine.influences.definition('teleport')).toThrow(/Unknown influence/);
  });
});
