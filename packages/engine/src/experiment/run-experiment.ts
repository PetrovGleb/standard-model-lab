/* runExperiment: compile a plan, run all shots on a seeded engine, then trace extra shots with consecutive seeds into system reports, searching past the first few until every distinct
   final outcome that turns up within the search budget has a traced shot, so a rare branch of the statistics can be watched in the player. runExperimentAsync does the same while yielding
   between shots and reporting progress with the running mean shot duration and the remaining time it implies; estimateRun times a short pilot to forecast a run and weigh its steps. */
import type { ExperimentResult, RunEstimate, SystemReport } from '@standard-model/contracts';
import { createEngine } from '../index.js';
import { ExperimentRunner, type RunOptions } from './experiment-runner.js';
import { compilePlan, type CompiledPlan, type CompileOptions } from './plan-compiler.js';
import { SystemReporter } from './system-reporter.js';

const TRACED_SHOTS = 6;
const TRACE_SEARCH_LIMIT = 240;
const TRACE_SEARCH_BUDGET_IN_MILLISECONDS = 1500;
const PILOT_BUDGET_IN_MILLISECONDS = 800;
const PILOT_SHOT_LIMIT = 200;

export interface RunExperimentOptions extends CompileOptions, RunOptions {
  readonly includeSystemReport?: boolean;
}

function outcomeOf(report: SystemReport): string {
  const last = report.frames[report.frames.length - 1];
  return (last?.particles ?? [])
    .filter((particle) => particle.status === 'alive')
    .map((particle) => particle.name)
    .sort()
    .join('+');
}

export function tracedReports(
  trace: (seed: number) => SystemReport,
  firstSeed: number,
  now: () => number = () => Date.now(),
): readonly SystemReport[] {
  const started = now();
  const reports: SystemReport[] = [];
  const outcomes = new Set<string>();
  for (let offset = 0; offset < TRACE_SEARCH_LIMIT; offset += 1) {
    const report = trace(firstSeed + offset);
    reports.push(report);
    outcomes.add(outcomeOf(report));
    const searched = offset + 1 >= TRACED_SHOTS;
    if (
      searched &&
      (outcomes.size >= TRACED_SHOTS || now() - started > TRACE_SEARCH_BUDGET_IN_MILLISECONDS)
    ) {
      break;
    }
  }
  const representatives = [...outcomes].map(
    (outcome) => reports.find((report) => outcomeOf(report) === outcome) ?? reports[0],
  );
  const chosen = new Set<SystemReport>();
  [reports[0], ...representatives, ...reports].forEach((report) => {
    if (report !== undefined && chosen.size < TRACED_SHOTS) {
      chosen.add(report);
    }
  });
  return [...chosen].sort((first, second) => first.seed - second.seed);
}

function withTraces(
  compiled: CompiledPlan,
  result: ExperimentResult,
  options: RunExperimentOptions,
): ExperimentResult {
  if (options.includeSystemReport === false) {
    return result;
  }
  const tracingStarted = Date.now();
  const systemReports = tracedReports((seed) => {
    const traceEngine = createEngine({ seed });
    const reporter = new SystemReporter(traceEngine, seed);
    new ExperimentRunner(traceEngine).runShot(compiled, reporter);
    return reporter.report();
  }, compiled.seed);
  return {
    ...result,
    systemReport: systemReports[0] ?? null,
    systemReports,
    elapsedMilliseconds: result.elapsedMilliseconds + Date.now() - tracingStarted,
  };
}

export function runExperiment(plan: unknown, options: RunExperimentOptions = {}): ExperimentResult {
  const compiled = compilePlan(plan, options);
  const result = new ExperimentRunner(createEngine({ seed: compiled.seed })).run(compiled, options);
  return withTraces(compiled, result, options);
}

export async function runExperimentAsync(
  plan: unknown,
  options: RunExperimentOptions = {},
): Promise<ExperimentResult> {
  const compiled = compilePlan(plan, options);
  const result = await new ExperimentRunner(createEngine({ seed: compiled.seed })).runAsync(
    compiled,
    options,
  );
  if (result.stopped === true) {
    return result;
  }
  if (options.includeSystemReport !== false) {
    options.onProgress?.({
      completedShots: compiled.shots,
      totalShots: compiled.shots,
      phase: 'tracing',
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return withTraces(compiled, result, options);
}

export function estimateRun(plan: unknown, options: CompileOptions = {}): RunEstimate {
  const compiled = compilePlan(plan, options);
  const runner = new ExperimentRunner(createEngine({ seed: compiled.seed }));
  const firstStarted = performance.now();
  runner.runShot(compiled);
  const firstShotMilliseconds = performance.now() - firstStarted;
  const steadyLimit = Math.min(PILOT_SHOT_LIMIT, compiled.shots) - 1;
  const steadyStarted = performance.now();
  let steadyShots = 0;
  while (
    steadyShots < steadyLimit &&
    (steadyShots === 0 || performance.now() - steadyStarted < PILOT_BUDGET_IN_MILLISECONDS)
  ) {
    runner.runShot(compiled);
    steadyShots += 1;
  }
  const meanShotMilliseconds =
    steadyShots > 0 ? (performance.now() - steadyStarted) / steadyShots : firstShotMilliseconds;
  const traceMilliseconds = meanShotMilliseconds * TRACED_SHOTS;
  return {
    pilotShots: steadyShots + 1,
    firstShotMilliseconds,
    meanShotMilliseconds,
    stepMeanMilliseconds: runner.stepMeanMilliseconds,
    traceMilliseconds,
    predictedMilliseconds:
      firstShotMilliseconds +
      meanShotMilliseconds * Math.max(compiled.shots - 1, 0) +
      traceMilliseconds,
  };
}
