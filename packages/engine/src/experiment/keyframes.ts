/* Keyframes: what kind of target a watched quantity belongs to (the system, a particle, a medium), the simulated time of every keyframe from the evolve and propagate steps before it, and the
   summary over shots: the mean of each watched quantity at every keyframe that watches it with its standard error, and the paired change between consecutive keyframes watching the same one. */
import {
  KEYFRAME_COUNT_PREFIX,
  KEYFRAME_SYSTEM_TARGET,
  MEDIUM_KEYFRAME_QUANTITIES,
  PARTICLE_KEYFRAME_QUANTITIES,
  SYSTEM_KEYFRAME_QUANTITIES,
  keyframeRecord,
  type KeyframeChange,
  type KeyframeEstimate,
  type KeyframeSummary,
  type KeyframeWatch,
} from '@standard-model/contracts';
import type { CompiledStep } from './plan-compiler.js';
import type { ShotRecords } from './result-aggregator.js';

export type KeyframeTargetKind = 'system' | 'particle' | 'medium';

export function quantityFits(kind: KeyframeTargetKind, quantity: string): boolean {
  if (kind === 'system') {
    return (
      (SYSTEM_KEYFRAME_QUANTITIES as readonly string[]).includes(quantity) ||
      (quantity.startsWith(KEYFRAME_COUNT_PREFIX) && quantity.length > KEYFRAME_COUNT_PREFIX.length)
    );
  }
  return (kind === 'particle' ? PARTICLE_KEYFRAME_QUANTITIES : MEDIUM_KEYFRAME_QUANTITIES).some(
    (known) => known === quantity,
  );
}

export function targetKind(target: string, labels: ReadonlySet<string>): KeyframeTargetKind {
  if (target === KEYFRAME_SYSTEM_TARGET) {
    return 'system';
  }
  return labels.has(target) ? 'particle' : 'medium';
}

interface Moments {
  readonly count: number;
  readonly mean: number;
  readonly spread: number;
}

interface Frame {
  readonly name: string;
  readonly stepIndex: number;
  readonly timeInSeconds: number;
  readonly watch: readonly KeyframeWatch[];
}

function trackKey(watch: KeyframeWatch): string {
  return `${watch.target}\u0000${watch.quantity}`;
}

function estimate(moments: Moments | undefined): KeyframeEstimate | null {
  if (moments === undefined || moments.count === 0) {
    return null;
  }
  const variance = moments.count > 1 ? moments.spread / (moments.count - 1) : 0;
  return { mean: moments.mean, standardError: Math.sqrt(variance / moments.count) };
}

function added(moments: Moments | undefined, value: number): Moments {
  const current = moments ?? { count: 0, mean: 0, spread: 0 };
  const count = current.count + 1;
  const mean = current.mean + (value - current.mean) / count;
  return { count, mean, spread: current.spread + (value - current.mean) * (value - mean) };
}

export class KeyframeAggregator {
  private readonly frames: readonly Frame[];
  private readonly tracks: readonly KeyframeWatch[];
  private readonly values = new Map<string, Moments>();
  private readonly changes = new Map<string, Moments>();

  constructor(steps: readonly CompiledStep[]) {
    let timeInSeconds = 0;
    const frames: Frame[] = [];
    steps.forEach((step, stepIndex) => {
      if (step.operation === 'evolve' || step.operation === 'propagate') {
        timeInSeconds += Number(step.durationInSeconds);
      }
      if (step.operation === 'keyframe') {
        frames.push({ name: step.name, stepIndex, timeInSeconds, watch: step.watch });
      }
    });
    this.frames = frames;
    const tracks = new Map<string, KeyframeWatch>();
    frames.forEach((frame) => frame.watch.forEach((watch) => tracks.set(trackKey(watch), watch)));
    this.tracks = [...tracks.values()];
  }

  addShot(records: ShotRecords): void {
    this.tracks.forEach((track, trackIndex) => {
      const readings = this.frames.flatMap((frame, frameIndex) => {
        if (!frame.watch.some((watch) => trackKey(watch) === trackKey(track))) {
          return [];
        }
        const value = records.numeric.get(keyframeRecord(frame.name, track));
        return value === undefined || !Number.isFinite(value) ? [] : [{ frameIndex, value }];
      });
      readings.forEach(({ frameIndex, value }, position) => {
        const key = `${String(frameIndex)}|${String(trackIndex)}`;
        this.values.set(key, added(this.values.get(key), value));
        const next = readings[position + 1];
        if (next !== undefined) {
          const changeKey = `${String(trackIndex)}|${String(frameIndex)}|${String(next.frameIndex)}`;
          this.changes.set(changeKey, added(this.changes.get(changeKey), next.value - value));
        }
      });
    });
  }

  summary(): KeyframeSummary | undefined {
    if (this.frames.length === 0) {
      return undefined;
    }
    return {
      names: this.frames.map((frame) => frame.name),
      stepIndices: this.frames.map((frame) => frame.stepIndex),
      timesInSeconds: this.frames.map((frame) => frame.timeInSeconds),
      tracks: this.tracks.map((track, trackIndex) => ({
        target: track.target,
        quantity: track.quantity,
        values: this.frames.map((frame, frameIndex) =>
          estimate(this.values.get(`${String(frameIndex)}|${String(trackIndex)}`)),
        ),
        changes: [...this.changes.entries()]
          .flatMap(([key, moments]): KeyframeChange[] => {
            const [trackText = '', fromText = '', toText = ''] = key.split('|');
            const value = estimate(moments);
            return Number(trackText) === trackIndex && value !== null
              ? [{ ...value, from: Number(fromText), to: Number(toText) }]
              : [];
          })
          .sort((first, second) => first.from - second.from),
      })),
    };
  }
}
