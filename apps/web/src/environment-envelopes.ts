/* Environment envelopes on the system stage: one envelope per environment aspect, shared or for a region, nested by inclusion of the particles they act on and, for the same particles, by
   the order they were set (the earlier one outside); an order that keeps members side by side, and the runs an envelope is cut into where its members cannot be neighbours.
   Equal parameters share one badge across the whole report. */
import type { SystemFrame } from '@standard-model/contracts';

const HIDDEN_ASPECTS: ReadonlySet<string> = new Set(['neighbors']);

export interface EnvelopeAspect {
  readonly aspect: string;
  readonly value: unknown;
  readonly signature: string;
}

export interface Envelope {
  readonly key: string;
  readonly members: readonly string[];
  readonly aspects: readonly EnvelopeAspect[];
  readonly shared: boolean;
  readonly depth: number;
}

export interface EnvelopeRun {
  readonly envelope: Envelope;
  readonly members: readonly string[];
  readonly first: number;
  readonly last: number;
}

export function aspectSignature(aspect: string, value: unknown): string {
  return `${aspect}:${JSON.stringify(value)}`;
}

function aliveLabels(frame: SystemFrame): readonly string[] {
  return frame.particles
    .filter((particle) => particle.status === 'alive')
    .map((particle) => particle.label);
}

interface EnvelopeItem {
  members: readonly string[];
  aspect: string;
  value: unknown;
  readonly rank: number;
}

export function frameEnvelopes(frame: SystemFrame): readonly Envelope[] {
  const alive = aliveLabels(frame);
  const everyone = [...alive].sort().join('|');
  const keyOf = (members: readonly string[]): string => [...members].sort().join('|');
  const order = frame.environmentOrder ?? Object.keys(frame.environment);
  const items: EnvelopeItem[] = Object.entries(frame.environment)
    .filter(([aspect]) => !HIDDEN_ASPECTS.has(aspect))
    .map(([aspect, value]) => ({
      members: alive,
      aspect,
      value,
      rank: order.includes(aspect) ? order.indexOf(aspect) : order.length,
    }));
  const sharedCount = items.length;
  [...(frame.regions ?? [])]
    .filter((region) => !HIDDEN_ASPECTS.has(region.aspect))
    .sort((first, second) => first.id - second.id)
    .forEach((region, position) => {
      const members = region.members.filter((label) => alive.includes(label));
      if (members.length === 0) {
        return;
      }
      const same = items.find(
        (item) => item.aspect === region.aspect && keyOf(item.members) === keyOf(members),
      );
      if (same === undefined) {
        items.push({
          members,
          aspect: region.aspect,
          value: region.value,
          rank: sharedCount + position,
        });
      } else {
        same.value = region.value;
      }
    });
  const contains = (outer: EnvelopeItem, inner: EnvelopeItem): boolean =>
    outer !== inner &&
    inner.members.every((label) => outer.members.includes(label)) &&
    (inner.members.length < outer.members.length || outer.rank < inner.rank);
  const depthOf = (item: EnvelopeItem): number => {
    const inner = items.filter((other) => contains(item, other));
    return inner.length === 0 ? 0 : 1 + Math.max(...inner.map(depthOf));
  };
  return items
    .map((item) => ({
      key: `${keyOf(item.members)}#${item.aspect}`,
      members: item.members,
      aspects: [
        {
          aspect: item.aspect,
          value: item.value,
          signature: aspectSignature(item.aspect, item.value),
        },
      ],
      shared: keyOf(item.members) === everyone,
      depth: depthOf(item),
      rank: item.rank,
    }))
    .sort(
      (first, second) => second.members.length - first.members.length || first.rank - second.rank,
    )
    .map(({ rank, ...envelope }) => {
      void rank;
      return envelope;
    });
}

export function envelopeOrder(
  labels: readonly string[],
  envelopes: readonly Envelope[],
): readonly string[] {
  const path = (label: string): readonly number[] =>
    envelopes.flatMap((envelope, index) => (envelope.members.includes(label) ? [index] : []));
  const compare = (first: readonly number[], second: readonly number[]): number => {
    for (let position = 0; position < Math.max(first.length, second.length); position += 1) {
      const left = first[position];
      const right = second[position];
      if (left !== right) {
        return left === undefined ? -1 : right === undefined ? 1 : left - right;
      }
    }
    return 0;
  };
  return [...labels].sort(
    (first, second) =>
      compare(path(first), path(second)) || labels.indexOf(first) - labels.indexOf(second),
  );
}

export function envelopeRuns(
  order: readonly string[],
  envelopes: readonly Envelope[],
): readonly EnvelopeRun[] {
  return envelopes.flatMap((envelope) => {
    const runs: EnvelopeRun[] = [];
    order.forEach((label, position) => {
      if (!envelope.members.includes(label)) {
        return;
      }
      const last = runs[runs.length - 1];
      if (last !== undefined && last.last === position - 1) {
        runs[runs.length - 1] = { ...last, members: [...last.members, label], last: position };
      } else {
        runs.push({ envelope, members: [label], first: position, last: position });
      }
    });
    return runs;
  });
}

export function environmentBadges(frames: readonly SystemFrame[]): ReadonlyMap<string, number> {
  const runsOf = new Map<string, number>();
  frames.forEach((frame) => {
    const envelopes = frameEnvelopes(frame);
    const order = envelopeOrder(aliveLabels(frame), envelopes);
    const counts = new Map<string, number>();
    envelopeRuns(order, envelopes).forEach((run) =>
      run.envelope.aspects.forEach((aspect) =>
        counts.set(aspect.signature, (counts.get(aspect.signature) ?? 0) + 1),
      ),
    );
    counts.forEach((count, signature) =>
      runsOf.set(signature, Math.max(runsOf.get(signature) ?? 0, count)),
    );
  });
  const badges = new Map<string, number>();
  runsOf.forEach((count, signature) => {
    if (count > 1) {
      badges.set(signature, badges.size + 1);
    }
  });
  return badges;
}
