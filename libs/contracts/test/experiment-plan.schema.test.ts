/* Checks that the ajv schema accepts a valid plan with parameter placeholders and rejects malformed ones. */
import { describe, expect, it } from 'vitest';
import type { ExperimentPlan } from '../src/experiment-plan.js';
import { describePlanErrors, validateExperimentPlan } from '../src/experiment-plan.schema.js';

const SINGLET_CORRELATION_PLAN: ExperimentPlan = {
  name: 'singlet-correlation',
  parameters: { angleBetweenAxesDegrees: 120 },
  shots: 10_000,
  seed: 7,
  steps: [
    { operation: 'create', label: 'electronA', particle: 'electron' },
    { operation: 'create', label: 'electronB', particle: 'electron' },
    { operation: 'entangle', targets: ['electronA', 'electronB'], state: 'spinSinglet' },
    {
      operation: 'measure',
      target: 'electronA',
      observable: 'spin',
      axis: { polarAngleDegrees: 0, azimuthDegrees: 0 },
      record: 'a',
    },
    {
      operation: 'measure',
      target: 'electronB',
      observable: 'spin',
      axis: { polarAngleDegrees: '{{angleBetweenAxesDegrees}}', azimuthDegrees: 0 },
      record: 'b',
    },
  ],
  report: [{ statistic: 'probabilitySameSign', records: ['a', 'b'] }],
};

describe('validateExperimentPlan', () => {
  it('accepts a valid plan with parameter placeholders', () => {
    expect(validateExperimentPlan(SINGLET_CORRELATION_PLAN)).toBe(true);
  });

  it('rejects an unknown operation', () => {
    const broken = {
      ...SINGLET_CORRELATION_PLAN,
      steps: [{ operation: 'teleport', target: 'electronA' }],
    };
    expect(validateExperimentPlan(broken)).toBe(false);
    expect(describePlanErrors()).toContain('operation');
  });

  it('rejects a malformed parameter placeholder and an unknown particle', () => {
    const badPlaceholder = {
      ...SINGLET_CORRELATION_PLAN,
      steps: [{ operation: 'evolve', durationInSeconds: 'one second' }],
    };
    expect(validateExperimentPlan(badPlaceholder)).toBe(false);
    const badParticle = {
      ...SINGLET_CORRELATION_PLAN,
      steps: [{ operation: 'create', label: 'x', particle: 'graviton' }],
    };
    expect(validateExperimentPlan(badParticle)).toBe(false);
  });

  it('rejects zero shots', () => {
    expect(validateExperimentPlan({ ...SINGLET_CORRELATION_PLAN, shots: 0 })).toBe(false);
  });
});
