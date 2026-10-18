/* System stage layout and camera: particles in the same state fold into one group node (expandable), nodes sit in rows of at most six, a new environment starts a new row, neighbours never
   closer than both safe zones, envelopes span the rows of their members; who merged, collided or decayed, node sizes, envelope margins, and zooming the view about a point. */
import type { LocalizedText, ParticleView, SystemFrame } from '@standard-model/contracts';
import {
  envelopeOrder,
  envelopeRuns,
  frameEnvelopes,
  type Envelope,
  type EnvelopeRun,
} from './environment-envelopes';

export interface StageNode {
  readonly key: string;
  readonly label: string;
  readonly members: readonly string[];
  readonly group?: string;
  readonly bundle: string;
  readonly view: ParticleView;
  readonly x: number;
  readonly y: number;
  readonly opacity: number;
  readonly scale: number;
  readonly leaving: boolean;
}

export interface StageLayoutOptions {
  readonly centerY?: number;
  readonly expanded?: ReadonlySet<string>;
}

export const ROW_SIZE = 6;
const ROW_HEIGHT = 170;
const GROUP_MINIMUM = 2;
const SIGNATURE_DIGITS = 4;

export interface StageView {
  readonly zoom: number;
  readonly panX: number;
  readonly panY: number;
}

export interface StageViewport {
  readonly width: number;
  readonly height: number;
  readonly minimumZoom: number;
  readonly maximumZoom: number;
}

const ELECTRON_MASS_IN_MEV_SCALE = 1e3;
const HALO_GAP = 6;
const LABEL_CHARACTER_WIDTH = 7.2;
const SAFE_GAP = 28;
const CENTER_FRACTION = 0.5;
const ENVELOPE_MARGIN = 12;
export const ENVELOPE_NEST_GAP = 26;
const NEIGHBOUR_ENVELOPE_GAP = 10;

export const ENVELOPE_RISE = 90;
export const ENVELOPE_DROP = 88;
const EMPTY_ENVELOPE_HALF_WIDTH = 180;
const SHARED_ENVELOPE_INSET = 40;
const REGION_ENVELOPE_MIN_WIDTH = 320;

export function envelopeMargin(depth: number): number {
  return ENVELOPE_MARGIN + ENVELOPE_NEST_GAP * depth;
}

