/* ResultView: key numbers as tiles, how long the run took and the share of each step in a shot, the keyframe table, outcome frequencies as bars, numeric records as histograms (records about single particles
   behind a toggle, since a chain reaction makes thousands), the system report player and a hand-off of the final system to a new experiment. */
import type { ExperimentPlan, ExperimentResult } from '@standard-model/contracts';
import { useState, type CSSProperties } from 'react';
import { carryOverPlan } from '../carry-over';
import { formatMilliseconds, formatNumber } from '../format';
import { OPERATION_TITLES } from '../glossary';
import { HINTS } from '../hints';
import { stepShares } from './run-forecast';
import { Histogram, OutcomeBars } from './charts';
import { FormulaPanel } from './formula-panel';
import { KeyframeTable } from './keyframe-table';
import { SystemPlayer } from './system-player';
import { say } from '../language';

const FREQUENCY_KEY = /\[[^\]]*\]$/;
const MINIMUM_SHARE_SHOWN = 0.01;
const PARTICLE_RECORD = /^[^.]+\.(?!count\.|medium\.|body\d+\.)[^.]+\.[^.]+$/;
const PERCENT = 100;

interface Props {
  readonly result: ExperimentResult;
  readonly plan?: ExperimentPlan;
  readonly onCarryOver: (plan: ExperimentPlan) => void;
}

function stepTitle(plan: ExperimentPlan | undefined, index: number): string {
  const step = plan?.steps[index];
  const number = String(index + 1);
  return step === undefined
    ? say(`шаг ${number}`, `step ${number}`)
    : `${number}. ${OPERATION_TITLES[step.operation] ?? step.operation}`;
}

function TimeBreakdown({
  result,
  plan,
}: {
  readonly result: ExperimentResult;
  readonly plan: ExperimentPlan | undefined;
}) {
  const shares = stepShares(result.stepMeanMilliseconds)
    .map((share, index) => ({ share, index }))
    .filter((entry) => entry.share >= MINIMUM_SHARE_SHOWN)
    .sort((left, right) => right.share - left.share);
  if (shares.length === 0) {
    return null;
  }
  const perShot = (result.stepMeanMilliseconds ?? []).reduce((sum, value) => sum + value, 0);
  return (
    <div className="time-breakdown">
      <span className="muted" data-tooltip={HINTS.shotTime}>
        {say('Выстрел', 'A shot')} ≈ {formatMilliseconds(perShot)} ·{' '}
        {say('время по шагам:', 'time by step:')}
      </span>
      {shares.map(({ share, index }) => (
        <span
          key={index}
          className="time-share"
          data-tooltip={HINTS.timeShare}
          style={{ '--share': `${String(share * PERCENT)}%` } as CSSProperties}
        >
          {stepTitle(plan, index)}
          <strong>{Math.round(share * PERCENT)}%</strong>
        </span>
      ))}
    </div>
  );
}

export function ResultView({ result, plan, onCarryOver }: Props) {
  const reports =
    result.systemReports !== undefined && result.systemReports.length > 0
      ? result.systemReports
      : result.systemReport === null || result.systemReport === undefined
        ? []
        : [result.systemReport];
  const [traceIndex, setTraceIndex] = useState(0);
  const [showParticleRecords, setShowParticleRecords] = useState(false);
  const report = reports[Math.min(traceIndex, reports.length - 1)];
  const survivors =
    report?.frames[report.frames.length - 1]?.particles.filter(
      (particle) => particle.status === 'alive',
    ).length ?? 0;
  const scalars = Object.entries(result.reportValues).filter(
    ([label]) => !FREQUENCY_KEY.test(label) && result.distributions[label] === undefined,
  );
  const allRecords = Object.entries(result.outcomeCounts);
  const particleRecords = allRecords.filter(([record]) => PARTICLE_RECORD.test(record));
  const records = allRecords.filter(([record]) => !PARTICLE_RECORD.test(record));
  const allDistributions = Object.entries(result.distributions ?? {});
  const particleDistributions = allDistributions.filter(([label]) => PARTICLE_RECORD.test(label));
  const distributions = allDistributions.filter(([label]) => !PARTICLE_RECORD.test(label));
  const particleCount = particleRecords.length + particleDistributions.length;
  return (
    <>
      <section className="card">
        <div className="section-head">
          <h3>{say('Результат', 'Result')}</h3>
          <span className="kicker" data-tooltip={HINTS.resultKicker}>
            {result.shots} {say('выстрелов', 'shots')} · seed {result.seed} ·{' '}
            {say('заняло', 'took')} {formatMilliseconds(result.elapsedMilliseconds)}
          </span>
        </div>
        {result.stopped === true && (
          <p className="run-stopped-note">
            {result.requestedShots === undefined
              ? say(
                  `Прогон остановлен: статистика по ${String(result.shots)} готовым выстрелам, трасса выстрела не строилась.`,
                  `The run was stopped: statistics over ${String(result.shots)} finished shots, no shot was traced.`,
                )
              : say(
                  `Прогон остановлен после ${String(result.shots)} из ${String(result.requestedShots)} выстрелов: статистика по готовым, трасса выстрела не строилась.`,
                  `The run was stopped after ${String(result.shots)} of ${String(result.requestedShots)} shots: statistics over the finished ones, no shot was traced.`,
                )}
          </p>
        )}
        <TimeBreakdown result={result} plan={plan} />
        {result.keyframes !== undefined && <KeyframeTable keyframes={result.keyframes} />}
        {scalars.length > 0 && (
          <div className="tiles">
            {scalars.map(([label, value]) => (
              <div key={label} className="tile" data-tooltip={`${HINTS.scalarTile}: ${label}`}>
                <span className="tile-label">{label}</span>
                <span className="tile-value">{formatNumber(value)}</span>
              </div>
            ))}
          </div>
        )}
        <div className="charts">
          {distributions.map(([label, distribution]) => (
            <Histogram key={label} title={label} distribution={distribution} />
          ))}
          {records.map(([record, counts]) => (
            <OutcomeBars key={record} title={record} counts={counts} shots={result.shots} />
          ))}
          {showParticleRecords &&
            particleDistributions.map(([label, distribution]) => (
              <Histogram key={label} title={label} distribution={distribution} />
            ))}
          {showParticleRecords &&
            particleRecords.map(([record, counts]) => (
              <OutcomeBars key={record} title={record} counts={counts} shots={result.shots} />
            ))}
        </div>
        {particleCount > 0 && (
          <button
            type="button"
            className="secondary"
            data-tooltip={say(
              'Записи о каждой отдельной частице в каждом замере системы, например ее фаза',
              'Records about every single particle in every system snapshot, such as its phase',
            )}
            onClick={() => setShowParticleRecords((current) => !current)}
          >
            {showParticleRecords
              ? say('Скрыть записи по частицам', 'Hide the records by particle')
              : say(
                  `Показать записи по частицам (${String(particleCount)})`,
                  `Show the records by particle (${String(particleCount)})`,
                )}
          </button>
        )}
        {scalars.length === 0 && allDistributions.length === 0 && allRecords.length === 0 && (
          <p className="muted">{say('В отчете нет статистик.', 'The report has no statistics.')}</p>
        )}
      </section>
      {report !== undefined && (
        <SystemPlayer
          reports={reports}
          selected={Math.min(traceIndex, reports.length - 1)}
          onSelect={setTraceIndex}
          onCarryOver={
            survivors > 0 ? () => onCarryOver(carryOverPlan(report, result.planName)) : undefined
          }
        />
      )}
      <FormulaPanel result={result} />
    </>
  );
}
