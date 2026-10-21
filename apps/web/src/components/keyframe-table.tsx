/* KeyframeTable: every watched quantity as a row and every keyframe as a column with its simulated time; a cell holds the mean over shots with its standard error and, from the keyframe
   before that watched the same quantity, the change and its rate per second (power for absorbed energy, heating rate for temperature). */
import type { KeyframeChange, KeyframeEstimate, KeyframeSummary } from '@standard-model/contracts';
import { formatNumber, formatTimeInSeconds } from '../format';
import { keyframeQuantityLabel, keyframeRateLabel } from '../glossary';
import { say } from '../language';

interface Props {
  readonly keyframes: KeyframeSummary;
}

const identity = (name: string): string => name;

function estimateText(estimate: KeyframeEstimate): string {
  return estimate.standardError > 0
    ? `${formatNumber(estimate.mean)} ± ${formatNumber(estimate.standardError)}`
    : formatNumber(estimate.mean);
}

function signed(value: number): string {
  return value > 0 ? `+${formatNumber(value)}` : formatNumber(value);
}

function ChangeLine({
  change,
  quantity,
  timesInSeconds,
}: {
  readonly change: KeyframeChange;
  readonly quantity: string;
  readonly timesInSeconds: readonly number[];
}) {
  const interval = (timesInSeconds[change.to] ?? 0) - (timesInSeconds[change.from] ?? 0);
  return (
    <span className="keyframe-change">
      Δ {signed(change.mean)}
      {interval > 0 && (
        <span
          className="keyframe-rate"
          data-tooltip={say(
            `Изменение, деленное на время между кадрами, ${formatTimeInSeconds(interval)}`,
            `The change divided by the time between the keyframes, ${formatTimeInSeconds(interval)}`,
          )}
        >
          {' · '}
          {keyframeRateLabel(quantity, identity)} {signed(change.mean / interval)}
        </span>
      )}
    </span>
  );
}

export function KeyframeTable({ keyframes }: Props) {
  return (
    <div className="keyframe-table">
      <h4>{say('Ключевые кадры', 'Keyframes')}</h4>
      <div className="keyframe-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>{say('Величина', 'Quantity')}</th>
              {keyframes.names.map((name, index) => (
                <th key={name}>
                  {name}
                  <span className="keyframe-time">
                    {' '}
                    t = {formatTimeInSeconds(keyframes.timesInSeconds[index] ?? 0)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {keyframes.tracks.map((track) => (
              <tr key={`${track.target}.${track.quantity}`}>
                <td>
                  <b>{track.target}</b> · {keyframeQuantityLabel(track.quantity, identity)}
                </td>
                {track.values.map((value, index) => {
                  const change = track.changes.find((candidate) => candidate.to === index);
                  return (
                    <td key={index} className="mono">
                      {value === null ? '—' : estimateText(value)}
                      {change !== undefined && (
                        <ChangeLine
                          change={change}
                          quantity={track.quantity}
                          timesInSeconds={keyframes.timesInSeconds}
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
