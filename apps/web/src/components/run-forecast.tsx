/* RunForecast: a short pilot run on the server times the plan and forecasts the whole run, shots plus the traced shots, and the share of time each step takes; the forecast clears when the plan changes. */
import type { ExperimentPlan, RunEstimate } from '@standard-model/contracts';
import { useEffect, useState } from 'react';
import { api } from '../api';
import { formatMilliseconds } from '../format';
import { HINTS } from '../hints';
import { say } from '../language';

export function stepShares(milliseconds: readonly number[] | undefined): readonly number[] {
  const total = (milliseconds ?? []).reduce((sum, value) => sum + value, 0);
  return (milliseconds ?? []).map((value) => (total > 0 ? value / total : 0));
}

export function RunForecast({
  plan,
  onEstimate,
}: {
  readonly plan: ExperimentPlan;
  readonly onEstimate: (estimate: RunEstimate | null) => void;
}) {
  const [estimate, setEstimate] = useState<RunEstimate | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const signature = JSON.stringify(plan);
  useEffect(() => {
    setEstimate(null);
    setError(null);
    onEstimate(null);
  }, [signature]);
  const run = (): void => {
    setBusy(true);
    setError(null);
    api
      .estimateRun({ plan })
      .then((result) => {
        setEstimate(result);
        onEstimate(result);
      })
      .catch((failure: Error) => setError(failure.message))
      .finally(() => setBusy(false));
  };
  return (
    <div className="run-forecast">
      {estimate === null ? (
        <button
          type="button"
          className="secondary"
          onClick={run}
          disabled={busy}
          data-tooltip={say(
            'Короткий пробный прогон на сервере: сколько длится один выстрел, сколько займет весь эксперимент и какие шаги тяжелее',
            'A short pilot run on the server: how long one shot takes, how long the whole experiment will take and which steps are heavier',
          )}
        >
          {busy
            ? say('Оцениваю…', 'Estimating…')
            : say('Оценить длительность', 'Estimate the duration')}
        </button>
      ) : (
        <div className="forecast-figures">
          <span className="forecast-total" data-tooltip={HINTS.forecastTotal}>
            {say('Займет около', 'Will take about')}{' '}
            <strong>{formatMilliseconds(estimate.predictedMilliseconds)}</strong>
          </span>
          <span className="muted" data-tooltip={HINTS.forecastDetail}>
            {say(
              `${formatMilliseconds(estimate.meanShotMilliseconds)} на выстрел, ${String(plan.shots)} выстрелов и трасса · по ${String(estimate.pilotShots)} пробным`,
              `${formatMilliseconds(estimate.meanShotMilliseconds)} per shot, ${String(plan.shots)} shots and the trace · from ${String(estimate.pilotShots)} pilot shots`,
            )}
          </span>
        </div>
      )}
      {error !== null && <p className="error">{error}</p>}
    </div>
  );
}
