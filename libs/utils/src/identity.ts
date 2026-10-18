/* Sequential id generator: one counter per prefix, so ids like electron-1, electron-2 are reproducible across runs. */
import type { IdGenerator } from '@standard-model/contracts';

export function createSequentialIdGenerator(): IdGenerator {
  const counters = new Map<string, number>();
  return {
    next(prefix: string): string {
      const count = (counters.get(prefix) ?? 0) + 1;
      counters.set(prefix, count);
      return `${prefix}-${String(count)}`;
    },
  };
}
