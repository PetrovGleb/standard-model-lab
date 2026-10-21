/* Checks the reactor physics: thermal cross sections reconstructed from the resolved resonances (uranium, plutonium, xenon-135, samarium-149), the cylinder body, free-gas scattering that
   heats a cold neutron towards the medium temperature, delayed neutron precursors born at the evaluated rate and released later, and the two Chernobyl cells read from their keyframes:
   the stable one within 5σ of its 32 seed neutrons, the disaster one above it by more than 3σ. */
import {
  BOLTZMANN_CONSTANT_IN_EV_PER_KELVIN,
  neutronData,
  particleSpec,
} from '@standard-model/constants';
import type { MediumAspect } from '@standard-model/contracts';
import { statisticalTolerance } from '@standard-model/utils';
import { describe, expect, it } from 'vitest';
import { NeutronTransport } from '../src/collisions/neutron-transport.js';
import { BODY_SHAPE_LAWS } from '../src/space/geometry.js';
import {
  EXPERIMENT_TEMPLATES,
  createEngine,
  experiment,
  neutronCrossSectionInBarns,
  runExperiment,
} from '../src/index.js';

const THERMAL_ENERGY_IN_EV = 0.0253;
const RELATIVE_TOLERANCE = 0.01;
const EVALUATED_THERMAL: ReadonlyArray<readonly [number, number, 'fission' | 'capture', number]> = [
  [92, 235, 'fission', 587],
  [92, 238, 'capture', 2.683],
  [94, 239, 'fission', 747.4],
  [54, 135, 'capture', 2.665e6],
  [62, 149, 'capture', 4.01e4],
];
const URANIUM_RESONANCE_IN_EV = 6.67;
const RESONANCE_PEAK_FLOOR_IN_BARNS = 1e4;
const CYLINDER_DIAMETER_IN_METERS = 0.2;
const CYLINDER_HEIGHT_IN_METERS = 0.6;
const PRECISION = 12;
const NEUTRON_MASS_IN_GEV = particleSpec('neutron').massInGev.value;
const EV_PER_GEV = 1e9;
const GRAPHITE_ATOMS_PER_CUBIC_METER = 8.5e28;
const GRAPHITE_TEMPERATURE_IN_KELVIN = 900;
const COLD_ENERGY_IN_EV = 0.001;
const THERMALIZING_TIME_IN_SECONDS = 1e-3;
const COLD_NEUTRONS = 200;
const URANIUM_METAL = 4.83e28;
const FISSIONS = 20_000;
const FISSION_ATTEMPTS = 40_000;
const TRANSPORT_STEP_IN_SECONDS = 1e-6;
const SEED_NEUTRONS = 50;
const SHOTS = 20;
const SMALL_BALL_IN_METERS = 0.01;
const PRECURSORS_GONE_IN_SECONDS = 300;
const REMAINING_SHARE = 0.1;
const TEMPLATE_SHOTS = 16;
const SEED_TOTAL = 32;
const HOLD_SIGMAS = 5;
const RUNAWAY_SIGMAS = 3;
const TEMPLATE_TIMEOUT_IN_MILLISECONDS = 180_000;
const TRANSPORT_TIMEOUT_IN_MILLISECONDS = 60_000;

function medium(species: string, density: number, temperatureInKelvin: number): MediumAspect {
  return {
    components: [
      {
        species: species as never,
        numberDensityPerCubicMeter: density,
        crossSectionInSquareMeters: 0,
      },
    ],
    temperatureInKelvin,
    bulkVelocityInMetersPerSecond: { x: 0, y: 0, z: 0 },
    reactionMode: 'oneReactionPerStep',
  } as MediumAspect;
}

function momentumInGev(kineticEnergyInEv: number): number {
  const kinetic = kineticEnergyInEv / EV_PER_GEV;
  return Math.sqrt(kinetic * kinetic + 2 * NEUTRON_MASS_IN_GEV * kinetic);
}

function template(name: string) {
  const plan = EXPERIMENT_TEMPLATES[name];
  if (plan === undefined) {
    throw new Error(`${name} template expected`);
  }
  return plan;
}

