/* SpaceCard: the plan's spatial cube; grid, cell size and potential, a ruler of working scales with reference objects where the cube band is dragged or resized, and a preview of the cube with the placed clouds. */
import type {
  CatalogResponse,
  ExperimentPlan,
  NumberOrParameter,
  PotentialKind,
  SpaceSpec,
} from '@standard-model/contracts';
import { sml } from './sml-icon';

const SPACE_ICON = sml('space-cube');
import { useRef, type PointerEvent } from 'react';
import { formatLength } from '../format';
import { POTENTIAL_GLOSSARY } from '../glossary';
import { FieldLabel, parameterIcon } from '../icons';
import { DEFAULT_SPACE } from '../plan-edits';
import { presetsForParameter } from '../presets';
import {
  dragScale,
  LARGEST_RULER_EXPONENT,
  SMALLEST_RULER_EXPONENT,
  type CubeScale,
  type ScaleHandle,
} from '../space-scale';
import { NumberOrParameterInput } from './number-or-parameter-input';
import { Select } from './select';
import { slitWallSpans } from './space-view';
import { localize, say } from '../language';

const RULER_WIDTH = 720;
const RULER_HEIGHT = 134;
const RULER_PADDING = 24;
const SMALLEST_EXPONENT = SMALLEST_RULER_EXPONENT;
const LARGEST_EXPONENT = LARGEST_RULER_EXPONENT;
const HANDLE_WIDTH = 10;
const ELECTRON_LOWER_LIMIT_IN_METERS = 3.9e-12;
const CUBE_SIZE = 92;
const CUBE_ORIGIN_X = 140;
const CUBE_ORIGIN_Y = 120;

interface Props {
  readonly plan: ExperimentPlan;
  readonly catalog: CatalogResponse;
  readonly onChange: (plan: ExperimentPlan) => void;
}

function rulerX(meters: number): number {
  const exponent = Math.log10(meters);
  const fraction = (exponent - SMALLEST_EXPONENT) / (LARGEST_EXPONENT - SMALLEST_EXPONENT);
  return RULER_PADDING + Math.min(Math.max(fraction, 0), 1) * (RULER_WIDTH - 2 * RULER_PADDING);
}

function asNumber(
  value: NumberOrParameter | undefined,
  parameters: Readonly<Record<string, number>>,
): number {
  if (typeof value === 'number') {
    return value;
  }
  if (value === undefined) {
    return Number.NaN;
  }
  return parameters[value.slice(2, -2)] ?? Number.NaN;
}

