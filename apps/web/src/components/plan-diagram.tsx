/* PlanDiagram: the experiment as particle lanes running down through the steps, with entanglement links, combine merges, collisions, decay splits and environment bands nested by inset with
   their captions at their own rows; rows are clickable, and the drawing either sizes itself or fills a pan-and-zoom canvas through a view box. */
import type { ElementEntry, ExperimentPlan, ParticleCatalogEntry } from '@standard-model/contracts';
import { OPERATION_TITLES, PARTICLE_GLOSSARY } from '../glossary';
import { OPERATION_ICONS, type OperationName } from '../icons';
import { describeStep } from '../plan-edits';
import { layoutPlan, type DiagramLayout } from '../plan-diagram';
import { influenceVisual } from '../influence-visual';
import { useState } from 'react';
import { say } from '../language';

const GUTTER = 172;
const COLUMN_WIDTH = 88;
const ROW_HEIGHT = 52;
const BAND_PADDING = 7;
const BAND_LABEL_INSET = 8;
const BAND_LABEL_WIDTH = 150;
const BAND_LABEL_CHARACTERS = 22;
const BAND_CORNER = 12;
const TEXT_BASELINE = 4;
const NOTE_GAP = 6;
const NEST_INSET = 5;

function shortened(caption: string): string {
  return caption.length <= BAND_LABEL_CHARACTERS
    ? caption
    : `${caption.slice(0, BAND_LABEL_CHARACTERS - 1).trimEnd()}…`;
}
const HEADER = 62;
const NODE_RADIUS = 18;
const STACK_SHIFT = 0.3;
const STACK_COINS = [2, 1];
const ICON_SIZE = 18;
const ICON_STROKE = 2;
const PADDING = 20;

export type DiagramViewBox = readonly [number, number, number, number];

interface Props {
  readonly plan: ExperimentPlan;
  readonly layout: DiagramLayout;
  readonly activeRow?: number | null;
  readonly onSelect?: (row: number) => void;
  readonly symbolOf?: (name: string) => string;
  readonly viewBox?: DiagramViewBox;
}

export function diagramLayout(
  plan: ExperimentPlan,
  particles: readonly ParticleCatalogEntry[],
  elements: readonly ElementEntry[],
): DiagramLayout {
  return layoutPlan(
    plan,
    particles,
    (protons) =>
      elements.find((element) => element.protons === protons)?.symbol ?? `Z${String(protons)}`,
  );
}

export function diagramSize(layout: DiagramLayout): {
  readonly width: number;
  readonly height: number;
} {
  const columns = Math.max(layout.lanes.length, 1);
  return {
    width:
      GUTTER + columns * COLUMN_WIDTH + PADDING + (layout.bands.length > 0 ? BAND_LABEL_WIDTH : 0),
    height: HEADER + Math.max(layout.rowCount, 1) * ROW_HEIGHT + PADDING,
  };
}

function bandEdges(
  band: DiagramLayout['bands'][number],
  layout: DiagramLayout,
  width: number,
): { readonly left: number; readonly right: number; readonly lastColumn: number } {
  const columns = band.columns ?? layout.lanes.map((lane) => lane.column);
  const spansAll = band.columns === null || columns.length === 0;
  return {
    left: spansAll ? GUTTER : laneX(Math.min(...columns)) - COLUMN_WIDTH / 2,
    right: spansAll
      ? width - PADDING - BAND_LABEL_WIDTH
      : laneX(Math.max(...columns)) + COLUMN_WIDTH / 2,
    lastColumn: Math.max(...columns),
  };
}

function noteX(node: DiagramLayout['nodes'][number], layout: DiagramLayout, width: number): number {
  const stack = node.stacked === true ? NODE_RADIUS * STACK_SHIFT * Math.max(...STACK_COINS) : 0;
  const frames = layout.bands
    .filter((band) => band.topRow <= node.row && node.row <= band.endRow)
    .map((band) => bandEdges(band, layout, width))
    .filter((edges) => edges.lastColumn === node.column)
    .map((edges) => edges.right + BAND_LABEL_INSET);
  return Math.max(laneX(node.column) + NODE_RADIUS + stack + NOTE_GAP, ...frames);
}

function laneX(column: number): number {
  return GUTTER + column * COLUMN_WIDTH + COLUMN_WIDTH / 2;
}

function rowY(row: number): number {
  return HEADER + row * ROW_HEIGHT + ROW_HEIGHT / 2;
}

export function diagramRowCenter(row: number): number {
  return rowY(row);
}

function curve(fromX: number, fromY: number, toX: number, toY: number): string {
  const middleY = (fromY + toY) / 2;
  return `M ${String(fromX)} ${String(fromY)} C ${String(fromX)} ${String(middleY)}, ${String(toX)} ${String(middleY)}, ${String(toX)} ${String(toY)}`;
}

