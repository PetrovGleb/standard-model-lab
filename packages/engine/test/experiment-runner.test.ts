/* Checks the runner on deterministic plans: certain outcomes, singlet anti-correlation, Larmor read-out, decay records, progress and result shape. */
import { describe, expect, it } from 'vitest';
import {
  compilePlan,
  createEngine,
  ELECTRON_QUARTER_PERIOD_AT_ONE_TESLA_IN_SECONDS,
  experiment,
  ExperimentRunner,
  LARMOR_PRECESSION_TEMPLATE,
  runExperiment,
  SINGLET_CORRELATION_TEMPLATE,
  STERN_GERLACH_TEMPLATE,
} from '../src/index.js';

const SMALL_SHOTS = 500;

describe('ExperimentRunner', () => {
  it('measures a certain outcome with frequency one', () => {
    const result = runExperiment(STERN_GERLACH_TEMPLATE, {
      parameters: { polarAngleDegrees: 0 },
      shots: SMALL_SHOTS,
      seed: 3,
    });
    expect(result.reportValues['spin[0.5]']).toBe(1);
    expect(result.reportValues.meanSpin).toBe(0.5);
    expect(result.outcomeCounts.spin).toEqual({ '0.5': SMALL_SHOTS });
    expect(result.shots).toBe(SMALL_SHOTS);
    expect(result.seed).toBe(3);
    expect(result.planName).toBe('sternGerlach');
    expect(result.elapsedMilliseconds).toBeGreaterThanOrEqual(0);
  });

  it('never finds the same sign on a singlet measured along one axis', () => {
    const result = runExperiment(SINGLET_CORRELATION_TEMPLATE, {
      parameters: { angleBetweenAxesDegrees: 0 },
      shots: SMALL_SHOTS,
      seed: 5,
    });
    expect(result.reportValues.sameSign).toBe(0);
    expect(result.reportValues.correlation).toBe(-1);
  });

  it('reads out the Larmor quarter turn as spin fully along y', () => {
    const result = runExperiment(LARMOR_PRECESSION_TEMPLATE, {
      parameters: { durationInSeconds: ELECTRON_QUARTER_PERIOD_AT_ONE_TESLA_IN_SECONDS },
      shots: SMALL_SHOTS,
      seed: 7,
    });
    expect(result.reportValues.meanSpinY).toBeCloseTo(0.5, 9);
  });

  it('records decays with derived numeric records and product labels', () => {
    const plan = experiment('muonChain')
      .create('muon', 'muon')
      .decay('muon', 'decay')
      .influence('randomize', {}, ['muon.0'])
      .measure('muon.0', 'spin', 'electronSpin')
      .report('mean', ['decay.product[0].energyInGev'], 'electronEnergy')
      .report('frequency', ['decay'], 'channel')
      .report('frequency', ['electronSpin'], 'electronSpin')
      .build();
    const result = runExperiment(plan, { shots: 50, seed: 9 });
    expect(result.outcomeCounts.decay).toEqual({
      'electron+electronAntineutrino+muonNeutrino': 50,
    });
    expect(result.reportValues.electronEnergy).toBeGreaterThan(0);
    expect(result.reportValues.electronEnergy).toBeLessThan(0.0529);
    expect(
      (result.reportValues['electronSpin[0.5]'] ?? 0) +
        (result.reportValues['electronSpin[-0.5]'] ?? 0),
    ).toBe(1);
  });

  it('reports progress and leaves no registers behind', () => {
    const engine = createEngine({ seed: 11 });
    const runner = new ExperimentRunner(engine);
    const compiled = compilePlan(SINGLET_CORRELATION_TEMPLATE, { shots: 20 });
    const progress: number[] = [];
    runner.run(compiled, {
      onProgress: (event) => progress.push(event.completedShots),
      progressEveryShots: 5,
    });
    expect(progress).toEqual([5, 10, 15, 20]);
    expect(engine.quantum.registers.size).toBe(0);
  });

  it('prepares photon polarization when a create step asks for a spin state', () => {
    const plan = experiment('photon')
      .create('gamma', 'photon', { spin: 'plusX' })
      .measure('gamma', 'polarization', 'polarization', {
        polarAngleDegrees: 90,
        azimuthDegrees: 0,
      })
      .report('frequency', ['polarization'], 'polarization')
      .build();
    const result = runExperiment(plan, { shots: 20, seed: 4 });
    expect(result.reportValues['polarization[0.5]']).toBe(1);
    const higgs = experiment('higgs').create('h', 'higgsBoson', { spin: 'up' }).build();
    expect(() => runExperiment(higgs, { shots: 1 })).toThrow(/has spin 0/);
  });

  it('fails clearly when a plan measures an unprepared spin', () => {
    const plan = experiment('unprepared').create('e', 'electron').measure('e', 'spin', 'r').build();
    expect(() => runExperiment(plan, { shots: 1 })).toThrow(/not prepared/);
  });
});