function ScaleRuler({
  cell,
  grid,
  catalog,
  onScale,
}: {
  readonly cell: number;
  readonly grid: number;
  readonly catalog: CatalogResponse;
  readonly onScale: (scale: CubeScale) => void;
}) {
  const edge = cell * grid;
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ handle: ScaleHandle; startX: number; start: CubeScale } | null>(null);
  const begin = (handle: ScaleHandle) => (event: PointerEvent<SVGElement>) => {
    event.stopPropagation();
    svg.current?.setPointerCapture(event.pointerId);
    drag.current = {
      handle,
      startX: event.clientX,
      start: { cellSizeInMeters: cell, gridPointsPerAxis: grid },
    };
  };
  const move = (event: PointerEvent<SVGSVGElement>): void => {
    const active = drag.current;
    const width = svg.current?.getBoundingClientRect().width ?? 0;
    if (active === null || width === 0) {
      return;
    }
    const exponentShift =
      (((event.clientX - active.startX) * RULER_WIDTH) /
        width /
        (RULER_WIDTH - 2 * RULER_PADDING)) *
      (LARGEST_EXPONENT - SMALLEST_EXPONENT);
    const next = dragScale(active.handle, active.start, exponentShift, catalog.gridSizes);
    if (next.cellSizeInMeters !== cell || next.gridPointsPerAxis !== grid) {
      onScale(next);
    }
  };
  const end = (): void => {
    drag.current = null;
  };
  const exponents = Array.from(
    { length: LARGEST_EXPONENT - SMALLEST_EXPONENT + 1 },
    (ignored, index) => SMALLEST_EXPONENT + index,
  );
  const axisY = 80;
  return (
    <svg
      ref={svg}
      className="ruler"
      viewBox={`0 0 ${String(RULER_WIDTH)} ${String(RULER_HEIGHT)}`}
      role="group"
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      aria-label={say(
        `Масштаб: ячейка ${formatLength(cell)}, ребро куба ${formatLength(edge)}`,
        `Scale: cell ${formatLength(cell)}, cube edge ${formatLength(edge)}`,
      )}
    >
      <rect
        className="ruler-nucleon-only"
        x={rulerX(1e-15)}
        y={axisY - 10}
        width={rulerX(ELECTRON_LOWER_LIMIT_IN_METERS) - rulerX(1e-15)}
        height={20}
        rx={6}
      />
      <text
        className="ruler-zone"
        x={(rulerX(1e-15) + rulerX(ELECTRON_LOWER_LIMIT_IN_METERS)) / 2}
        y={axisY + 30}
        textAnchor="middle"
      >
        {say('только нуклоны', 'nucleons only')}
      </text>
      <line
        className="ruler-axis"
        x1={RULER_PADDING}
        x2={RULER_WIDTH - RULER_PADDING}
        y1={axisY}
        y2={axisY}
      />
      {exponents.map((exponent) => (
        <g key={exponent}>
          <line
            className="ruler-tick"
            x1={rulerX(10 ** exponent)}
            x2={rulerX(10 ** exponent)}
            y1={axisY - 4}
            y2={axisY + 4}
          />
          <text
            className="ruler-tick-label"
            x={rulerX(10 ** exponent)}
            y={axisY + 18}
            textAnchor="middle"
          >
            10{exponent < 0 ? '⁻' : ''}
            {String(Math.abs(exponent))
              .split('')
              .map((digit) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(digit)])
              .join('')}
          </text>
        </g>
      ))}
      {catalog.scaleReferences
        .filter(
          (reference) =>
            reference.meters >= 10 ** SMALLEST_EXPONENT &&
            reference.meters <= 10 ** LARGEST_EXPONENT,
        )
        .map((reference, index) => (
          <g
            key={reference.meters}
            data-tooltip={`${localize(reference.label)}: ${formatLength(reference.meters)}`}
          >
            <circle className="ruler-reference" cx={rulerX(reference.meters)} cy={axisY} r={4} />
            <text
              className="ruler-reference-label"
              x={rulerX(reference.meters)}
              y={14 + (index % 3) * 15}
              textAnchor="middle"
            >
              {localize(reference.label)}
            </text>
            <line
              className="ruler-leader"
              x1={rulerX(reference.meters)}
              x2={rulerX(reference.meters)}
              y1={18 + (index % 3) * 15}
              y2={axisY - 5}
            />
          </g>
        ))}
      {Number.isFinite(cell) && Number.isFinite(edge) && (
        <g>
          <rect
            className="ruler-cube"
            x={rulerX(cell)}
            y={axisY - 8}
            width={Math.max(2, rulerX(edge) - rulerX(cell))}
            height={16}
            rx={8}
            data-tooltip={say(
              'Перетащите, чтобы сдвинуть масштаб куба; сетка сохраняется',
              'Drag to shift the cube scale; the grid is kept',
            )}
            onPointerDown={begin('move')}
          />
          <rect
            className="ruler-handle"
            x={rulerX(cell) - HANDLE_WIDTH / 2}
            y={axisY - 13}
            width={HANDLE_WIDTH}
            height={26}
            rx={4}
            data-tooltip={say(
              'Размер ячейки: ребро куба остается, сетка 32³ или 64³',
              'Cell size: the cube edge stays, the grid is 32³ or 64³',
            )}
            onPointerDown={begin('cell')}
          />
          <rect
            className="ruler-handle"
            x={rulerX(edge) - HANDLE_WIDTH / 2}
            y={axisY - 13}
            width={HANDLE_WIDTH}
            height={26}
            rx={4}
            data-tooltip={say(
              'Ребро куба: ячейка остается, сетка 32³ или 64³',
              'Cube edge: the cell stays, the grid is 32³ or 64³',
            )}
            onPointerDown={begin('edge')}
          />
          <text
            className="ruler-cube-label"
            x={(rulerX(cell) + rulerX(edge)) / 2}
            y={RULER_HEIGHT - 4}
            textAnchor="middle"
          >
            {say('куб: ячейка', 'cube: cell')} {formatLength(cell)} … {say('ребро', 'edge')}{' '}
            {formatLength(edge)}
          </text>
        </g>
      )}
    </svg>
  );
}