export interface EnvelopeBox {
  readonly run: EnvelopeRun;
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

export function envelopeBoxes(
  frame: SystemFrame,
  nodes: readonly StageNode[],
  nodeY: number,
  centerX: number,
  stageWidth: number,
): readonly EnvelopeBox[] {
  const envelopes = frameEnvelopes(frame);
  const live = nodes.filter((node) => !node.leaving);
  const vertical = (depth: number, heights: readonly number[] = [nodeY]) => ({
    top: Math.min(...heights) - ENVELOPE_RISE - ENVELOPE_NEST_GAP * depth,
    bottom: Math.max(...heights) + ENVELOPE_DROP + ENVELOPE_NEST_GAP * depth,
  });
  if (live.length === 0) {
    const shared = envelopes.find((envelope) => envelope.shared);
    return shared === undefined
      ? []
      : [
          {
            run: { envelope: shared, members: [], first: 0, last: 0 },
            left: centerX - EMPTY_ENVELOPE_HALF_WIDTH,
            right: centerX + EMPTY_ENVELOPE_HALF_WIDTH,
            ...vertical(0),
          },
        ];
  }
  return envelopeRuns(
    live.map((node) => node.label),
    envelopes,
  ).map((run) => {
    const members = live.filter((node) => run.members.includes(node.label));
    const margin = envelopeMargin(run.envelope.depth);
    const tight = {
      left: Math.min(...members.map((node) => node.x - safeHalfWidth(node.view))) - margin,
      right: Math.max(...members.map((node) => node.x + safeHalfWidth(node.view))) + margin,
    };
    const middle = (tight.left + tight.right) / 2;
    const widened = run.envelope.shared
      ? {
          left: Math.min(
            tight.left,
            centerX -
              stageWidth / 2 +
              SHARED_ENVELOPE_INSET -
              ENVELOPE_NEST_GAP * run.envelope.depth,
          ),
          right: Math.max(
            tight.right,
            centerX +
              stageWidth / 2 -
              SHARED_ENVELOPE_INSET +
              ENVELOPE_NEST_GAP * run.envelope.depth,
          ),
        }
      : {
          left: Math.min(tight.left, middle - REGION_ENVELOPE_MIN_WIDTH / 2),
          right: Math.max(tight.right, middle + REGION_ENVELOPE_MIN_WIDTH / 2),
        };
    return {
      run,
      ...widened,
      ...vertical(
        run.envelope.depth,
        members.map((node) => node.y),
      ),
    };
  });
}

function boundaryGap(envelopes: readonly Envelope[], before: string, after: string): number {
  const widest = (inside: string, outside: string): number =>
    Math.max(
      0,
      ...envelopes
        .filter(
          (envelope) => envelope.members.includes(inside) && !envelope.members.includes(outside),
        )
        .map((envelope) => envelopeMargin(envelope.depth)),
    );
  const closing = widest(before, after);
  const opening = widest(after, before);
  return closing + opening + (closing > 0 && opening > 0 ? NEIGHBOUR_ENVELOPE_GAP : 0);
}

export function nodeRadius(massInGev: number): number {
  return 15 + 3 * Math.log10(1 + massInGev * ELECTRON_MASS_IN_MEV_SCALE);
}

export function arrowLength(momentumMagnitudeInGev: number): number {
  return momentumMagnitudeInGev <= 0 ? 0 : 12 + 5 * Math.log10(1 + momentumMagnitudeInGev * 1e6);
}

export function safeHalfWidth(view: ParticleView): number {
  return (
    Math.max(
      nodeRadius(view.massInGev) + HALO_GAP,
      (view.label.length * LABEL_CHARACTER_WIDTH) / 2,
    ) +
    SAFE_GAP / 2
  );
}

export function zoomedAt(
  view: StageView,
  factor: number,
  fractionX: number,
  fractionY: number,
  viewport: StageViewport,
): StageView {
  const zoom = Math.min(viewport.maximumZoom, Math.max(viewport.minimumZoom, view.zoom * factor));
  return {
    zoom,
    panX:
      view.panX +
      (fractionX - CENTER_FRACTION) * (viewport.width / view.zoom - viewport.width / zoom),
    panY:
      view.panY +
      (fractionY - CENTER_FRACTION) * (viewport.height / view.zoom - viewport.height / zoom),
  };
}

export function appearanceOrder(frames: readonly SystemFrame[]): readonly string[] {
  const order: string[] = [];
  frames.forEach((frame) => {
    frame.particles.forEach((particle) => {
      if (!order.includes(particle.label)) {
        order.push(particle.label);
      }
    });
  });
  return order;
}

function rounded(value: number): number {
  return Number(value.toPrecision(SIGNATURE_DIGITS));
}

function stateSignature(view: ParticleView, frame: SystemFrame): string {
  const regions = (frame.regions ?? [])
    .filter((region) => region.members.includes(view.label))
    .map((region) => region.id)
    .sort((first, second) => first - second);
  const momentum = [view.momentumInGev.x, view.momentumInGev.y, view.momentumInGev.z].map(rounded);
  const quantum = view.quantum.map((slot) => ({
    observable: slot.observable,
    entangled: slot.entangled,
    bloch: slot.blochVector,
    populations: slot.basisPopulations.map(rounded),
  }));
  const readings = Object.entries(view.readings ?? {}).map(
    ([name, value]) => [name, rounded(value)] as const,
  );
  return JSON.stringify([
    view.family,
    view.symbol,
    view.status,
    view.phase ?? null,
    view.allotrope ?? null,
    momentum,
    quantum,
    regions,
    readings,
  ]);
}

export interface ParticleGroup {
  readonly key: string;
  readonly view: ParticleView;
  readonly members: readonly string[];
}

export function particleGroups(
  views: readonly ParticleView[],
  frame: SystemFrame,
): readonly ParticleGroup[] {
  const groups = new Map<string, { view: ParticleView; members: string[] }>();
  views.forEach((view) => {
    const entangled = view.quantum.some((slot) => slot.entangled);
    const key = entangled ? `single:${view.label}` : `group:${stateSignature(view, frame)}`;
    const known = groups.get(key);
    if (known === undefined) {
      groups.set(key, { view, members: [view.label] });
    } else {
      known.members.push(view.label);
    }
  });
  return [...groups.entries()].flatMap(([key, group]) =>
    group.members.length >= GROUP_MINIMUM
      ? [{ key, view: group.view, members: group.members }]
      : group.members.map((label) => ({
          key: label,
          view: views.find((view) => view.label === label) ?? group.view,
          members: [label],
        })),
  );
}

function regionKey(label: string, envelopes: readonly Envelope[]): string {
  return envelopes
    .filter((envelope) => !envelope.shared && envelope.members.includes(label))
    .map((envelope) => envelope.key)
    .join('|');
}

interface StageItem {
  readonly key: string;
  readonly view: ParticleView;
  readonly members: readonly string[];
  readonly group?: string;
}

function rowsOf(items: readonly StageItem[], envelopes: readonly Envelope[]): StageItem[][] {
  const rows: StageItem[][] = [];
  items.forEach((item) => {
    const row = rows[rows.length - 1];
    const previous = row?.[row.length - 1];
    if (
      row === undefined ||
      previous === undefined ||
      row.length >= ROW_SIZE ||
      regionKey(previous.view.label, envelopes) !== regionKey(item.view.label, envelopes)
    ) {
      rows.push([item]);
    } else {
      row.push(item);
    }
  });
  return rows;
}

function rowOffsets(
  row: readonly StageItem[],
  width: number,
  padding: number,
  envelopes: readonly Envelope[],
  columns: number,
): readonly number[] {
  const evenStep = columns <= 1 ? 0 : (width - 2 * padding) / (columns - 1);
  const offsets = row.reduce<number[]>((positions, item, position) => {
    const before = row[position - 1];
    const last = positions[positions.length - 1];
    return [
      ...positions,
      before === undefined || last === undefined
        ? 0
        : last +
          Math.max(
            evenStep,
            safeHalfWidth(before.view) +
              safeHalfWidth(item.view) +
              boundaryGap(envelopes, before.view.label, item.view.label),
          ),
    ];
  }, []);
  const start = width / 2 - (offsets[offsets.length - 1] ?? 0) / 2;
  return offsets.map((offset) => start + offset);
}

export function layoutStage(
  frames: readonly SystemFrame[],
  index: number,
  width: number,
  padding: number,
  options: StageLayoutOptions = {},
): readonly StageNode[] {
  const frame = frames[index];
  if (frame === undefined) {
    return [];
  }
  const centerY = options.centerY ?? 0;
  const expanded = options.expanded ?? new Set<string>();
  const previous = frames[index - 1];
  const order = appearanceOrder(frames);
  const wasAlive = new Set(
    (previous?.particles ?? [])
      .filter((particle) => particle.status === 'alive')
      .map((particle) => particle.label),
  );
  const envelopes = frameEnvelopes(frame);
  const appearing = frame.particles
    .filter((particle) => particle.status === 'alive')
    .sort((first, second) => order.indexOf(first.label) - order.indexOf(second.label));
  const placed = envelopeOrder(
    appearing.map((particle) => particle.label),
    envelopes,
  );
  const alive = placed.flatMap((label) => appearing.filter((particle) => particle.label === label));
  const items: StageItem[] = particleGroups(alive, frame).flatMap((group) =>
    group.members.length > 1 && expanded.has(group.key)
      ? group.members.map((label) => ({
          key: label,
          view: alive.find((view) => view.label === label) ?? group.view,
          members: [label],
          group: group.key,
        }))
      : [group],
  );
  const rows = rowsOf(items, envelopes);
  const rowY = rows.reduce<number[]>((positions, row, position) => {
    const last = positions[positions.length - 1];
    const before = rows[position - 1]?.[0];
    const first = row[0];
    const changesRegion =
      before !== undefined &&
      first !== undefined &&
      regionKey(before.view.label, envelopes) !== regionKey(first.view.label, envelopes);
    return [
      ...positions,
      last === undefined
        ? 0
        : last + ROW_HEIGHT + (changesRegion ? ENVELOPE_RISE + ENVELOPE_DROP : 0),
    ];
  }, []);
  const middle = ((rowY[0] ?? 0) + (rowY[rowY.length - 1] ?? 0)) / 2;
  const nodes: StageNode[] = rows.flatMap((row, rowIndex) => {
    const columns = rowOffsets(
      row,
      width,
      padding,
      envelopes,
      rows.length > 1 ? ROW_SIZE : row.length,
    );
    return row.map((item, position) => ({
      key: item.key,
      label: item.view.label,
      members: item.members,
      bundle: item.key,
      ...(item.group === undefined ? {} : { group: item.group }),
      view: item.view,
      x: columns[position] ?? width / 2,
      y: centerY + (rowY[rowIndex] ?? 0) - middle,
      opacity: 1,
      scale: 1,
      leaving: false,
    }));
  });
  const positionOf = new Map(
    nodes.flatMap((node) => node.members.map((member) => [member, node] as const)),
  );
  const previousNodes =
    index > 0 ? layoutStage(frames, index - 1, width, padding, { centerY, expanded }) : [];
  const previousOf = new Map(
    previousNodes.flatMap((node) => node.members.map((member) => [member, node] as const)),
  );
  const mergeTargets = new Map<string, string>();
  frame.events
    .filter(
      (event) =>
        event.kind === 'combined' || (event.kind === 'hadronized' && event.products !== undefined),
    )
    .forEach((event) => {
      const composite = event.labels[event.labels.length - 1];
      if (composite !== undefined) {
        event.labels.slice(0, -1).forEach((label) => mergeTargets.set(label, composite));
      }
    });
  const massOf = new Map(frame.particles.map((particle) => [particle.label, particle.massInGev]));
  const reactionTargets = new Map<string, string>();
  frame.events
    .filter((event) => event.kind === 'reacted' && (event.products ?? []).length > 0)
    .forEach((event) => {
      const products = event.products ?? [];
      const heaviest = [...products].sort(
        (first, second) => (massOf.get(second) ?? 0) - (massOf.get(first) ?? 0),
      )[0];
      if (heaviest !== undefined) {
        event.labels
          .filter((label) => !products.includes(label))
          .forEach((label) => reactionTargets.set(label, heaviest));
      }
    });
  frame.particles
    .filter((particle) => particle.status !== 'alive' && wasAlive.has(particle.label))
    .forEach((view) => {
      const target = mergeTargets.get(view.label);
      const reactedInto = reactionTargets.get(view.label);
      const mergedInto =
        view.status === 'bound' && target !== undefined
          ? positionOf.get(target)
          : reactedInto === undefined
            ? undefined
            : positionOf.get(reactedInto);
      const before = previousOf.get(view.label);
      nodes.push({
        key: `leaving:${view.label}`,
        label: view.label,
        members: [view.label],
        bundle:
          before !== undefined && before.members.length > 1
            ? `leaving:${before.key}`
            : `leaving:${view.label}`,
        view,
        x: mergedInto?.x ?? before?.x ?? width / 2,
        y: mergedInto?.y ?? before?.y ?? centerY,
        opacity: 0,
        scale:
          mergedInto === undefined && (view.status === 'decayed' || view.status === 'collided')
            ? 1.8
            : 0.4,
        leaving: true,
      });
    });
  return nodes;
}

export function memberPositions(
  nodes: readonly StageNode[],
): ReadonlyMap<string, { readonly x: number; readonly y: number }> {
  return new Map(
    nodes
      .filter((node) => !node.leaving)
      .flatMap((node) => node.members.map((member) => [member, { x: node.x, y: node.y }] as const)),
  );
}

export interface LinkBundle {
  readonly key: string;
  readonly kind: 'entangle' | 'decayed' | 'collided' | 'annihilated' | 'reacted';
  readonly from: { readonly x: number; readonly y: number };
  readonly to: { readonly x: number; readonly y: number };
  readonly sources: readonly string[];
  readonly products: readonly string[];
  readonly count: number;
  readonly texts: readonly (LocalizedText | string)[];
}

export function linkBundles(
  frame: SystemFrame,
  nodes: readonly StageNode[],
): readonly LinkBundle[] {
  const endpointOf = new Map<string, StageNode>();
  nodes.filter((node) => node.leaving).forEach((node) => endpointOf.set(node.label, node));
  nodes
    .filter((node) => !node.leaving)
    .forEach((node) => node.members.forEach((member) => endpointOf.set(member, node)));
  const bundles = new Map<string, LinkBundle>();
  const add = (
    kind: LinkBundle['kind'],
    source: string,
    product: string,
    text: LocalizedText | string,
  ): void => {
    const from = endpointOf.get(source);
    const target = endpointOf.get(product);
    if (from === undefined || target === undefined || from.bundle === target.bundle) {
      return;
    }
    const key = `${kind}|${from.bundle}|${target.bundle}`;
    const known = bundles.get(key);
    bundles.set(key, {
      key,
      kind,
      from: { x: from.x, y: from.y },
      to: { x: target.x, y: target.y },
      sources: [...new Set([...(known?.sources ?? []), source])],
      products: [...new Set([...(known?.products ?? []), product])],
      count: (known?.count ?? 0) + 1,
      texts:
        known === undefined
          ? [text]
          : known.texts.some((seen) => JSON.stringify(seen) === JSON.stringify(text))
            ? known.texts
            : [...known.texts, text],
    });
  };
  const seenPairs = new Set<string>();
  frame.particles.forEach((particle) =>
    particle.quantum
      .filter((slot) => slot.entangled)
      .forEach((slot) =>
        slot.sharesRegisterWith.forEach((other) => {
          const pair = [particle.label, other].sort().join('|');
          if (!seenPairs.has(pair)) {
            seenPairs.add(pair);
            add('entangle', particle.label, other, '');
          }
        }),
      ),
  );
  frame.events.forEach((event) => {
    if (
      event.kind !== 'decayed' &&
      event.kind !== 'collided' &&
      event.kind !== 'annihilated' &&
      event.kind !== 'reacted'
    ) {
      return;
    }
    const products = event.products ?? [];
    const text = event.text;
    event.labels
      .filter((label) => !products.includes(label))
      .forEach((source) =>
        products.forEach((product) => add(event.kind as LinkBundle['kind'], source, product, text)),
      );
  });
  return [...bundles.values()];
}
