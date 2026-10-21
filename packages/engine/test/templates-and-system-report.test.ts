/* Runs every built-in template briefly (at most its own number of shots) and checks the system report: one frame per step, conserved charge, entanglement visible without collapse. */
import { describe, expect, it } from 'vitest';
import {
  EXPERIMENT_TEMPLATES,
  NEUTRON_FROM_QUARKS_TEMPLATE,
  runExperiment,
  SINGLET_CORRELATION_TEMPLATE,
} from '../src/index.js';

const SHOTS = 200;
const TEMPLATE_TIMEOUT_IN_MILLISECONDS = 60_000;

describe('built-in templates', () => {
  it.each(Object.keys(EXPERIMENT_TEMPLATES))(
    '%s runs and reports one frame per step',
    (name) => {
      const plan = EXPERIMENT_TEMPLATES[name];
      if (plan === undefined) {
        throw new Error('template expected');
      }
      const result = runExperiment(plan, { shots: Math.min(SHOTS, plan.shots), seed: 2 });
      expect(
        Object.keys(result.reportValues).length + Object.keys(result.distributions).length,
      ).toBeGreaterThan(0);
      expect(result.systemReport?.frames).toHaveLength(plan.steps.length + 1);
    },
    TEMPLATE_TIMEOUT_IN_MILLISECONDS,
  );
});

describe('system report', () => {
  it('shows the singlet as maximally entangled before measurement and records the pre-collapse odds', () => {
    const result = runExperiment(SINGLET_CORRELATION_TEMPLATE, { shots: 10, seed: 4 });
    const frames = result.systemReport?.frames ?? [];
    const afterEntangle = frames[3];
    const electronA = afterEntangle?.particles.find((particle) => particle.label === 'electronA');
    const spin = electronA?.quantum[0];
    expect(spin?.entangled).toBe(true);
    expect(spin?.entropyInBits).toBeCloseTo(1, 9);
    expect(spin?.purity).toBeCloseTo(0.5, 9);
    expect(spin?.sharesRegisterWith).toEqual(['electronB']);
    expect(
      Math.hypot(spin?.blochVector?.x ?? 1, spin?.blochVector?.y ?? 1, spin?.blochVector?.z ?? 1),
    ).toBeCloseTo(0, 9);
    const firstMeasure = frames[4]?.events[0];
    expect(firstMeasure?.kind).toBe('measured');
    expect(firstMeasure?.probabilitiesBefore?.map((outcome) => outcome.probability)).toEqual([
      0.5, 0.5,
    ]);
  });

  it('keeps charge and baryon number through binding and beta decay', () => {
    const result = runExperiment(NEUTRON_FROM_QUARKS_TEMPLATE, { shots: 10, seed: 5 });
    const frames = result.systemReport?.frames ?? [];
    const last = frames[frames.length - 1];
    expect(frames[3]?.totals.baryonNumber).toBeCloseTo(1, 9);
    expect(last?.totals.chargeInElementaryUnits).toBeCloseTo(0, 9);
    expect(last?.totals.baryonNumber).toBeCloseTo(1, 9);
    expect(last?.totals.electronNumber).toBe(0);
    const decay = last?.events[0];
    expect(decay?.kind).toBe('decayed');
    expect(decay?.products).toEqual(['neutron.0', 'neutron.1', 'neutron.2']);
    expect(last?.particles.find((particle) => particle.label === 'neutron')?.status).toBe(
      'decayed',
    );
  });

  it('carries an exact joint state and a free spin direction into a new plan', () => {
    const result = runExperiment(
      {
        name: 'carried',
        parameters: {},
        shots: 1,
        steps: [
          {
            operation: 'create',
            label: 'tilted',
            particle: 'electron',
            spinDirection: { polarAngleDegrees: 60, azimuthDegrees: 90 },
          },
          { operation: 'create', label: 'first', particle: 'electron' },
          { operation: 'create', label: 'second', particle: 'electron' },
          {
            operation: 'entangle',
            targets: ['first', 'second'],
            state: 'bellPhiPlus',
            amplitudes: { real: [0, 1, -1, 0], imaginary: [0, 0, 0, 0] },
          },
        ],
        report: [],
      },
      { shots: 1, seed: 1 },
    );
    const last = result.systemReport?.frames.at(-1);
    const tilted = last?.particles.find((particle) => particle.label === 'tilted')?.quantum[0];
    const polar = (60 * Math.PI) / 180;
    expect(tilted?.blochVector?.y).toBeCloseTo(Math.sin(polar), 9);
    expect(tilted?.blochVector?.z).toBeCloseTo(Math.cos(polar), 9);
    const joint = last?.particles.find((particle) => particle.label === 'first')?.quantum[0]
      ?.registerState;
    expect(joint?.slots).toEqual(['first', 'second']);
    expect(joint?.closestNamedState).toBe('spinSinglet');
    expect(joint?.closestNamedStateFidelity).toBeCloseTo(1, 9);
  });
});