function project(x: number, y: number, z: number): readonly [number, number] {
  const angle = Math.PI / 6;
  const [centeredX, centeredY, centeredZ] = [x - 0.5, y - 0.5, z - 0.5];
  return [
    CUBE_ORIGIN_X + (centeredX - centeredZ) * Math.cos(angle) * CUBE_SIZE,
    CUBE_ORIGIN_Y - centeredY * CUBE_SIZE + (centeredX + centeredZ) * Math.sin(angle) * CUBE_SIZE,
  ];
}

function CubePreview({ plan, half }: { readonly plan: ExperimentPlan; readonly half: number }) {
  const corners = [0, 1].flatMap((x) =>
    [0, 1].flatMap((y) => [0, 1].map((z) => [x, y, z] as const)),
  );
  const edges = corners.flatMap((first, index) =>
    corners
      .slice(index + 1)
      .filter((second) => first.filter((value, axis) => value !== second[axis]).length === 1)
      .map((second) => [first, second] as const),
  );
  const toUnit = (meters: number): number => 0.5 + meters / (2 * half);
  const places = plan.steps.filter(
    (step): step is Extract<typeof step, { operation: 'place' }> => step.operation === 'place',
  );
  const potential = plan.space?.potential ?? 'free';
  const metersOf = (value: NumberOrParameter | undefined): number => {
    const resolved = value === undefined ? 0 : asNumber(value, plan.parameters);
    return Number.isFinite(resolved) ? resolved : 0;
  };
  const [centerX, centerY] = project(0.5, 0.5, 0.5);
  return (
    <svg
      className="cube-preview"
      viewBox="0 0 280 240"
      role="img"
      aria-label={say('Превью куба с облаками', 'Preview of the cube with clouds')}
    >
      {potential === 'barrier' &&
        (() => {
          const slab = [
            project(0.5, 0, 0),
            project(0.5, 1, 0),
            project(0.5, 1, 1),
            project(0.5, 0, 1),
          ];
          return (
            <polygon
              className="cube-barrier"
              points={slab.map(([x, y]) => `${String(x)},${String(y)}`).join(' ')}
            />
          );
        })()}
      {potential === 'harmonic' && (
        <>
          <ellipse className="cube-trap" cx={centerX} cy={centerY} rx={60} ry={34} />
          <ellipse className="cube-trap" cx={centerX} cy={centerY} rx={35} ry={20} />
        </>
      )}
      {potential === 'doubleSlit' &&
        slitWallSpans(
          metersOf(plan.space?.slitSeparationInMeters),
          metersOf(plan.space?.slitWidthInMeters),
          half,
        ).map(([low, high]) => {
          const wall = [
            project(0.5, 0.5 + low / 2, 0),
            project(0.5, 0.5 + high / 2, 0),
            project(0.5, 0.5 + high / 2, 1),
            project(0.5, 0.5 + low / 2, 1),
          ];
          return (
            <polygon
              key={low}
              className="cube-barrier"
              points={wall.map(([x, y]) => `${String(x)},${String(y)}`).join(' ')}
            />
          );
        })}
      {potential === 'doubleWell' &&
        [-1, 1].map((side) => {
          const [x, y] = project(
            toUnit((side * metersOf(plan.space?.wellSeparationInMeters)) / 2),
            0.5,
            0.5,
          );
          return <ellipse key={side} className="cube-trap" cx={x} cy={y} rx={26} ry={16} />;
        })}
      {potential === 'box' &&
        edges.map(([first, second], index) => {
          const scale = metersOf(plan.space?.boxSizeInMeters) / (2 * half);
          const inner = (value: number): number => 0.5 + (value - 0.5) * 2 * scale;
          const [startX, startY] = project(inner(first[0]), inner(first[1]), inner(first[2]));
          const [endX, endY] = project(inner(second[0]), inner(second[1]), inner(second[2]));
          return (
            <line
              key={`box-${String(index)}`}
              className="cube-box"
              x1={startX}
              y1={startY}
              x2={endX}
              y2={endY}
            />
          );
        })}
      {edges.map(([first, second], index) => {
        const [startX, startY] = project(...first);
        const [endX, endY] = project(...second);
        return (
          <line key={index} className="cube-edge" x1={startX} y1={startY} x2={endX} y2={endY} />
        );
      })}
      {potential === 'coulomb' && (
        <circle className="cube-nucleus" cx={centerX} cy={centerY} r={5} />
      )}
      {places.map((step) => {
        const center = step.centerInMeters;
        const [x, y] = project(
          toUnit(asNumber(center.x, plan.parameters)),
          toUnit(asNumber(center.y, plan.parameters)),
          toUnit(asNumber(center.z, plan.parameters)),
        );
        const width = asNumber(step.widthInMeters, plan.parameters);
        const radius = Math.min(
          60,
          Math.max(6, (Number.isFinite(width) ? width / half : 0.1) * CUBE_SIZE * 0.6),
        );
        return (
          <g
            key={step.target}
            data-tooltip={`${step.target}: ${say('облако', 'cloud')} σ = ${formatLength(width)}`}
          >
            <circle
              className="cube-cloud"
              cx={Number.isFinite(x) ? x : centerX}
              cy={Number.isFinite(y) ? y : centerY}
              r={radius}
            />
            <text
              className="cube-cloud-label"
              x={Number.isFinite(x) ? x : centerX}
              y={(Number.isFinite(y) ? y : centerY) + 4}
              textAnchor="middle"
            >
              {step.target}
            </text>
          </g>
        );
      })}
      <text className="cube-axis" x={project(1.08, 0, 0)[0]} y={project(1.08, 0, 0)[1]}>
        x
      </text>
      <text className="cube-axis" x={project(0, 1.08, 0)[0]} y={project(0, 1.08, 0)[1]}>
        y
      </text>
      <text className="cube-axis" x={project(0, 0, 1.12)[0]} y={project(0, 0, 1.12)[1]}>
        z
      </text>
    </svg>
  );
}

