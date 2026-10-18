/* ResultAggregator: accumulates per-shot records into outcome counts, report statistics (frequency, mean, spread, correlations, CHSH) and histograms. */
import type {
  Distribution,
  Distributions,
  OutcomeCounts,
  ReportSpec,
  ReportValues,
} from '@standard-model/contracts';

export interface ShotRecords {
  readonly numeric: ReadonlyMap<string, number>;
  readonly categorical: ReadonlyMap<string, string>;
}

const CHSH_SIGNS = [1, -1, 1, 1] as const;
const DEFAULT_BINS = 40;

function reportLabel(spec: ReportSpec): string {
  return spec.label ?? `${spec.statistic}(${spec.records.join(',')})`;
}

export class ResultAggregator {
  private readonly counts = new Map<string, Map<string, number>>();
  private readonly sums = new Map<string, number>();
  private readonly sampleCounts = new Map<string, number>();
  private readonly squareSums = new Map<string, number>();
  private readonly samples = new Map<string, number[]>();
  private shots = 0;

  constructor(private readonly report: readonly ReportSpec[]) {}

  addShot(records: ShotRecords): void {
    this.shots += 1;
    records.categorical.forEach((outcome, record) => {
      const perRecord = this.counts.get(record) ?? new Map<string, number>();
      perRecord.set(outcome, (perRecord.get(outcome) ?? 0) + 1);
      this.counts.set(record, perRecord);
    });
    this.report.forEach((spec) => {
      if (spec.when !== undefined && records.numeric.get(spec.when.record) !== spec.when.equals) {
        return;
      }
      const label = reportLabel(spec);
      const value = this.shotValue(spec, records);
      if (value === null) {
        return;
      }
      this.sums.set(label, (this.sums.get(label) ?? 0) + value);
      this.squareSums.set(label, (this.squareSums.get(label) ?? 0) + value * value);
      this.sampleCounts.set(label, (this.sampleCounts.get(label) ?? 0) + 1);
      if (spec.statistic === 'histogram') {
        const list = this.samples.get(label) ?? [];
        list.push(value);
        this.samples.set(label, list);
      }
    });
  }

  reportValues(): ReportValues {
    const values: Record<string, number | null> = {};
    this.report.forEach((spec) => {
      const label = reportLabel(spec);
      if (spec.statistic === 'frequency') {
        spec.records.forEach((record) => {
          const perRecord = this.counts.get(record) ?? new Map<string, number>();
          perRecord.forEach((count, outcome) => {
            values[`${label}[${outcome}]`] = count / this.shots;
          });
        });
        return;
      }
      const samples = this.sampleCounts.get(label) ?? 0;
      if (samples === 0) {
        values[label] = null;
        return;
      }
      const mean = (this.sums.get(label) ?? 0) / samples;
      if (spec.statistic === 'standardDeviation') {
        values[label] = this.standardDeviation(label, mean, samples);
        return;
      }
      values[label] = mean;
    });
    return values;
  }

  distributions(): Distributions {
    const result: Record<string, Distribution> = {};
    this.report.forEach((spec) => {
      if (spec.statistic !== 'histogram') {
        return;
      }
      const label = reportLabel(spec);
      const list = this.samples.get(label) ?? [];
      if (list.length === 0) {
        return;
      }
      const bins = spec.bins ?? DEFAULT_BINS;
      let minimum = Infinity;
      let maximum = -Infinity;
      list.forEach((value) => {
        minimum = Math.min(minimum, value);
        maximum = Math.max(maximum, value);
      });
      if (minimum === maximum) {
        maximum = minimum + Math.max(Math.abs(minimum) * 1e-6, 1e-12);
      }
      const width = (maximum - minimum) / bins;
      const counts = new Array<number>(bins).fill(0);
      list.forEach((value) => {
        const bin = Math.min(bins - 1, Math.floor((value - minimum) / width));
        counts[bin] = (counts[bin] ?? 0) + 1;
      });
      const mean = (this.sums.get(label) ?? 0) / list.length;
      result[label] = {
        record: spec.records[0] ?? '',
        binEdges: Array.from({ length: bins + 1 }, (ignored, edge) => minimum + edge * width),
        counts,
        samples: list.length,
        mean,
        standardDeviation: this.standardDeviation(label, mean, list.length),
      };
    });
    return result;
  }

  private standardDeviation(label: string, mean: number, samples: number): number {
    const variance = (this.squareSums.get(label) ?? 0) / samples - mean * mean;
    return Math.sqrt(Math.max(variance, 0));
  }

  outcomeCounts(): OutcomeCounts {
    const counts: Record<string, Record<string, number>> = {};
    this.counts.forEach((perRecord, record) => {
      counts[record] = Object.fromEntries(perRecord);
    });
    return counts;
  }

  private shotValue(spec: ReportSpec, records: ShotRecords): number | null {
    const numbers = spec.records.map((record) => records.numeric.get(record));
    if (numbers.some((value) => value === undefined || !Number.isFinite(value))) {
      return null;
    }
    const values = numbers as number[];
    switch (spec.statistic) {
      case 'frequency':
        return null;
      case 'mean':
      case 'histogram':
      case 'standardDeviation':
        return values[0] ?? null;
      case 'probabilitySameSign':
        return Math.sign(values[0] ?? 0) * Math.sign(values[1] ?? 0) > 0 ? 1 : 0;
      case 'correlation':
        return Math.sign(values[0] ?? 0) * Math.sign(values[1] ?? 0);
      case 'chsh':
        return CHSH_SIGNS.reduce(
          (sum, sign, pair) =>
            sum + sign * Math.sign(values[2 * pair] ?? 0) * Math.sign(values[2 * pair + 1] ?? 0),
          0,
        );
    }
  }
}
