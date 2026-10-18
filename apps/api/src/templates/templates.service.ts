/* TemplatesService: built-in templates from the engine plus saved ones in Postgres; validation goes through the plan compiler. */
import { Inject, Injectable } from '@nestjs/common';
import {
  localizedText,
  type ExperimentPlan,
  type Language,
  type TemplateDetail,
  type TemplateSummary,
  type ValidatePlanResponse,
} from '@standard-model/contracts';
import { ExperimentTemplate } from '@standard-model/contracts/db';
import {
  compilePlan,
  EXPERIMENT_TEMPLATES,
  localizeTemplate,
  PlanCompilationError,
  templateComplexity,
} from '@standard-model/engine';
import { UniqueConstraintError } from 'sequelize';
import type { Sequelize } from 'sequelize-typescript';
import { SEQUELIZE } from '../database/database.module.js';
import { badRequest, conflict, notFound } from '../http-errors.js';

function complexityOf(name: string, source: TemplateSummary['source']) {
  const measured = source === 'builtIn' ? templateComplexity(name) : null;
  return measured === null ? {} : { complexity: measured };
}

function summarize(plan: ExperimentPlan, source: TemplateSummary['source']): TemplateSummary {
  return {
    name: plan.name,
    description: plan.description ?? null,
    source,
    categories: plan.categories ?? [],
    parameters: plan.parameters,
    shots: plan.shots,
    stepCount: plan.steps.length,
    ...complexityOf(plan.name, source),
  };
}

export function compileOrBadRequest(plan: unknown, options = {}): ReturnType<typeof compilePlan> {
  try {
    return compilePlan(plan, options);
  } catch (error) {
    if (error instanceof PlanCompilationError) {
      throw badRequest(error.text);
    }
    throw error;
  }
}

@Injectable()
export class TemplatesService {
  constructor(@Inject(SEQUELIZE) private readonly connection: Sequelize) {}

  async list(language: Language): Promise<readonly TemplateSummary[]> {
    const saved = await ExperimentTemplate.findAll({ order: [['createdAt', 'DESC']] });
    return [
      ...Object.values(EXPERIMENT_TEMPLATES).map((plan) =>
        summarize(localizeTemplate(plan, language), 'builtIn'),
      ),
      ...saved.map((row) => summarize(row.plan, 'saved')),
    ];
  }

  async get(name: string, language: Language): Promise<TemplateDetail> {
    const builtIn = EXPERIMENT_TEMPLATES[name];
    if (builtIn !== undefined) {
      return { template: localizeTemplate(builtIn, language), source: 'builtIn' };
    }
    const saved = await ExperimentTemplate.findOne({ where: { name } });
    if (saved === null) {
      throw notFound(localizedText(`Нет шаблона ${name}`, `No template named ${name}`));
    }
    return { template: saved.plan, source: 'saved' };
  }

  async save(plan: unknown): Promise<TemplateDetail> {
    const compiled = compileOrBadRequest(plan);
    if (EXPERIMENT_TEMPLATES[compiled.name] !== undefined) {
      throw conflict(
        localizedText(
          `${compiled.name} — встроенный шаблон`,
          `${compiled.name} is a built-in template`,
        ),
      );
    }
    const validPlan = plan as ExperimentPlan;
    try {
      const row = await ExperimentTemplate.create({
        name: compiled.name,
        description: validPlan.description ?? null,
        plan: validPlan,
      });
      return { template: row.plan, source: 'saved' };
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        throw conflict(
          localizedText(
            `Шаблон ${compiled.name} уже есть`,
            `A template named ${compiled.name} already exists`,
          ),
        );
      }
      throw error;
    }
  }

  async remove(name: string): Promise<void> {
    const deleted = await ExperimentTemplate.destroy({ where: { name } });
    if (deleted === 0) {
      throw notFound(
        localizedText(`Нет сохраненного шаблона ${name}`, `No saved template named ${name}`),
      );
    }
  }

  validate(plan: unknown): ValidatePlanResponse {
    try {
      compilePlan(plan);
      return { valid: true, errors: [] };
    } catch (error) {
      if (error instanceof PlanCompilationError) {
        return { valid: false, errors: [error.text] };
      }
      throw error;
    }
  }

  get database(): Sequelize {
    return this.connection;
  }
}
