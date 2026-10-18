/* Exact-tier checks for the environment layer: Zeeman spectrum, Larmor precession, Kraus references, electric kicks, Boltzmann populations, collisions, immutability and aspect extension. */
import { BOLTZMANN_CONSTANT_IN_EV_PER_KELVIN } from '@standard-model/constants';
import {
  ELECTRON_GYROMAGNETIC_RATIO,
  PROTON_GYROMAGNETIC_RATIO,
  THOMSON_CROSS_SECTION,
  SPEED_OF_LIGHT,
} from '@standard-model/constants';
import type {
  Environment,
  EnvironmentAspectKey,
  HamiltonianContributor,
  HamiltonianTerm,
  MediumAspect,
  Particle,
} from '@standard-model/contracts';
import {
  angularFrequencyToEnergyInEv,
  gevToKilograms,
  thermalMeanSpeedInMetersPerSecond,
} from '@standard-model/utils';
import { describe, expect, it } from 'vitest';
import {
  applyKrausMap,
  collisionRatePerSecond,
  createEngine,
  createEnvironment,
  DensityMatrix,
  dephasingKraus,
  entryAt,
  meanFreePathInMeters,
  relaxationKrausForHamiltonian,
  scaleMatrix,
  spectralDecomposition,
  spinHalfStateAlong,
  spinOperators,
  X_DIRECTION,
  Y_DIRECTION,
  type ComplexMatrix,
} from '../src/index.js';

declare module '@standard-model/contracts' {
  interface EnvironmentAspects {
    spinBias: { readonly biasInRadiansPerSecond: number };
  }
}

const SEED = 11;
const PRECISION = 12;
const ONE_TESLA_ALONG_Z = { fieldInTesla: { x: 0, y: 0, z: 1 } };

function expectRelative(actual: number, expected: number, precision = 1e-9): void {
  expect(Math.abs(actual - expected) / Math.abs(expected)).toBeLessThan(precision);
}

function spectrumSplitting(hamiltonian: ComplexMatrix | null): number {
  if (hamiltonian === null) {
    throw new Error('Hamiltonian expected');
  }
  const eigenvalues = spectralDecomposition(hamiltonian).map((component) => component.eigenvalue);
  return Math.max(...eigenvalues) - Math.min(...eigenvalues);
}

describe('Zeeman Hamiltonian', () => {
  it('splits the electron and proton spin levels by gamma B', () => {
    const engine = createEngine({ seed: SEED });
    const environment = createEnvironment({ magneticField: ONE_TESLA_ALONG_Z });
    const electron = engine.particles.create('electron');
    const proton = engine.particles.create('proton');
    const electronSplitting = spectrumSplitting(
      engine.dynamics.slotHamiltonian(electron, 'spin', environment),
    );
    expectRelative(electronSplitting, ELECTRON_GYROMAGNETIC_RATIO.value);
    expectRelative(electronSplitting / (2 * Math.PI), 28024.9513861e6, 1e-8);
    expectRelative(angularFrequencyToEnergyInEv(electronSplitting), 1.15901886e-4, 1e-7);
    const protonSplitting = spectrumSplitting(
      engine.dynamics.slotHamiltonian(proton, 'spin', environment),
    );
    expectRelative(protonSplitting / (2 * Math.PI), 42.577478461e6, 1e-8);
  });

  it('puts the electron m = +1/2 level above m = -1/2', () => {
    const engine = createEngine({ seed: SEED });
    const environment = createEnvironment({ magneticField: ONE_TESLA_ALONG_Z });
    const electron = engine.particles.create('electron');
    const hamiltonian = engine.dynamics.slotHamiltonian(electron, 'spin', environment);
    expect(entryAt(hamiltonian ?? spinOperators(0.5).z, 0, 0).real).toBeGreaterThan(0);
  });

  it('gives no Hamiltonian to neutral spinless or dipole-free particles', () => {
    const engine = createEngine({ seed: SEED });
    const environment = createEnvironment({ magneticField: ONE_TESLA_ALONG_Z });
    expect(
      engine.dynamics.slotHamiltonian(
        engine.particles.create('electronNeutrino'),
        'spin',
        environment,
      ),
    ).toBeNull();
    expect(
      engine.dynamics.slotHamiltonian(
        engine.particles.create('photon'),
        'polarization',
        environment,
      ),
    ).toBeNull();
  });
});

