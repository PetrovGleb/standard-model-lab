/* RunsService: starts a run from a template or an inline plan, executes it in process yielding between shots and reporting progress, stops an active run before its next shot keeping the
   completed shots, persists run and result, lists history. */
import { Inject, Injectable } from '@nestjs/common';
import type {
  ExperimentPlan,
  ExperimentResult,
  RunDetail,
  RunEstimate,
  RunProgress,
  RunSummary,
  StartRunRequest,
} from '@standard-model/contracts';
import { localizedText } from '@standard-model/contracts';
import { ExperimentRun, ExperimentTemplate, RunResult } from '@standard-model/contracts/db';
import { EXPERIMENT_TEMPLATES, estimateRun, runExperimentAsync } from '@standard-model/engine';
import type { Sequelize } from 'sequelize-typescript';
import { SEQUELIZE } from '../database/database.module.js';
import { badRequest, conflict, notFound, textOf } from '../http-errors.js';
import { compileOrBadRequest, TemplatesService } from '../templates/templates.service.js';

const MAX_SHOTS_PER_REQUEST = 200_000;
const DEFAULT_HISTORY_LIMIT = 50;

function toSummary(run: ExperimentRun): RunSummary {
  return {
    id: run.id,
    planName: run.plan.name,
    templateName: run.templateName,
    shots: run.shots,
    seed: run.seed,
    status: run.status,
    parameters: run.parameters,
    startedAt: run.startedAt?.toISOString() ?? null,
    finishedAt: run.finishedAt?.toISOString() ?? null,
    errorMessage: run.errorMessage,
    elapsedMilliseconds: run.elapsedMilliseconds,
  };
}

function toResult(
  run: ExperimentRun,
  result: RunResult | null | undefined,
): ExperimentResult | null {
  if (result === null || result === undefined) {
    return null;
  }
  return {
    planName: run.plan.name,
    shots: run.shots,
    seed: run.seed,
    parameters: run.parameters,
    reportValues: result.reportValues,
    outcomeCounts: result.outcomeCounts,
    distributions: result.distributions,
    systemReport: result.systemReport,
    systemReports: result.systemReports,
    elapsedMilliseconds: run.elapsedMilliseconds ?? 0,
    stepMeanMilliseconds: result.stepMeanMilliseconds,
    ...(run.status === 'stopped' ? { stopped: true } : {}),
  };
}

@Injectable()
export class RunsService {
  private readonly stopRequests = new Map<string, { requested: boolean }>();

  constructor(
    @Inject(SEQUELIZE) private readonly connection: Sequelize,
    @Inject(TemplatesService) private readonly templates: TemplatesService,
  ) {}

  async start(
    request: StartRunRequest,
    onProgress?: (progress: RunProgress) => void,
    onStarted?: (runId: string) => void,
  ): Promise<RunDetail> {
    const { plan, templateId } = await this.resolvePlan(request);
    const options = {
      ...(request.parameters === undefined ? {} : { parameters: request.parameters }),
      ...(request.shots === undefined ? {} : { shots: request.shots }),
      ...(request.seed === undefined ? {} : { seed: request.seed }),
    };
    const compiled = compileOrBadRequest(plan, options);
    if (compiled.shots > MAX_SHOTS_PER_REQUEST) {
      throw badRequest(
        localizedText(
          `за один запрос не больше ${String(MAX_SHOTS_PER_REQUEST)} выстрелов`,
          `shots must not exceed ${String(MAX_SHOTS_PER_REQUEST)} per request`,
        ),
      );
    }
    const run = await ExperimentRun.create({
      templateId,
      templateName: request.template ?? null,
      plan,
      parameters: compiled.parameters,
      shots: compiled.shots,
      seed: compiled.seed,
      status: 'running',
      startedAt: new Date(),
    });
    const stop = { requested: false };
    this.stopRequests.set(run.id, stop);
    onStarted?.(run.id);
    try {
      const result = await runExperimentAsync(plan, {
        ...options,
        ...(onProgress === undefined ? {} : { onProgress }),
        shouldStop: () => stop.requested,
      });
      const stored = await RunResult.create({
        runId: run.id,
        reportValues: result.reportValues,
        outcomeCounts: result.outcomeCounts,
        distributions: result.distributions,
        systemReport: result.systemReport,
        systemReports: [...(result.systemReports ?? [])],
        stepMeanMilliseconds: [...(result.stepMeanMilliseconds ?? [])],
      });
      await run.update({
        status: result.stopped === true ? 'stopped' : 'finished',
        shots: result.shots,
        finishedAt: new Date(),
        elapsedMilliseconds: result.elapsedMilliseconds,
      });
      const finished = toResult(run, stored);
      return {
        run: toSummary(run),
        result:
          finished === null || result.requestedShots === undefined
            ? finished
            : { ...finished, requestedShots: result.requestedShots },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await run.update({ status: 'failed', finishedAt: new Date(), errorMessage: message });
      const text = textOf(error);
      throw badRequest(localizedText(`прогон не удался: ${text.ru}`, `run failed: ${text.en}`));
    } finally {
      this.stopRequests.delete(run.id);
    }
  }

  stop(id: string): { readonly stopping: true } {
    const stop = this.stopRequests.get(id);
    if (stop === undefined) {
      throw conflict(
        localizedText(
          `прогон ${id} не идёт: он уже закончился или его нет`,
          `run ${id} is not running: it has finished or does not exist`,
        ),
      );
    }
    stop.requested = true;
    return { stopping: true };
  }

  async estimate(request: StartRunRequest): Promise<RunEstimate> {
    const { plan } = await this.resolvePlan(request);
    const options = {
      ...(request.parameters === undefined ? {} : { parameters: request.parameters }),
      ...(request.shots === undefined ? {} : { shots: request.shots }),
      ...(request.seed === undefined ? {} : { seed: request.seed }),
    };
    compileOrBadRequest(plan, options);
    try {
      return estimateRun(plan, options);
    } catch (error) {
      const text = textOf(error);
      throw badRequest(
        localizedText(`оценка не удалась: ${text.ru}`, `estimate failed: ${text.en}`),
      );
    }
  }

  async list(limit: number = DEFAULT_HISTORY_LIMIT): Promise<readonly RunSummary[]> {
    const runs = await ExperimentRun.findAll({ order: [['createdAt', 'DESC']], limit });
    return runs.map(toSummary);
  }

  async get(id: string): Promise<RunDetail> {
    const run = await ExperimentRun.findByPk(id, { include: [RunResult] });
    if (run === null) {
      throw notFound(localizedText(`Нет прогона ${id}`, `No run ${id}`));
    }
    return { run: toSummary(run), result: toResult(run, run.result) };
  }

  get database(): Sequelize {
    return this.connection;
  }

  private async resolvePlan(
    request: StartRunRequest,
  ): Promise<{ plan: ExperimentPlan; templateId: string | null }> {
    if (request.plan !== undefined) {
      return { plan: request.plan, templateId: null };
    }
    if (request.template === undefined) {
      throw badRequest(
        localizedText('Укажите имя шаблона или план', 'Provide either a template name or a plan'),
      );
    }
    const detail = await this.templates.get(request.template, request.language ?? 'ru');
    if (EXPERIMENT_TEMPLATES[request.template] !== undefined) {
      return { plan: detail.template, templateId: null };
    }
    const saved = await ExperimentTemplate.findOne({ where: { name: request.template } });
    return { plan: detail.template, templateId: saved?.id ?? null };
  }
}
