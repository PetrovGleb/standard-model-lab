/* PlanSummary: read-only view of a plan in the builder's design language: on two thirds the eyebrow and title, description, run settings, parameters with their units and the steps that use them,
   the steps and report as text; on the last third the schema on its pan-and-zoom canvas. */
import type { CatalogResponse, ExperimentPlan } from '@standard-model/contracts';
import { useEffect, useState } from 'react';
import { api } from '../api';
import { formatNumber } from '../format';
import { PARAMETER_GLOSSARY, STATISTIC_GLOSSARY } from '../glossary';
import { HINTS } from '../hints';
import { describeStep, parameterUsage } from '../plan-edits';
import { unitOfParameter } from '../presets';
import { PlanSchema } from './plan-schema';
import { say } from '../language';

export function PlanSummary({ plan }: { readonly plan: ExperimentPlan }) {
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  useEffect(() => {
    api
      .catalog()
      .then(setCatalog)
      .catch(() => setCatalog(null));
  }, []);
  const parameters = Object.entries(plan.parameters);
  const usage = parameterUsage(plan);
  return (
    <div className="summary">
      <div className="summary-main">
        <span className="eyebrow">{say('Эксперимент', 'Experiment')}</span>
        <h2 className="summary-title">{plan.name}</h2>
        {plan.description !== undefined && plan.description !== '' && (
          <p className="summary-description">{plan.description}</p>
        )}
        <div className="summary-meta">
          <span className="tag" data-tooltip={HINTS.shots}>
            {say('выстрелов', 'shots')} {formatNumber(plan.shots)}
          </span>
          <span className="tag" data-tooltip={HINTS.seed}>
            seed {plan.seed ?? 1}
          </span>
          <span className="tag" data-tooltip={HINTS.stepCount}>
            {say('шагов', 'steps')} {plan.steps.length}
          </span>
        </div>
        {parameters.length > 0 && (
          <div className="parameter-table compact">
            {parameters.map(([name, value]) => (
              <div key={name} className="parameter-row">
                <span
                  className="parameter-name"
                  data-tooltip={PARAMETER_GLOSSARY[name] ?? HINTS.parameter}
                >
                  <span>{name}</span>
                </span>
                <span className="parameter-value">
                  {formatNumber(value)} <span className="value-unit">{unitOfParameter(name)}</span>
                </span>
                <span className="parameter-usage" data-tooltip={HINTS.parameterUsage}>
                  {(usage.get(name) ?? []).map((index) => (
                    <span
                      key={index}
                      className="tag"
                      data-tooltip={
                        plan.steps[index] === undefined ? '' : describeStep(plan.steps[index])
                      }
                    >
                      {say('шаг', 'step')} {index + 1}
                    </span>
                  ))}
                </span>
              </div>
            ))}
          </div>
        )}
        <details>
          <summary>{say('Шаги текстом', 'Steps as text')}</summary>
          <ol className="steps">
            {plan.steps.map((step, index) => (
              <li key={index}>{describeStep(step)}</li>
            ))}
          </ol>
        </details>
        {plan.report.length > 0 && (
          <p className="muted summary-report">
            <span data-tooltip={HINTS.reportLine}>{say('Отчет', 'Report')}</span>:{' '}
            {plan.report.map((report, index) => (
              <span key={index} data-tooltip={STATISTIC_GLOSSARY[report.statistic]}>
                {index > 0 && '; '}
                {`${report.statistic}(${report.records.join(', ')})`}
              </span>
            ))}
          </p>
        )}
      </div>
      {plan.steps.length > 0 && (
        <div className="summary-schema">
          <PlanSchema
            plan={plan}
            particles={catalog?.particles ?? []}
            elements={catalog?.elements ?? []}
            molecules={catalog?.molecules}
          />
        </div>
      )}
    </div>
  );
}
