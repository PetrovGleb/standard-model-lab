/* Checks the neutrino flavor Hamiltonian against the two-flavor oracle formula and the oscillation template end to end. */
import { REDUCED_PLANCK_CONSTANT_IN_EV_SECOND, SPEED_OF_LIGHT } from '@standard-model/constants';
import type { NeutrinoMixingAspect } from '@standard-model/contracts';
import { describe, expect, it } from 'vitest';
import {
  createEngine,
  createEnvironment,
  experiment,
  isUnitary,
  NEUTRINO_OSCILLATION_TEMPLATE,
  PDG_NEUTRINO_MIXING,
  pmnsMatrix,
  runExperiment,
  spectralDecomposition,
} from '../src/index.js';

const SEED = 19;
const PRECISION = 9;
const EV_PER_GEV = 1e9;

const TWO_FLAVOR_MU_TAU: NeutrinoMixingAspect = {
  mixingAngle12SinSquared: 0,
  mixingAngle13SinSquared: 0,
  mixingAngle23SinSquared: 0.5,
  massSquaredDifference21InElectronVoltsSquared: 0,
  massSquaredDifference31InElectronVoltsSquared: 2.5e-3,
};

function flightTimeForPhase(
  phase: number,
  energyInGev: number,
  massSquaredDifference: number,
): number {
  return (
    (phase * 4 * energyInGev * EV_PER_GEV * REDUCED_PLANCK_CONSTANT_IN_EV_SECOND.value) /
    massSquaredDifference
  );
}

describe('neutrino flavor Hamiltonian', () => {
  it('builds a unitary PMNS matrix from the PDG angles', () => {
    expect(isUnitary(pmnsMatrix(PDG_NEUTRINO_MIXING))).toBe(true);
  });

  it('splits levels by dm2 / 2E and converts a muon neutrino fully into tau at phase pi/2', () => {
    const engine = createEngine({ seed: SEED });
    const environment = createEnvironment({ neutrinoMixing: TWO_FLAVOR_MU_TAU });
    const energyInGev = 1;
    const neutrino = engine.particles.create('muonNeutrino', {
      momentumInGev: { x: 0, y: 0, z: energyInGev },
    });
    engine.quantum.prepare(neutrino, 'flavor', 1);
    const hamiltonian = engine.dynamics.slotHamiltonian(neutrino, 'flavor', environment);
    if (hamiltonian === null) {
      throw new Error('flavor Hamiltonian expected');
    }
    const eigenvalues = spectralDecomposition(hamiltonian).map((component) => component.eigenvalue);
    const expectedSplitting =
      TWO_FLAVOR_MU_TAU.massSquaredDifference31InElectronVoltsSquared /
      (2 * energyInGev * EV_PER_GEV * REDUCED_PLANCK_CONSTANT_IN_EV_SECOND.value);
    expect(Math.max(...eigenvalues) - Math.min(...eigenvalues)).toBeCloseTo(expectedSplitting, 3);
    const flightTime = flightTimeForPhase(
      Math.PI / 2,
      energyInGev,
      TWO_FLAVOR_MU_TAU.massSquaredDifference31InElectronVoltsSquared,
    );
    engine.dynamics.evolve(neutrino, environment, flightTime);
    const [tau] = engine.quantum.probabilities(neutrino, 'flavor');
    expect(tau?.eigenvalue).toBe(2);
    expect(tau?.probability).toBeCloseTo(1, PRECISION);
    engine.dynamics.evolve(neutrino, environment, flightTime);
    const [muon] = engine.quantum.probabilities(neutrino, 'flavor');
    expect(muon?.eigenvalue).toBe(1);
    expect(muon?.probability).toBeCloseTo(1, PRECISION);
  });

  it('keeps three-flavor probabilities normalized with PDG mixing and shows little electron appearance', () => {
    const engine = createEngine({ seed: SEED });
    const neutrino = engine.particles.create('muonNeutrino', {
      momentumInGev: { x: 0, y: 0, z: 0.6 },
    });
    engine.quantum.prepare(neutrino, 'flavor', 1);
    engine.dynamics.evolve(neutrino, createEnvironment(), (295 * 1000) / SPEED_OF_LIGHT.value);
    const outcomes = engine.quantum.probabilities(neutrino, 'flavor');
    expect(outcomes.reduce((sum, outcome) => sum + outcome.probability, 0)).toBeCloseTo(
      1,
      PRECISION,
    );
    const electron = outcomes.find((outcome) => outcome.eigenvalue === 0);
    expect(electron?.probability ?? 0).toBeLessThan(0.1);
  });

  it('does not oscillate a neutrino without momentum', () => {
    const engine = createEngine({ seed: SEED });
    const neutrino = engine.particles.create('muonNeutrino');
    engine.quantum.prepare(neutrino, 'flavor', 1);
    expect(engine.dynamics.slotHamiltonian(neutrino, 'flavor', createEnvironment())).toBeNull();
    engine.dynamics.evolve(neutrino, createEnvironment(), 1);
    const [muon] = engine.quantum.probabilities(neutrino, 'flavor');
    expect(muon?.eigenvalue).toBe(1);
    expect(muon?.probability).toBeCloseTo(1, PRECISION);
  });
});

describe('neutrino oscillation template', () => {
  it('runs with PDG mixing and records flavors by name', () => {
    const result = runExperiment(NEUTRINO_OSCILLATION_TEMPLATE, { shots: 200, seed: SEED });
    const flavors = Object.keys(result.outcomeCounts.flavor ?? {});
    expect(flavors.every((flavor) => ['electron', 'muon', 'tau'].includes(flavor))).toBe(true);
    expect(
      Object.values(result.outcomeCounts.flavor ?? {}).reduce((sum, count) => sum + count, 0),
    ).toBe(200);
  });

  it('converts every muon neutrino into tau at the two-flavor phase pi/2', () => {
    const plan = experiment('twoFlavor')
      .parameter('energyInGev', 1)
      .create('neutrino', 'muonNeutrino', { momentumInGev: { x: 0, y: 0, z: '{{energyInGev}}' } })
      .measure('neutrino', 'flavor', 'flavor')
      .report('frequency', ['flavor'], 'flavor')
      .build();
    const flightTime = flightTimeForPhase(
      Math.PI / 2,
      1,
      TWO_FLAVOR_MU_TAU.massSquaredDifference31InElectronVoltsSquared,
    );
    const engine = createEngine({ seed: SEED });
    const neutrino = engine.particles.create('muonNeutrino', {
      momentumInGev: { x: 0, y: 0, z: 1 },
    });
    engine.quantum.prepare(neutrino, 'flavor', 1);
    engine.dynamics.evolve(
      neutrino,
      createEnvironment({ neutrinoMixing: TWO_FLAVOR_MU_TAU }),
      flightTime,
    );
    expect(engine.quantum.measure(neutrino, 'flavor').outcomeIndex).toBe(0);
    expect(plan.steps).toHaveLength(2);
  });
});