describe('resolved resonances', () => {
  it('gives the evaluated thermal cross sections of the actinides and the fission-product poisons', () => {
    EVALUATED_THERMAL.forEach(([protons, massNumber, reaction, evaluated]) => {
      const data = neutronData(protons, massNumber);
      expect(data).not.toBeNull();
      if (data === null) {
        return;
      }
      const value = neutronCrossSectionInBarns(data, reaction, THERMAL_ENERGY_IN_EV);
      expect(Math.abs(value / evaluated - 1)).toBeLessThan(RELATIVE_TOLERANCE);
    });
    const fertile = neutronData(92, 238);
    expect(
      fertile === null
        ? 0
        : neutronCrossSectionInBarns(fertile, 'capture', URANIUM_RESONANCE_IN_EV),
    ).toBeGreaterThan(RESONANCE_PEAK_FLOOR_IN_BARNS);
  });
});

describe('cylinder body', () => {
  it('holds points inside its radius and height and measures the way out along a ray', () => {
    const law = BODY_SHAPE_LAWS.cylinder;
    const geometry = {
      shape: 'cylinder' as const,
      centerInMeters: { x: 0, y: 0, z: 0 },
      sizeInMeters: CYLINDER_DIAMETER_IN_METERS,
      heightInMeters: CYLINDER_HEIGHT_IN_METERS,
    };
    const radius = CYLINDER_DIAMETER_IN_METERS / 2;
    const halfHeight = CYLINDER_HEIGHT_IN_METERS / 2;
    expect(law.contains(geometry, { x: 0.09, y: 0, z: 0.29 })).toBe(true);
    expect(law.contains(geometry, { x: 0.08, y: 0.08, z: 0 })).toBe(false);
    expect(law.contains(geometry, { x: 0, y: 0, z: 0.31 })).toBe(false);
    const origin = { x: 0, y: 0, z: 0 };
    expect(law.surfaceDistanceInMeters(geometry, origin, { x: 1, y: 0, z: 0 })).toBeCloseTo(
      radius,
      PRECISION,
    );
    expect(law.surfaceDistanceInMeters(geometry, origin, { x: 0, y: 0, z: -1 })).toBeCloseTo(
      halfHeight,
      PRECISION,
    );
    expect(
      law.surfaceDistanceInMeters(geometry, { x: -1, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }),
    ).toBeCloseTo(1 - radius, PRECISION);
    expect(law.surfaceDistanceInMeters(geometry, { x: -1, y: 0, z: 1 }, { x: 1, y: 0, z: 0 })).toBe(
      Number.POSITIVE_INFINITY,
    );
    expect(law.volumeInCubicMeters(geometry)).toBeCloseTo(
      Math.PI * radius * radius * CYLINDER_HEIGHT_IN_METERS,
      PRECISION,
    );
  });
});