export function SpaceCard({ plan, catalog, onChange }: Props) {
  const space = plan.space;
  if (space === undefined) {
    return (
      <section className="card">
        <div className="section-head">
          <h3
            data-tooltip={say(
              'Кубическая сетка, на которой частицы живут как облака вероятности',
              'The cubic grid on which particles live as probability clouds',
            )}
          >
            {say('Пространство', 'Space')}
          </h3>
          <button
            type="button"
            data-tooltip={say(
              'Добавить куб 32³ с ячейкой 50 пм и свободным пространством',
              'Add a 32³ cube with a 50 pm cell and free space',
            )}
            onClick={() => onChange({ ...plan, space: DEFAULT_SPACE })}
          >
            <SPACE_ICON aria-hidden="true" size={16} /> {say('Добавить пространство', 'Add space')}
          </button>
        </div>
        <p className="muted">
          {say(
            'Нужно для шагов «В куб», «Эволюция в кубе» и «Найти положение».',
            'Needed for the “Into cube”, “Evolve in cube” and “Find position” steps.',
          )}
        </p>
      </section>
    );
  }
  const set = (patch: Partial<SpaceSpec>): void =>
    onChange({ ...plan, space: { ...space, ...patch } });
  const cell = asNumber(space.cellSizeInMeters, plan.parameters);
  const edge = cell * space.gridPointsPerAxis;
  const parameters = Object.keys(plan.parameters);
  const numberField = (
    key:
      | 'potentialEnergyInEv'
      | 'barrierThicknessInMeters'
      | 'nuclearCharge'
      | 'slitSeparationInMeters'
      | 'slitWidthInMeters'
      | 'wellSeparationInMeters'
      | 'boxSizeInMeters',
    fallback: number,
    title: string,
  ) => (
    <label data-tooltip={key}>
      <FieldLabel icon={parameterIcon(key)}>{title}</FieldLabel>
      <NumberOrParameterInput
        value={space[key] ?? fallback}
        parameters={parameters}
        presets={presetsForParameter(catalog.presets, key)}
        onChange={(value) => set({ [key]: value })}
      />
    </label>
  );
  return (
    <section className="card">
      <div className="section-head">
        <h3
          data-tooltip={say(
            'Кубическая сетка, на которой частицы живут как облака вероятности',
            'The cubic grid on which particles live as probability clouds',
          )}
        >
          {say('Пространство', 'Space')}
        </h3>
        <button
          type="button"
          className="danger"
          data-tooltip={say('Убрать куб из плана', 'Remove the cube from the plan')}
          onClick={() => {
            const { space: removed, ...rest } = plan;
            void removed;
            onChange(rest);
          }}
        >
          {say('Убрать', 'Remove')}
        </button>
      </div>
      <div className="space-layout">
        <div className="form-grid compact">
          <label
            data-tooltip={say(
              'Ячеек на ребро: 32³ быстро, 64³ детальнее и медленнее',
              'Cells per edge: 32³ is fast, 64³ is finer and slower',
            )}
          >
            <FieldLabel icon={SPACE_ICON}>{say('Сетка', 'Grid')}</FieldLabel>
            <Select
              value={String(space.gridPointsPerAxis)}
              options={catalog.gridSizes.map(String)}
              labels={Object.fromEntries(
                catalog.gridSizes.map((size) => [String(size), `${String(size)}³`]),
              )}
              onChange={(value) => set({ gridPointsPerAxis: Number(value) })}
            />
          </label>
          <label
            data-tooltip={say(
              'Только рабочие масштабы: для электрона от 4 пм, для нуклонов от 2 фм',
              'Working scales only: from 4 pm for an electron, from 2 fm for nucleons',
            )}
          >
            <FieldLabel icon={parameterIcon('cellSizeInMeters')}>
              {say('Размер ячейки, м', 'Cell size, m')}
            </FieldLabel>
            <NumberOrParameterInput
              value={space.cellSizeInMeters}
              parameters={parameters}
              presets={presetsForParameter(catalog.presets, 'cellSizeInMeters')}
              onChange={(value) => set({ cellSizeInMeters: value })}
            />
          </label>
          <label data-tooltip={POTENTIAL_GLOSSARY[space.potential] ?? ''}>
            <FieldLabel icon={parameterIcon('potentialEnergyInEv')}>
              {say('Потенциал', 'Potential')}
            </FieldLabel>
            <Select
              value={space.potential}
              options={catalog.potentials}
              labels={POTENTIAL_GLOSSARY}
              onChange={(value) => set({ potential: value as PotentialKind })}
            />
          </label>
          {space.potential === 'barrier' &&
            numberField('potentialEnergyInEv', 10, say('Высота барьера, эВ', 'Barrier height, eV'))}
          {space.potential === 'barrier' &&
            numberField(
              'barrierThicknessInMeters',
              1e-10,
              say('Толщина барьера, м', 'Barrier thickness, m'),
            )}
          {space.potential === 'harmonic' &&
            numberField(
              'potentialEnergyInEv',
              1,
              say('Квант ловушки ħω, эВ', 'Trap quantum ħω, eV'),
            )}
          {space.potential === 'coulomb' &&
            numberField('nuclearCharge', 1, say('Заряд ядра Z', 'Nuclear charge Z'))}
          {space.potential === 'doubleSlit' && (
            <>
              {numberField('potentialEnergyInEv', 150, say('Высота стены, эВ', 'Wall height, eV'))}
              {numberField(
                'barrierThicknessInMeters',
                1e-10,
                say('Толщина стены, м', 'Wall thickness, m'),
              )}
              {numberField('slitWidthInMeters', 1e-10, say('Ширина щели, м', 'Slit width, m'))}
              {numberField(
                'slitSeparationInMeters',
                3e-10,
                say('Расстояние между щелями, м', 'Slit separation, m'),
              )}
            </>
          )}
          {space.potential === 'doubleWell' && (
            <>
              {numberField('potentialEnergyInEv', 6, say('Барьер V₀, эВ', 'Barrier V₀, eV'))}
              {numberField(
                'wellSeparationInMeters',
                5e-10,
                say('Расстояние между ямами 2a, м', 'Well separation 2a, m'),
              )}
            </>
          )}
          {space.potential === 'box' && (
            <>
              {numberField('potentialEnergyInEv', 240, say('Высота стенок, эВ', 'Wall height, eV'))}
              {numberField('boxSizeInMeters', 6.4e-10, say('Размер ящика L, м', 'Box size L, m'))}
            </>
          )}
          <p className="muted hint">
            {say(
              `Ребро куба ${formatLength(edge)}, всего ${String(space.gridPointsPerAxis ** 3)} ячеек. Края поглощают: ушедшее за них облако теряет вероятность.`,
              `Cube edge ${formatLength(edge)}, ${String(space.gridPointsPerAxis ** 3)} cells in total. The edges absorb: a cloud that leaves through them loses probability.`,
            )}
          </p>
        </div>
        <CubePreview plan={plan} half={edge / 2} />
      </div>
      <ScaleRuler
        cell={cell}
        grid={space.gridPointsPerAxis}
        catalog={catalog}
        onScale={(scale) => {
          const reference = space.cellSizeInMeters;
          if (typeof reference === 'string') {
            onChange({
              ...plan,
              parameters: { ...plan.parameters, [reference.slice(2, -2)]: scale.cellSizeInMeters },
              space: { ...space, gridPointsPerAxis: scale.gridPointsPerAxis },
            });
          } else {
            set(scale);
          }
        }}
      />
    </section>
  );
}
