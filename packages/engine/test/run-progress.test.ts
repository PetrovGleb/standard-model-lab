/* Checks live run progress: the first-shot phase comes before any shot, every later report gives the remaining time as the running mean shot duration times the shots left, and tracing comes last;
   a result and a pilot estimate carry one mean time per step, and the forecast is the first shot plus the mean of the later shots times the rest plus the traces; a stop request ends the run before the next shot
   with the statistics of the finished shots and no traces. */
import type { RunProgress } from '@standard-model/contracts';
import { describe, expect, it } from 'vitest';
import {
  EXPERIMENT_TEMPLATES,
  estimateRun,
  runExperiment,
  runExperimentAsync,
} from '../src/index.js';

const SHOTS = 40;
const STOP_AFTER_SHOTS = 7;
const RELATIVE_PRECISION = 1e-12;

describe('run progress', () => {
  it('reports the first shot, then the remaining time from the running mean, then tracing', async () => {
    const reports: RunProgress[] = [];
    const plan = EXPERIMENT_TEMPLATES.sternGerlach;
    const result = await runExperimentAsync(plan, {
      shots: SHOTS,
      onProgress: (progress) => reports.push(progress),
    });
    expect(reports[0]).toEqual({ completedShots: 0, totalShots: SHOTS, phase: 'firstShot' });
    const shots = reports.filter((progress) => progress.phase === 'shots');
    expect(shots.map((progress) => progress.completedShots)).toEqual(
      Array.from({ length: SHOTS }, (unused, index) => index + 1),
    );
    shots.forEach((progress) => {
      const expected = (progress.meanShotMilliseconds ?? 0) * (SHOTS - progress.completedShots);
      expect(progress.remainingMilliseconds ?? Number.NaN).toBeCloseTo(
        expected,
        -Math.log10(RELATIVE_PRECISION * Math.max(1, expected)),
      );
    });
    expect(shots[shots.length - 1]?.remainingMilliseconds).toBe(0);
    expect(reports[reports.length - 1]?.phase).toBe('tracing');
    expect(result.reportValues).toEqual(runExperiment(plan, { shots: SHOTS }).reportValues);
  });

  it('times every step and forecasts the run from a pilot', () => {
    const plan = EXPERIMENT_TEMPLATES.sternGerlach;
    const steps = plan?.steps.length ?? 0;
    expect(steps).toBeGreaterThan(0);
    const result = runExperiment(plan, { shots: SHOTS });
    expect(result.stepMeanMilliseconds).toHaveLength(steps);
    result.stepMeanMilliseconds?.forEach((milliseconds) =>
      expect(milliseconds).toBeGreaterThanOrEqual(0),
    );
    const estimate = estimateRun(plan, { shots: SHOTS });
    expect(estimate.stepMeanMilliseconds).toHaveLength(steps);
    expect(estimate.pilotShots).toBeGreaterThan(0);
    expect(estimate.predictedMilliseconds).toBeCloseTo(
      estimate.firstShotMilliseconds +
        estimate.meanShotMilliseconds * (SHOTS - 1) +
        estimate.traceMilliseconds,
      -Math.log10(RELATIVE_PRECISION * Math.max(1, estimate.predictedMilliseconds)),
    );
  });

  it('stops before the next shot when asked and keeps the finished shots', async () => {
    const plan = EXPERIMENT_TEMPLATES.sternGerlach;
    let finished = 0;
    const result = await runExperimentAsync(plan, {
      shots: SHOTS,
      onProgress: (progress) => {
        finished = progress.completedShots;
      },
      shouldStop: () => finished >= STOP_AFTER_SHOTS,
    });
    expect(result.stopped).toBe(true);
    expect(result.shots).toBe(STOP_AFTER_SHOTS);
    expect(result.requestedShots).toBe(SHOTS);
    expect(result.systemReports ?? []).toHaveLength(0);
    const counted = Object.values(result.outcomeCounts).flatMap((counts) => Object.values(counts));
    expect(counted.reduce((sum, count) => sum + count, 0)).toBe(STOP_AFTER_SHOTS);
  });
});