describe('neutron transport', () => {
  it(
    'lets a cold neutron gain energy from the thermal motion of hot graphite',
    () => {
      const engine = createEngine({ seed: 3 });
      const transport = new NeutronTransport(engine.particles, engine.random);
      const world = {
        walls: null,
        ambient: medium(
          'atom:6:12:0',
          GRAPHITE_ATOMS_PER_CUBIC_METER,
          GRAPHITE_TEMPERATURE_IN_KELVIN,
        ),
        bodies: [],
      };
      const energies = Array.from({ length: COLD_NEUTRONS }, () => {
        const neutron = engine.particles.create('neutron', {
          momentumInGev: { x: 0, y: 0, z: momentumInGev(COLD_ENERGY_IN_EV) },
        });
        transport.transport(neutron, world, THERMALIZING_TIME_IN_SECONDS, { x: 0, y: 0, z: 0 });
        return (neutron.kinematics.fourMomentumInGev.energy - NEUTRON_MASS_IN_GEV) * EV_PER_GEV;
      });
      const mean = energies.reduce((sum, energy) => sum + energy, 0) / energies.length;
      const thermal = BOLTZMANN_CONSTANT_IN_EV_PER_KELVIN.value * GRAPHITE_TEMPERATURE_IN_KELVIN;
      expect(mean).toBeGreaterThan(thermal / 2);
      expect(mean).toBeLessThan(4 * thermal);
    },
    TRANSPORT_TIMEOUT_IN_MILLISECONDS,
  );

  it(
    'gives a delayed neutron precursor to the evaluated share of uranium-235 fissions',
    () => {
      const engine = createEngine({ seed: 5 });
      const transport = new NeutronTransport(engine.particles, engine.random);
      const world = {
        walls: null,
        ambient: medium('atom:92:235:0', URANIUM_METAL, 293),
        bodies: [],
      };
      let fissions = 0;
      let precursors = 0;
      for (let attempt = 0; attempt < FISSION_ATTEMPTS && fissions < FISSIONS; attempt += 1) {
        const neutron = engine.particles.create('neutron', {
          momentumInGev: { x: 0, y: 0, z: momentumInGev(THERMAL_ENERGY_IN_EV) },
        });
        const outcome = transport.transport(neutron, world, TRANSPORT_STEP_IN_SECONDS, {
          x: 0,
          y: 0,
          z: 0,
        });
        if (outcome?.kind === 'fission') {
          fissions += 1;
          precursors += outcome.precursors?.length ?? 0;
        }
      }
      const data = neutronData(92, 235);
      const [energies = [], values = []] = data?.delayedNeutrons?.perFission ?? [];
      const expected = values[energies.findIndex((energy) => energy >= THERMAL_ENERGY_IN_EV)] ?? 0;
      expect(fissions).toBe(FISSIONS);
      expect(Math.abs(precursors / fissions - expected)).toBeLessThan(
        statisticalTolerance(expected, fissions),
      );
    },
    TRANSPORT_TIMEOUT_IN_MILLISECONDS,
  );

  it(
    'records pending delayed neutrons and releases them minutes later',
    () => {
      const plan = experiment('delayed neutrons')
        .influence('setMedium', {
          components: [{ species: 'atom:92:235:0', numberDensityPerCubicMeter: URANIUM_METAL }],
          temperatureInKelvin: 293,
          thicknessInMeters: SMALL_BALL_IN_METERS,
        })
        .create('neutron', 'neutron', {
          momentumInGev: { x: 0, y: 0, z: momentumInGev(THERMAL_ENERGY_IN_EV) },
          count: SEED_NEUTRONS,
        })
        .evolve(TRANSPORT_STEP_IN_SECONDS)
        .measureSystem('fissioned')
        .report('mean', ['fissioned.pendingNeutrons'], 'pending')
        .evolve(PRECURSORS_GONE_IN_SECONDS)
        .measureSystem('later')
        .report('mean', ['later.pendingNeutrons'], 'remaining')
        .build();
      const values = runExperiment(plan, { shots: SHOTS, includeSystemReport: false }).reportValues;
      const pending = values.pending ?? 0;
      expect(pending).toBeGreaterThan(0);
      expect(values.remaining ?? 0).toBeLessThan(REMAINING_SHARE * pending);
    },
    TRANSPORT_TIMEOUT_IN_MILLISECONDS,
  );
});

describe('Chernobyl cells', () => {
  it(
    'holds the neutrons with the rod in and multiplies them with the rods out and the water boiling',
    () => {
      const neutronsAtEnd = (name: string) => {
        const keyframes = runExperiment(template(name), {
          shots: TEMPLATE_SHOTS,
          includeSystemReport: false,
        }).keyframes;
        const last = (keyframes?.names.length ?? 0) - 1;
        return keyframes?.tracks.find((track) => track.quantity === 'count.neutron')?.values[last];
      };
      const stable = neutronsAtEnd('chernobylStable');
      const disaster = neutronsAtEnd('chernobylDisaster');
      expect(stable).toBeDefined();
      expect(disaster).toBeDefined();
      if (stable === undefined || stable === null || disaster === undefined || disaster === null) {
        return;
      }
      expect(Math.abs(stable.mean - SEED_TOTAL)).toBeLessThan(HOLD_SIGMAS * stable.standardError);
      expect(disaster.mean - stable.mean).toBeGreaterThan(
        RUNAWAY_SIGMAS * Math.hypot(stable.standardError, disaster.standardError),
      );
    },
    TEMPLATE_TIMEOUT_IN_MILLISECONDS,
  );
});