function Links({ layout }: { readonly layout: DiagramLayout }) {
  return (
    <g>
      {layout.links.map((link, index) => {
        const y = rowY(link.row);
        if (link.kind === 'entangle') {
          const fromX = laneX(link.fromColumns[0] ?? 0);
          const toX = laneX(link.toColumns[0] ?? 0);
          const waves = Math.max(2, Math.round(Math.abs(toX - fromX) / 18));
          const step = (toX - fromX) / waves;
          const path = Array.from({ length: waves }, (ignored, wave) => {
            const startX = fromX + wave * step;
            return `Q ${String(startX + step / 2)} ${String(y + (wave % 2 === 0 ? -9 : 9))}, ${String(startX + step)} ${String(y)}`;
          }).join(' ');
          return (
            <path
              key={index}
              className="link link-entangle"
              d={`M ${String(fromX)} ${String(y)} ${path}`}
            />
          );
        }
        if (link.kind === 'collide') {
          const hub = link.fromColumns[0] ?? 0;
          return [
            ...link.fromColumns.map((source) => (
              <path
                key={`${String(index)}-in-${String(source)}`}
                className="link link-collide"
                d={curve(laneX(source), y - ROW_HEIGHT * 0.55, laneX(hub), y)}
              />
            )),
            ...link.toColumns.map((target) => (
              <path
                key={`${String(index)}-out-${String(target)}`}
                className="link link-collide"
                d={curve(laneX(hub), y, laneX(target), y + ROW_HEIGHT * 0.55)}
              />
            )),
          ];
        }
        const pairs =
          link.kind === 'combine'
            ? link.fromColumns.map((source) => [source, link.toColumns[0] ?? source] as const)
            : link.toColumns.map((target) => [link.fromColumns[0] ?? target, target] as const);
        return pairs.map(([source, target]) => (
          <path
            key={`${String(index)}-${String(source)}-${String(target)}`}
            className={`link link-${link.kind}`}
            d={
              link.kind === 'combine'
                ? curve(laneX(source), y - ROW_HEIGHT * 0.55, laneX(target), y)
                : curve(laneX(source), y, laneX(target), y + ROW_HEIGHT * 0.55)
            }
          />
        ));
      })}
    </g>
  );
}