describe('Larmor precession', () => {
  it('rotates the electron Bloch vector at gamma B and returns after a full period', () => {
    const engine = createEngine({ seed: SEED });
    const environment = createEnvironment({ magneticField: ONE_TESLA_ALONG_Z });
    const electron = engine.particles.create('electron');
    engine.quantum.prepare(electron, 'spin', 'plusX');
    const angularFrequency = ELECTRON_GYROMAGNETIC_RATIO.value;
    engine.dynamics.evolve(electron, environment, Math.PI / (2 * angularFrequency));
    expect(engine.quantum.expectation(electron, 'spin', Y_DIRECTION)).toBeCloseTo(0.5, 9);
    expect(engine.quantum.expectation(electron, 'spin', X_DIRECTION)).toBeCloseTo(0, 9);
    engine.dynamics.evolve(electron, environment, (3 * Math.PI) / (2 * angularFrequency));
    expect(
      engine.quantum.stateOf(electron, 'spin').fidelityWith(spinHalfStateAlong(X_DIRECTION)),
    ).toBeCloseTo(1, 9);
  });

  it('precesses the proton the other way', () => {
    const engine = createEngine({ seed: SEED });
    const environment = createEnvironment({ magneticField: ONE_TESLA_ALONG_Z });
    const proton = engine.particles.create('proton');
    engine.quantum.prepare(proton, 'spin', 'plusX');
    engine.dynamics.evolve(proton, environment, Math.PI / (2 * PROTON_GYROMAGNETIC_RATIO.value));
    expect(engine.quantum.expectation(proton, 'spin', Y_DIRECTION)).toBeCloseTo(-0.5, 9);
  });
});

describe('Kraus references on density matrices', () => {
  it('halves the coherence of |+x> after T2 ln 2 of dephasing', () => {
    const density = DensityMatrix.fromPureState(spinHalfStateAlong(X_DIRECTION));
    const probability = 1 - Math.exp(-Math.LN2);
    const dephased = applyKrausMap(density, dephasingKraus(2, probability));
    expect(entryAt(dephased.matrix, 0, 1).real).toBeCloseTo(0.25, PRECISION);
    expect(entryAt(dephased.matrix, 0, 0).real).toBeCloseTo(0.5, PRECISION);
    expect(dephased.purity()).toBeCloseTo(0.5 + 2 * 0.25 * 0.25, PRECISION);
  });

  it('moves half the excited population to the ground state after T1 ln 2', () => {
    const engine = createEngine({ seed: SEED });
    const environment = createEnvironment({ magneticField: ONE_TESLA_ALONG_Z });
    const electron = engine.particles.create('electron');
    const hamiltonian = engine.dynamics.slotHamiltonian(electron, 'spin', environment);
    if (hamiltonian === null) {
      throw new Error('Hamiltonian expected');
    }
    const excited = DensityMatrix.fromPureState(
      spinHalfStateAlong({ polarAngleDegrees: 0, azimuthDegrees: 0 }),
    );
    const relaxed = applyKrausMap(
      excited,
      relaxationKrausForHamiltonian(hamiltonian, 1 - Math.exp(-Math.LN2)),
    );
    expect(entryAt(relaxed.matrix, 0, 0).real).toBeCloseTo(0.5, PRECISION);
    expect(entryAt(relaxed.matrix, 1, 1).real).toBeCloseTo(0.5, PRECISION);
  });
});

describe('kinematic effects of evolve', () => {
  it('kicks a charged particle by q E t and leaves neutral ones alone', () => {
    const engine = createEngine({ seed: SEED });
    const environment = createEnvironment({
      electricField: { fieldInVoltsPerMeter: { x: 0, y: 0, z: 1e6 } },
    });
    const electron = engine.particles.create('electron');
    const neutrino = engine.particles.create('electronNeutrino');
    engine.dynamics.evolve(electron, environment, 1e-9);
    engine.dynamics.evolve(neutrino, environment, 1e-9);
    const expectedKickInGev = (-1e6 * 1e-9 * SPEED_OF_LIGHT.value) / 1e9;
    expect(electron.kinematics.fourMomentumInGev.momentum.z).toBeCloseTo(expectedKickInGev, 15);
    expect(neutrino.kinematics.fourMomentumInGev.momentum.z).toBe(0);
  });

  it('advances proper time by t over gamma and not at all for photons', () => {
    const engine = createEngine({ seed: SEED });
    const environment = createEnvironment();
    const muon = engine.particles.create('muon');
    muon.setMomentum({ x: 0, y: 0, z: 0.75 * muon.massInGev });
    engine.dynamics.evolve(muon, environment, 1e-6);
    expect(muon.kinematics.properTimeInSeconds).toBeCloseTo(0.8e-6, 15);
    const photon = engine.particles.create('photon', { momentumInGev: { x: 0, y: 0, z: 1 } });
    engine.dynamics.evolve(photon, environment, 1e-6);
    expect(photon.kinematics.properTimeInSeconds).toBe(0);
  });

  it('leaves the quantum state unchanged without any aspect', () => {
    const engine = createEngine({ seed: SEED });
    const electron = engine.particles.create('electron');
    engine.quantum.prepare(electron, 'spin', 'plusY');
    engine.dynamics.evolve(electron, createEnvironment(), 1);
    expect(
      engine.quantum.stateOf(electron, 'spin').fidelityWith(spinHalfStateAlong(Y_DIRECTION)),
    ).toBeCloseTo(1, PRECISION);
  });
});

