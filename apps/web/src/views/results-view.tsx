/* ResultsView: while a run computes, the step diagram beside live progress (the first simulation being measured, then the remaining time and the simulation count); once done, the experiment with its parameters and steps on top, the result below, and a way back to the builder. */
import type { CatalogResponse, ExperimentPlan, RunProgress } from '@standard-model/contracts';
import { Square } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../api';
import { PlanSchema } from '../components/plan-schema';
import { PlanSummary } from '../components/plan-summary';
import { ResultView } from '../components/result-view';
import type { Draft } from '../drafts';
import { formatDuration } from '../format';
import { say } from '../language';
import { SmlIcon } from '../components/sml-icon';

interface Props {
  readonly draft: Draft | null;
  readonly onStop: () => void;
  readonly onEdit: () => void;
  readonly onCarryOver: (plan: ExperimentPlan) => void;
}

function RunStatus({ progress }: { readonly progress: RunProgress | null }) {
  if (progress === null || progress.phase === undefined || progress.phase === 'firstShot') {
    return <strong>{say('Измерение первой симуляции', 'Measuring the first simulation')}</strong>;
  }
  if (progress.phase === 'tracing') {
    return (
      <>
        <strong>{say('Трасса выстрела по шагам', 'Tracing one shot step by step')}</strong>
        <small className="muted">
          {say(
            `Все ${formatCount(progress.totalShots)} симуляций готовы`,
            `All ${formatCount(progress.totalShots)} simulations done`,
          )}
        </small>
      </>
    );
  }
  return (
    <>
      <span className="run-remaining">
        {say('Оставшееся время', 'Time remaining')}:{' '}
        <strong>{formatDuration(progress.remainingMilliseconds ?? 0)}</strong>
      </span>
      <span className="run-count">
        {say('Симуляция', 'Simulation')}: {formatCount(progress.completedShots)} /{' '}
        {formatCount(progress.totalShots)}
      </span>
      <progress
        className="run-progress"
        max={progress.totalShots}
        value={progress.completedShots}
      />
    </>
  );
}

function formatCount(value: number): string {
  return value.toLocaleString(say('ru-RU', 'en-US'));
}

function StopButton({
  canStop,
  stopping,
  onStop,
}: {
  readonly canStop: boolean;
  readonly stopping: boolean;
  readonly onStop: () => void;
}) {
  return (
    <div className="run-stop">
      <button
        type="button"
        className="secondary with-icon"
        disabled={!canStop || stopping}
        data-tooltip={say(
          'Остановить перед следующим выстрелом: результат соберётся из уже готовых выстрелов, трасса выстрела не строится',
          'Stop before the next shot: the result is built from the shots already done, no shot is traced',
        )}
        onClick={onStop}
      >
        <Square size={14} aria-hidden="true" />
        {stopping ? say('Останавливаю…', 'Stopping…') : say('Остановить', 'Stop')}
      </button>
      {stopping && (
        <small className="muted">
          {say('Дождусь конца текущего выстрела', 'Waiting for the current shot to end')}
        </small>
      )}
    </div>
  );
}

function Running({
  plan,
  progress,
  canStop,
  stopping,
  onStop,
}: {
  readonly plan: ExperimentPlan;
  readonly progress: RunProgress | null;
  readonly canStop: boolean;
  readonly stopping: boolean;
  readonly onStop: () => void;
}) {
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  useEffect(() => {
    api
      .catalog()
      .then(setCatalog)
      .catch(() => setCatalog(null));
  }, []);
  return (
    <div className="running">
      <section className="card">
        <span className="eyebrow">{say('Эксперимент', 'Experiment')}</span>
        <h2 className="summary-title">{plan.name}</h2>
        <div className="summary-schema">
          <PlanSchema
            plan={plan}
            particles={catalog?.particles ?? []}
            elements={catalog?.elements ?? []}
            molecules={catalog?.molecules}
          />
        </div>
      </section>
      <section className="card computing" role="status" aria-live="polite">
        <span className="spinner" aria-hidden="true" />
        <RunStatus progress={progress} />
        {progress?.phase !== 'tracing' && (
          <StopButton canStop={canStop} stopping={stopping} onStop={onStop} />
        )}
      </section>
    </div>
  );
}

export function ResultsView({ draft, onStop, onEdit, onCarryOver }: Props) {
  const busy = draft?.busy === true;
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [busy]);
  if (draft === null) {
    return (
      <p className="muted">
        {say(
          'Нет эксперимента. Соберите его в конструкторе и запустите.',
          'No experiment. Build one in the builder and run it.',
        )}
      </p>
    );
  }
  if (busy) {
    return (
      <Running
        plan={draft.plan}
        progress={draft.progress ?? null}
        canStop={draft.runId !== undefined && draft.runId !== null}
        stopping={draft.stopping === true}
        onStop={onStop}
      />
    );
  }
  return (
    <div className="results">
      <section className="card">
        <PlanSummary plan={draft.plan} />
        <div className="actions divided">
          <button
            type="button"
            className="primary with-icon"
            data-tooltip={say(
              'Вернуться в конструктор к этому эксперименту',
              'Back to the builder with this experiment',
            )}
            onClick={onEdit}
          >
            <SmlIcon name="builder" size={16} aria-hidden="true" />
            {say('Редактировать в конструкторе', 'Edit in the builder')}
          </button>
        </div>
      </section>
      {draft.error !== null && <p className="error">{draft.error}</p>}
      {draft.result !== null && (
        <ResultView result={draft.result} plan={draft.plan} onCarryOver={onCarryOver} />
      )}
      {draft.result === null && draft.error === null && (
        <p className="muted">
          {say('Эксперимент еще не запускался.', 'The experiment has not been run yet.')}
        </p>
      )}
    </div>
  );
}