export function PlanDiagram({
  plan,
  layout,
  activeRow = null,
  onSelect,
  symbolOf = (name) => name,
  viewBox,
}: Props) {
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const { width, height } = diagramSize(layout);
  const lastY = rowY(Math.max(layout.rowCount - 1, 0));

  if (plan.steps.length === 0) {
    return (
      <p className="muted diagram-empty">
        {say(
          'Добавьте шаги, и здесь появится схема эксперимента.',
          'Add steps and the experiment diagram appears here.',
        )}
      </p>
    );
  }

  return (
    <svg
      className="diagram"
      width={viewBox === undefined ? width : '100%'}
      height={viewBox === undefined ? height : '100%'}
      viewBox={(viewBox ?? [0, 0, width, height]).map(String).join(' ')}
      role="img"
      aria-label={say(
        `Схема эксперимента ${plan.name}: ${String(plan.steps.length)} шагов, ${String(layout.lanes.length)} частиц`,
        `Experiment diagram ${plan.name}: ${String(plan.steps.length)} steps, ${String(layout.lanes.length)} particles`,
      )}
    >
      {plan.steps.map((step, row) => (
        <g
          key={row}
          className={[
            'diagram-row',
            row === activeRow ? 'active' : '',
            row === hoveredRow ? 'hovered' : '',
          ].join(' ')}
          onClick={() => onSelect?.(row)}
          data-tooltip={describeStep(step)}
        >
          <rect
            x={4}
            y={HEADER + row * ROW_HEIGHT + 3}
            width={width - 8}
            height={ROW_HEIGHT - 6}
            rx={14}
          />
          <text className="row-number" x={20} y={rowY(row) + 5}>
            {row + 1}
          </text>
          <text className="row-title" x={46} y={rowY(row) + 5}>
            {OPERATION_TITLES[step.operation] ?? step.operation}
          </text>
        </g>
      ))}
      {layout.bands.map((band, index) => {
        const step = plan.steps[band.row];
        if (step === undefined || step.operation !== 'influence') {
          return null;
        }
        const visual = influenceVisual(step, null, symbolOf);
        const { left, right } = bandEdges(band, layout, width);
        const sideInset = band.depth * NEST_INSET;
        const edgeInset = Math.min(band.depth * NEST_INSET, BAND_PADDING - 1);
        const top = rowY(band.topRow) - NODE_RADIUS - BAND_PADDING;
        const bottom = rowY(band.endRow) + NODE_RADIUS + BAND_PADDING;
        return (
          <g
            key={`band-${String(index)}`}
            className={`diagram-band tone-${visual.tone}`}
            data-tooltip={say(
              `${visual.caption}: действует на ${band.targets === null ? 'всю систему' : band.targets.join(', ')} с шага ${String(band.row + 1)}${band.endRow === plan.steps.length - 1 ? ' до конца' : ` по шаг ${String(band.endRow + 1)}`}${band.topRow < band.row ? ' и охватывает частицы, созданные выше' : ''}`,
              `${visual.caption}: acts on ${band.targets === null ? 'the whole system' : band.targets.join(', ')} from step ${String(band.row + 1)}${band.endRow === plan.steps.length - 1 ? ' to the end' : ` through step ${String(band.endRow + 1)}`}${band.topRow < band.row ? ' and wraps the particles created above' : ''}`,
            )}
          >
            <rect
              x={left + sideInset}
              y={top + edgeInset}
              width={Math.max(right - left, COLUMN_WIDTH) - 2 * sideInset}
              height={bottom - top - 2 * edgeInset}
              rx={BAND_CORNER - edgeInset}
            />
            <text
              className="diagram-band-label"
              x={right + BAND_LABEL_INSET}
              y={rowY(band.row) + TEXT_BASELINE}
            >
              {shortened(visual.caption)}
            </text>
          </g>
        );
      })}
      {layout.lanes.map((lane) => (
        <g key={lane.label} className="lane">
          <text className="lane-label" x={laneX(lane.column)} y={24} textAnchor="middle">
            {lane.label}
          </text>
          <text className="lane-particle" x={laneX(lane.column)} y={42} textAnchor="middle">
            {lane.members.length > 1 ? `×${String(lane.members.length)} ` : ''}
            {lane.caption ??
              (lane.particle === null
                ? say('продукт', 'product')
                : (PARTICLE_GLOSSARY[lane.particle] ?? lane.particle))}
          </text>
          <line
            className={lane.endRow === null ? 'lane-line' : `lane-line ended ${lane.endKind ?? ''}`}
            x1={laneX(lane.column)}
            x2={laneX(lane.column)}
            y1={rowY(lane.startRow)}
            y2={lane.endRow === null ? lastY + NODE_RADIUS + BAND_PADDING : rowY(lane.endRow)}
          />
        </g>
      ))}
      <Links layout={layout} />
      {layout.bands
        .filter((band) => !layout.nodes.some((node) => node.row === band.row))
        .map((band) => {
          const columns = band.columns ?? layout.lanes.map((lane) => lane.column);
          const step = plan.steps[band.row];
          const Icon = OPERATION_ICONS.influence;
          const y = rowY(band.row);
          return columns.map((column) => (
            <g
              key={`ahead-${String(band.row)}-${String(column)}`}
              className="node op-influence ahead"
              onClick={() => onSelect?.(band.row)}
              onMouseEnter={() => setHoveredRow(band.row)}
              onMouseLeave={() => setHoveredRow(null)}
              data-tooltip={
                step === undefined
                  ? undefined
                  : `${describeStep(step)}. ${say('Частицы появятся ниже и окажутся в этом окружении', 'The particles appear below and land in this environment')}`
              }
            >
              <circle cx={laneX(column)} cy={y} r={NODE_RADIUS} />
              <Icon
                x={laneX(column) - ICON_SIZE / 2}
                y={y - ICON_SIZE / 2}
                size={ICON_SIZE}
                strokeWidth={ICON_STROKE}
                aria-hidden="true"
              />
            </g>
          ));
        })}
      {layout.nodes.map((node, index) => {
        const Icon = OPERATION_ICONS[node.operation as OperationName];
        const x = laneX(node.column);
        const y = rowY(node.row);
        const step = plan.steps[node.row];
        return (
          <g
            key={index}
            className={`node op-${node.operation}`}
            onClick={() => onSelect?.(node.row)}
            onMouseEnter={() => setHoveredRow(node.row)}
            onMouseLeave={() => setHoveredRow(null)}
            data-tooltip={step === undefined ? undefined : describeStep(step)}
          >
            {node.stacked === true &&
              STACK_COINS.map((coin) => (
                <circle
                  key={coin}
                  className="node-stack"
                  cx={x + NODE_RADIUS * STACK_SHIFT * coin}
                  cy={y}
                  r={NODE_RADIUS}
                />
              ))}
            <circle cx={x} cy={y} r={NODE_RADIUS} />
            <Icon
              x={x - ICON_SIZE / 2}
              y={y - ICON_SIZE / 2}
              size={ICON_SIZE}
              strokeWidth={ICON_STROKE}
              aria-hidden="true"
            />
            {node.note !== null && (
              <text className="node-note" x={noteX(node, layout, width)} y={y + TEXT_BASELINE}>
                {node.note}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
