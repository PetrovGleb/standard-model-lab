/* Plan diagram layout: turns plan steps into lanes (one column per particle, nucleus, atom or molecule) with nodes per step, links for entangle, combine, collide and decay, and
   environment bands: a medium, temperature, field or coherence step spans the lanes it acts on (all of them when it names none) from its row until a later step replaces that aspect.
   System-wide steps after a collision or decay with no named products land on a "record.*" products lane; a create step with a count is one lane for the whole group with a stacked node. */
import type { ExperimentPlan, ExperimentStep, ParticleName } from '@standard-model/contracts';
import type { OperationName } from './icons';
import { moleculeChargeText, moleculeFormula } from './molecule-edits';
import { compositeOf, membersOf, type CompositeSource } from './plan-edits';
import { say } from './language';

export type ElementSymbolOf = (protons: number) => string;

const UNKNOWN_ELEMENT: ElementSymbolOf = (protons) => `Z${String(protons)}`;

type MatterCreation = Extract<
  ExperimentStep,
  { operation: 'createNucleus' | 'createAtom' | 'createMolecule' }
>;

function matterCaption(step: MatterCreation, symbolOf: ElementSymbolOf): string {
  switch (step.operation) {
    case 'createNucleus':
      return `${say('ядро', 'nucleus')} ${symbolOf(step.protons)}-${String(step.massNumber)}`;
    case 'createAtom': {
      const isotope = `${symbolOf(step.protons)}${step.massNumber === undefined ? '' : `-${String(step.massNumber)}`}`;
      const charge = step.charge ?? 0;
      return charge === 0
        ? `${say('атом', 'atom')} ${isotope}`
        : `${say('ион', 'ion')} ${isotope}${charge === 1 ? '+' : `${String(charge)}+`}`;
    }
    case 'createMolecule':
      return `${say('молекула', 'molecule')} ${moleculeFormula(step.atoms.map((atom) => symbolOf(atom.protons)))}${moleculeChargeText(step.charges)}`;
  }
}

export function createdNote(count: number): string {
  return say(`создано ${String(count)} объектов`, `${String(count)} objects created`);
}

export interface DiagramLane {
  readonly label: string;
  readonly members: readonly string[];
  readonly particle: ParticleName | null;
  readonly caption: string | null;
  readonly column: number;
  readonly startRow: number;
  readonly endRow: number | null;
  readonly endKind: 'decayed' | 'bound' | 'collided' | null;
}

export interface DiagramNode {
  readonly row: number;
  readonly column: number;
  readonly operation: OperationName;
  readonly note: string | null;
  readonly stacked?: boolean;
}

export interface DiagramLink {
  readonly row: number;
  readonly kind: 'entangle' | 'combine' | 'collide' | 'decay';
  readonly fromColumns: readonly number[];
  readonly toColumns: readonly number[];
}

export interface DiagramBand {
  readonly row: number;
  readonly endRow: number;
  readonly aspect: string;
  readonly influence: string;
  readonly columns: readonly number[] | null;
  readonly targets: readonly string[] | null;
}

export interface DiagramLayout {
  readonly lanes: readonly DiagramLane[];
  readonly nodes: readonly DiagramNode[];
  readonly links: readonly DiagramLink[];
  readonly bands: readonly DiagramBand[];
  readonly rowCount: number;
}

const ENVIRONMENT_ASPECTS: Readonly<Record<string, string>> = {
  setMedium: 'medium',
  setTemperature: 'temperature',
  changeTemperature: 'temperature',
  heat: 'temperature',
  cool: 'temperature',
  applyMagneticField: 'magneticField',
  removeMagneticField: 'magneticField',
  applyElectricField: 'electricField',
  setCoherenceTimes: 'coherenceTimes',
};

export function isEnvironmentInfluence(influence: string): boolean {
  return ENVIRONMENT_ASPECTS[influence] !== undefined;
}

