/* RunsView: recent runs from the API with their status, and the stored result of a selected run. */
import type { ExperimentPlan, RunDetail, RunSummary } from '@standard-model/contracts';
import { useEffect, useState } from 'react';
import { api } from '../api';
import { ResultView } from '../components/result-view';
import { formatMilliseconds } from '../format';
import { HINTS } from '../hints';
import { activeLanguage, bilingual, say } from '../language';

const RUN_STATUS = bilingual<string>({
  pending: ['в очереди', 'pending'],
  running: ['считается', 'running'],
  finished: ['готов', 'finished'],
  failed: ['ошибка', 'failed'],
  stopped: ['остановлен', 'stopped'],
});

export function RunsView({
  onCarryOver,
}: {
  readonly onCarryOver: (plan: ExperimentPlan) => void;
}) {
  const [runs, setRuns] = useState<readonly RunSummary[]>([]);
  const [selected, setSelected] = useState<RunDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .runs()
      .then((response) => setRuns(response.runs))
      .catch((failure: Error) => setError(failure.message));
  }, []);

  const open = (id: string): void => {
    api
      .run(id)
      .then(setSelected)
      .catch((failure: Error) => setError(failure.message));
  };

  return (
    <div className="two-columns">
      <aside className="card">
        <h2>{say('Прогоны', 'Runs')}</h2>
        {error !== null && <p className="error">{error}</p>}
        <ul className="list">
          {runs.map((run) => (
            <li key={run.id}>
              <button
                type="button"
                className={selected?.run.id === run.id ? 'list-item active' : 'list-item'}
                onClick={() => open(run.id)}
              >
                <strong>{run.planName}</strong>
                <small>
                  <span data-tooltip={HINTS.runStatus}>{RUN_STATUS[run.status] ?? run.status}</span>
                  {', '}
                  <span data-tooltip={HINTS.shots}>
                    {say('выстрелов', 'shots')} {run.shots}
                  </span>
                  {run.elapsedMilliseconds !== null && (
                    <span data-tooltip={HINTS.runElapsed}>
                      {', '}
                      {formatMilliseconds(run.elapsedMilliseconds)}
                    </span>
                  )}
                  {run.startedAt !== null && (
                    <span data-tooltip={HINTS.runStarted}>
                      {', '}
                      {new Date(run.startedAt).toLocaleString(activeLanguage())}
                    </span>
                  )}
                </small>
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <section>
        {selected === null && (
          <p className="muted">{say('Выберите прогон слева.', 'Pick a run on the left.')}</p>
        )}
        {selected !== null && selected.run.errorMessage !== null && (
          <p className="error">{selected.run.errorMessage}</p>
        )}
        {selected?.result !== null && selected?.result !== undefined && (
          <ResultView result={selected.result} onCarryOver={onCarryOver} />
        )}
      </section>
    </div>
  );
}
