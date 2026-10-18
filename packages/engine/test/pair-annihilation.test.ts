/* Checks e⁺e⁻ annihilation in the cube: the trap rate against (π r_e² c)·∫ρ², the spin selection (singlet four times faster, parallel spins never), the system measurement and positron repulsion by a nucleus. */
import {
  ELECTRON_MASS,
  ELEMENTARY_CHARGE,
  REDUCED_PLANCK_CONSTANT,
} from '@standard-model/constants';
import { textIn, type ExperimentPlan } from '@standard-model/contracts';
import {
  DEFAULT_MONTE_CARLO_SHOTS,
  isWithinTolerance,
  statisticalTolerance,
} from '@standard-model/utils';
import { describe, expect, it } from 'vitest';
import {
  EXPERIMENT_TEMPLATES,
  runExperiment,
  SPIN_AVERAGED_ANNIHILATION_RATE_COEFFICIENT_IN_CUBIC_METERS_PER_SECOND,
} from '../src/index.js';

const WAIT_IN_SECONDS = 1e-9;
const TRAP_QUANTUM_IN_EV = 10;
const TRAP_GROUND_STATE_WIDTH_IN_METERS = Math.sqrt(
  (REDUCED_PLANCK_CONSTANT.value * REDUCED_PLANCK_CONSTANT.value) /
    (2 * ELECTRON_MASS.value * TRAP_QUANTUM_IN_EV * ELEMENTARY_CHARGE.value),
);
const SINGLET_WEIGHT = 4;
const ANNIHILATED = 'Что осталось в системе[photon+photon]';
const SURVIVED = 'Что осталось в системе[electron+positron]';

function trapPlan(): ExperimentPlan {
  const plan = EXPERIMENT_TEMPLATES.pairAnnihilationInTrap;
  if (plan === undefined) {
    throw new Error('template expected');
  }
  return plan;
}

function spinVariant(steps: ExperimentPlan['steps']): ExperimentPlan {
  const plan = trapPlan();
  return { ...plan, steps: [...steps, ...plan.steps.slice(2)] };
}

const spinAveragedExponent =
  SPIN_AVERAGED_ANNIHILATION_RATE_COEFFICIENT_IN_CUBIC_METERS_PER_SECOND *
  (4 * Math.PI * TRAP_GROUND_STATE_WIDTH_IN_METERS ** 2) ** -1.5 *
  WAIT_IN_SECONDS;

describe('pair annihilation in a trap', () => {
  it('matches 1 − exp(−π r_e² c ∫ρ² t) for unpolarized spins', () => {
    const result = runExperiment(trapPlan(), { shots: DEFAULT_MONTE_CARLO_SHOTS, seed: 5 });
    const expected = 1 - Math.exp(-spinAveragedExponent);
    expect(
      isWithinTolerance(
        result.reportValues[ANNIHILATED] ?? 0,
        expected,
        statisticalTolerance(expected, DEFAULT_MONTE_CARLO_SHOTS),
      ),
    ).toBe(true);
  });

  it('annihilates a spin singlet four times faster and parallel spins never', () => {
    const singlet = runExperiment(
      spinVariant([
        { operation: 'create', label: 'electron', particle: 'electron' },
        { operation: 'create', label: 'positron', particle: 'positron' },
        { operation: 'entangle', targets: ['electron', 'positron'], state: 'spinSinglet' },
      ]),
      { shots: DEFAULT_MONTE_CARLO_SHOTS, seed: 6 },
    );
    const expected = 1 - Math.exp(-SINGLET_WEIGHT * spinAveragedExponent);
    expect(
      isWithinTolerance(
        singlet.reportValues[ANNIHILATED] ?? 0,
        expected,
        statisticalTolerance(expected, DEFAULT_MONTE_CARLO_SHOTS),
      ),
    ).toBe(true);
    const parallel = runExperiment(
      spinVariant([
        { operation: 'create', label: 'electron', particle: 'electron', spin: 'up' },
        { operation: 'create', label: 'positron', particle: 'positron', spin: 'up' },
      ]),
      { shots: 1000, seed: 7 },
    );
    expect(parallel.reportValues[SURVIVED]).toBe(1);
  });

  it('shows the photons in the system report when the pair annihilates', () => {
    const frames = runExperiment(trapPlan(), { shots: 1, seed: 3 }).systemReport?.frames ?? [];
    const annihilated = frames
      .flatMap((frame) => frame.events)
      .find((event) => event.kind === 'annihilated');
    const system = textIn(frames.at(-1)?.events[0]?.text ?? '', 'en');
    expect(
      annihilated === undefined ? system.includes('electron') : system.includes('photon'),
    ).toBe(true);
  });

  it('repels a positron from a nucleus instead of binding it', () => {
    expect(() =>
      runExperiment(
        {
          name: 'positronHydrogen',
          parameters: {},
          shots: 1,
          space: {
            gridPointsPerAxis: 32,
            cellSizeInMeters: 4e-11,
            potential: 'coulomb',
            nuclearCharge: 1,
          },
          steps: [
            { operation: 'create', label: 'positron', particle: 'positron' },
            {
              operation: 'place',
              target: 'positron',
              centerInMeters: { x: 0, y: 0, z: 0 },
              widthInMeters: 1e-10,
              shape: 'groundState',
            },
          ],
          report: [],
        },
        { shots: 1, seed: 1 },
      ),
    ).toThrow(/только отрицательные/);
  });
});