export function environmentBands(
  plan: ExperimentPlan,
  layout: Omit<DiagramLayout, 'bands'>,
): readonly DiagramBand[] {
  const columnOf = new Map(
    layout.lanes.flatMap((lane) =>
      [lane.label, ...lane.members].map((label) => [label, lane.column] as const),
    ),
  );
  const starts = plan.steps.flatMap((step, row) => {
    const aspect = step.operation === 'influence' ? ENVIRONMENT_ASPECTS[step.influence] : undefined;
    if (aspect === undefined || step.operation !== 'influence') {
      return [];
    }
    const targets = step.targets ?? null;
    const columns =
      targets === null
        ? null
        : targets.flatMap((target) => {
            const column = columnOf.get(target);
            return column === undefined ? [] : [column];
          });
    return [{ row, aspect, influence: step.influence, columns, targets }];
  });
  return starts.map((band) => {
    const replaced = starts.find(
      (later) =>
        later.row > band.row &&
        later.aspect === band.aspect &&
        (later.targets === null ||
          (band.targets !== null &&
            band.targets.every((target) => later.targets?.includes(target)))),
    );
    return { ...band, endRow: replaced === undefined ? plan.steps.length - 1 : replaced.row - 1 };
  });
}

interface MutableLane {
  label: string;
  members: readonly string[];
  particle: ParticleName | null;
  caption: string | null;
  column: number;
  startRow: number;
  endRow: number | null;
  endKind: 'decayed' | 'bound' | 'collided' | null;
}

interface MutableLink {
  row: number;
  kind: 'entangle' | 'combine' | 'collide' | 'decay';
  fromColumns: number[];
  toColumns: number[];
}

const PRODUCT_LABEL = /^(.+)\.(\d+)$/;

