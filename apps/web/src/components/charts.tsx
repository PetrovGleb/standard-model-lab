/* Charts for results: outcome bars and histograms with axis ticks, mean line and one-sigma band, drawn as plain SVG. */
import type { Distribution } from '@standard-model/contracts';
import { formatNumber, formatOutcome } from '../format';
import { HINTS } from '../hints';
import { say } from '../language';

const WIDTH = 640;
const HEIGHT = 240;
const MARGIN_LEFT = 44;
const MARGIN_RIGHT = 16;
const MARGIN_TOP = 16;
const MARGIN_BOTTOM = 40;
const TICK_COUNT = 5;

export function OutcomeBars({
  title,
  counts,
  shots,
}: {
  readonly title: string;
  readonly counts: Readonly<Record<string, number>>;
  readonly shots: number;
}) {
  const entries = Object.entries(counts).sort(([, first], [, second]) => second - first);
  const largest = Math.max(1, ...entries.map(([, count]) => count));
  return (
    <figure className="chart">
      <figcaption data-tooltip={HINTS.outcomeBars}>{title}</figcaption>
      <div className="outcome-bars">
        {entries.map(([outcome, count]) => (
          <div
            key={outcome}
            className="outcome-row"
            data-tooltip={`${outcome}: ${String(count)} ${say('из', 'of')} ${String(shots)}`}
          >
            <span className="outcome-label">{formatOutcome(outcome)}</span>
            <span className="outcome-track">
              <span
                className="outcome-fill"
                style={{ width: `${String((100 * count) / largest)}%` }}
              />
            </span>
            <span className="outcome-value">
              {(100 * (count / shots)).toFixed(count / shots < 0.01 ? 2 : 1)}%
            </span>
          </div>
        ))}
      </div>
    </figure>
  );
}

export function Histogram({
  title,
  distribution,
}: {
  readonly title: string;
  readonly distribution: Distribution;
}) {
  const { binEdges, counts } = distribution;
  const minimum = binEdges[0] ?? 0;
  const maximum = binEdges[binEdges.length - 1] ?? 1;
  const span = maximum - minimum || 1;
  const tallest = Math.max(1, ...counts);
  const plotWidth = WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
  const plotHeight = HEIGHT - MARGIN_TOP - MARGIN_BOTTOM;
  const xOf = (value: number): number => MARGIN_LEFT + ((value - minimum) / span) * plotWidth;
  const yOf = (count: number): number => MARGIN_TOP + plotHeight - (count / tallest) * plotHeight;
  const ticks = Array.from(
    { length: TICK_COUNT },
    (ignored, index) => minimum + (span * index) / (TICK_COUNT - 1),
  );
  const meanX = xOf(distribution.mean);
  const bandLeft = Math.max(MARGIN_LEFT, xOf(distribution.mean - distribution.standardDeviation));
  const bandRight = Math.min(
    WIDTH - MARGIN_RIGHT,
    xOf(distribution.mean + distribution.standardDeviation),
  );
  return (
    <figure className="chart">
      <figcaption>
        <span data-tooltip={HINTS.histogram}>{title}</span>
        <span className="chart-meta" data-tooltip={HINTS.chartMeta}>
          {say('среднее', 'mean')} {formatNumber(distribution.mean)}, σ{' '}
          {formatNumber(distribution.standardDeviation)}, N = {distribution.samples}
        </span>
      </figcaption>
      <svg
        className="histogram"
        viewBox={`0 0 ${String(WIDTH)} ${String(HEIGHT)}`}
        role="img"
        aria-label={`${say('Гистограмма', 'Histogram')}: ${title}, ${say('среднее', 'mean')} ${formatNumber(distribution.mean)}`}
      >
        <rect
          data-tooltip={HINTS.sigmaBand}
          className="sigma-band"
          x={bandLeft}
          y={MARGIN_TOP}
          width={Math.max(0, bandRight - bandLeft)}
          height={plotHeight}
        />
        {counts.map((count, bin) => {
          const left = xOf(binEdges[bin] ?? minimum);
          const right = xOf(binEdges[bin + 1] ?? maximum);
          return (
            <rect
              key={bin}
              data-tooltip={`${formatNumber(binEdges[bin] ?? minimum)} … ${formatNumber(binEdges[bin + 1] ?? maximum)}: ${String(count)} ${say('выстрелов', 'shots')}`}
              className="histogram-bar"
              x={left + 0.5}
              y={yOf(count)}
              width={Math.max(0.5, right - left - 1)}
              height={MARGIN_TOP + plotHeight - yOf(count)}
              rx={1.5}
            />
          );
        })}
        <line
          data-tooltip={HINTS.meanLine}
          className="mean-line"
          x1={meanX}
          x2={meanX}
          y1={MARGIN_TOP}
          y2={MARGIN_TOP + plotHeight}
        />
        <line
          className="axis-line"
          x1={MARGIN_LEFT}
          x2={WIDTH - MARGIN_RIGHT}
          y1={MARGIN_TOP + plotHeight}
          y2={MARGIN_TOP + plotHeight}
        />
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              className="tick"
              x1={xOf(tick)}
              x2={xOf(tick)}
              y1={MARGIN_TOP + plotHeight}
              y2={MARGIN_TOP + plotHeight + 5}
            />
            <text className="tick-label" x={xOf(tick)} y={HEIGHT - 16} textAnchor="middle">
              {formatNumber(tick)}
            </text>
          </g>
        ))}
        <text className="tick-label" x={MARGIN_LEFT - 8} y={MARGIN_TOP + 10} textAnchor="end">
          {tallest}
        </text>
        <text
          className="tick-label"
          x={MARGIN_LEFT - 8}
          y={MARGIN_TOP + plotHeight}
          textAnchor="end"
        >
          0
        </text>
      </svg>
    </figure>
  );
}