describe('thermal populations', () => {
  it('follows Boltzmann weights with the electron ground level at m = -1/2', () => {
    const engine = createEngine({ seed: SEED });
    const electron = engine.particles.create('electron');
    const splittingInEv = angularFrequencyToEnergyInEv(ELECTRON_GYROMAGNETIC_RATIO.value);
    const temperatureInKelvin = splittingInEv / BOLTZMANN_CONSTANT_IN_EV_PER_KELVIN.value;
    const environment = createEnvironment({
      magneticField: ONE_TESLA_ALONG_Z,
      temperature: { temperatureInKelvin },
    });
    const populations = engine.dynamics.thermalPopulations(electron, 'spin', environment);
    const [upper, lower] = populations;
    expect(upper?.eigenvalueInRadiansPerSecond).toBeGreaterThan(
      lower?.eigenvalueInRadiansPerSecond ?? 0,
    );
    expect(upper?.probability).toBeCloseTo(1 / (1 + Math.E), 9);
    expect(lower?.probability).toBeCloseTo(Math.E / (1 + Math.E), 9);
  });

  it('is uniform without a Hamiltonian and refuses without a temperature', () => {
    const engine = createEngine({ seed: SEED });
    const electron = engine.particles.create('electron');
    const [only] = engine.dynamics.thermalPopulations(
      electron,
      'spin',
      createEnvironment({ temperature: { temperatureInKelvin: 1 } }),
    );
    expect(only?.multiplicity).toBe(2);
    expect(only?.probability).toBe(1);
    expect(() => engine.dynamics.thermalPopulations(electron, 'spin', createEnvironment())).toThrow(
      /temperature/,
    );
  });
});

describe('statistical medium', () => {
  it('gives the collision rate n sigma v and the mean free path', () => {
    const engine = createEngine({ seed: SEED });
    const medium: MediumAspect = {
      components: [
        {
          species: 'electron',
          numberDensityPerCubicMeter: 1e20,
          crossSectionInSquareMeters: THOMSON_CROSS_SECTION.value,
        },
      ],
      temperatureInKelvin: 300,
      bulkVelocityInMetersPerSecond: { x: 0, y: 0, z: 0 },
      reactionMode: 'oneReactionPerStep',
    };
    const photon = engine.particles.create('photon', { momentumInGev: { x: 0, y: 0, z: 1 } });
    const thermalSpeed = thermalMeanSpeedInMetersPerSecond(
      gevToKilograms(engine.particles.create('electron').massInGev),
      300,
    );
    const expectedRate = 1e20 * THOMSON_CROSS_SECTION.value * (SPEED_OF_LIGHT.value + thermalSpeed);
    expectRelative(collisionRatePerSecond(medium, photon), expectedRate, 1e-12);
    expectRelative(meanFreePathInMeters(medium), 1 / (1e20 * THOMSON_CROSS_SECTION.value), 1e-12);
    const environment = createEnvironment({ medium });
    expect(engine.dynamics.decoherenceRates(photon, environment).dephasingRateInHertz).toBeCloseTo(
      expectedRate,
      3,
    );
    expect(engine.dynamics.collisionRatePerSecond(photon, createEnvironment())).toBe(0);
  });
});

describe('environment', () => {
  it('is immutable and typed per aspect', () => {
    const base = createEnvironment({ temperature: { temperatureInKelvin: 4 } });
    const warmer = base.with('temperature', { temperatureInKelvin: 300 });
    expect(base.get('temperature')?.temperatureInKelvin).toBe(4);
    expect(warmer.get('temperature')?.temperatureInKelvin).toBe(300);
    expect(warmer.without('temperature').get('temperature')).toBeUndefined();
    expect(warmer.with('magneticField', ONE_TESLA_ALONG_Z).aspectKeys).toEqual([
      'temperature',
      'magneticField',
    ]);
  });

  it('accepts a new aspect and contributor without changes to the engine', () => {
    class SpinBiasContributor implements HamiltonianContributor<ComplexMatrix> {
      readonly aspectKey: EnvironmentAspectKey = 'spinBias';

      contribute(
        environment: Environment,
        particle: Particle,
      ): readonly HamiltonianTerm<ComplexMatrix>[] {
        const bias = environment.get('spinBias');
        if (bias === undefined || particle.spec.name !== 'electron') {
          return [];
        }
        return [
          {
            observable: 'spin',
            operatorInRadiansPerSecond: scaleMatrix(
              spinOperators(0.5).z,
              bias.biasInRadiansPerSecond,
            ),
          },
        ];
      }
    }
    const engine = createEngine({
      seed: SEED,
      extraHamiltonianContributors: [new SpinBiasContributor()],
    });
    const environment = createEnvironment().with('spinBias', { biasInRadiansPerSecond: 10 });
    const electron = engine.particles.create('electron');
    expect(
      spectrumSplitting(engine.dynamics.slotHamiltonian(electron, 'spin', environment)),
    ).toBeCloseTo(10, PRECISION);
    expect(
      engine.dynamics.slotHamiltonian(engine.particles.create('muon'), 'spin', environment),
    ).toBeNull();
  });
});