export function layoutPlan(
  plan: ExperimentPlan,
  particles: readonly CompositeSource[] = [],
  symbolOf: ElementSymbolOf = UNKNOWN_ELEMENT,
): DiagramLayout {
  const lanes: MutableLane[] = [];
  const byLabel = new Map<string, MutableLane>();
  const nodes: DiagramNode[] = [];
  const links: MutableLink[] = [];
  const productLinks = new Map<string, MutableLink>();

  const openLane = (
    label: string,
    particle: ParticleName | null,
    row: number,
    caption: string | null = null,
    members: readonly string[] = [label],
  ): MutableLane => {
    const lane: MutableLane = {
      label,
      members,
      particle,
      caption,
      column: lanes.length,
      startRow: row,
      endRow: null,
      endKind: null,
    };
    lanes.push(lane);
    [label, ...members].forEach((member) => byLabel.set(member, lane));
    return lane;
  };

  const laneFor = (label: string): MutableLane | null => {
    const existing = byLabel.get(label);
    if (existing !== undefined) {
      return existing;
    }
    const match = PRODUCT_LABEL.exec(label);
    const productLink = match === null ? undefined : productLinks.get(match[1] ?? '');
    if (productLink === undefined) {
      return null;
    }
    const lane = openLane(label, null, productLink.row);
    productLink.toColumns.push(lane.column);
    return lane;
  };

  const aliveAt = (row: number): readonly MutableLane[] =>
    lanes.filter((lane) => lane.startRow <= row && lane.endRow === null);

  const systemWide = (row: number): readonly MutableLane[] => {
    productLinks.forEach((link, source) => {
      if (link.toColumns.length === 0) {
        const caption =
          link.kind === 'decay'
            ? say('продукты распада', 'decay products')
            : say('продукты столкновения', 'collision products');
        link.toColumns.push(openLane(`${source}.*`, null, link.row, caption).column);
      }
    });
    return aliveAt(row);
  };

  const close = (lane: MutableLane, row: number, kind: 'decayed' | 'bound' | 'collided'): void => {
    lane.endRow = row;
    lane.endKind = kind;
  };

  plan.steps.forEach((step, row) => {
    switch (step.operation) {
      case 'create':
      case 'createNucleus':
      case 'createAtom':
      case 'createMolecule': {
        const members = membersOf(step, plan);
        const lane = openLane(
          step.label,
          step.operation === 'create' ? step.particle : null,
          row,
          step.operation === 'create' ? null : matterCaption(step, symbolOf),
          members,
        );
        nodes.push({
          row,
          column: lane.column,
          operation: step.operation,
          note: members.length > 1 ? createdNote(members.length) : null,
          ...(members.length > 1 ? { stacked: true } : {}),
        });
        break;
      }
      case 'entangle': {
        const columns = step.targets
          .map((target) => laneFor(target))
          .filter((lane): lane is MutableLane => lane !== null)
          .map((lane) => lane.column);
        columns.forEach((column) => nodes.push({ row, column, operation: 'entangle', note: null }));
        if (columns.length === 2) {
          links.push({
            row,
            kind: 'entangle',
            fromColumns: [columns[0] ?? 0],
            toColumns: [columns[1] ?? 0],
          });
        }
        break;
      }
      case 'influence':
      case 'evolve': {
        const targets =
          step.targets === undefined
            ? systemWide(row)
            : step.targets
                .map((target) => laneFor(target))
                .filter((lane): lane is MutableLane => lane !== null);
        targets.forEach((lane) =>
          nodes.push({ row, column: lane.column, operation: step.operation, note: null }),
        );
        break;
      }
      case 'measure': {
        const lane = laneFor(step.target);
        if (lane !== null) {
          nodes.push({ row, column: lane.column, operation: 'measure', note: step.record });
        }
        break;
      }
      case 'combine': {
        const sources = step.targets
          .map((target) => laneFor(target))
          .filter((lane): lane is MutableLane => lane !== null);
        sources.forEach((lane) => close(lane, row, 'bound'));
        const lane = openLane(
          step.label,
          compositeOf(
            sources.map((source) => source.particle),
            particles,
          ),
          row,
        );
        nodes.push({ row, column: lane.column, operation: 'combine', note: null });
        links.push({
          row,
          kind: 'combine',
          fromColumns: sources.map((source) => source.column),
          toColumns: [lane.column],
        });
        break;
      }
      case 'diffract': {
        const lane = laneFor(step.target);
        if (lane !== null) {
          nodes.push({ row, column: lane.column, operation: 'diffract', note: step.record });
        }
        break;
      }
      case 'collide': {
        const sources = step.targets
          .map((target) => laneFor(target))
          .filter((lane): lane is MutableLane => lane !== null);
        sources.forEach((lane) => close(lane, row, 'collided'));
        const hub = sources[0]?.column ?? 0;
        nodes.push({ row, column: hub, operation: 'collide', note: step.record });
        const link: MutableLink = {
          row,
          kind: 'collide',
          fromColumns: sources.map((source) => source.column),
          toColumns: [],
        };
        links.push(link);
        productLinks.set(step.record, link);
        break;
      }
      case 'place':
      case 'measurePosition': {
        const lane = laneFor(step.target);
        if (lane !== null) {
          nodes.push({
            row,
            column: lane.column,
            operation: step.operation,
            note: step.operation === 'measurePosition' ? step.record : null,
          });
        }
        break;
      }
      case 'measureSystem':
        systemWide(row).forEach((lane) =>
          nodes.push({ row, column: lane.column, operation: 'measureSystem', note: null }),
        );
        break;
      case 'propagate': {
        const placed = new Set(
          plan.steps
            .slice(0, row)
            .flatMap((earlier) => (earlier.operation === 'place' ? [earlier.target] : [])),
        );
        aliveAt(row)
          .filter((lane) => placed.has(lane.label))
          .forEach((lane) =>
            nodes.push({ row, column: lane.column, operation: 'propagate', note: null }),
          );
        break;
      }
      case 'decay': {
        const lane = laneFor(step.target);
        if (lane === null) {
          break;
        }
        close(lane, row, 'decayed');
        nodes.push({ row, column: lane.column, operation: 'decay', note: step.record ?? null });
        const link: MutableLink = { row, kind: 'decay', fromColumns: [lane.column], toColumns: [] };
        links.push(link);
        productLinks.set(step.target, link);
        break;
      }
    }
  });

  const laid = { lanes, nodes, links, rowCount: plan.steps.length };
  return { ...laid, bands: environmentBands(plan, laid) };
}
