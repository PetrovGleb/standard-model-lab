/* SpaceView: the cube of a system frame; a draggable 3D point cloud of each particle's probability density, three projections and the cloud statistics. */
import type { ProbabilityCloud, SpaceSnapshot } from '@standard-model/contracts';
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { formatLength, formatNumber } from '../format';
import { POTENTIAL_GLOSSARY } from '../glossary';
import { say } from '../language';

const WALL_STYLE = 'rgba(251, 146, 60, 0.45)';
const WELL_STYLE = 'rgba(167, 139, 250, 0.9)';
const WELL_MARK_RADIUS = 9;
const CANVAS_SIZE = 420;
const QUANTIZATION_LEVELS = 255;
const VISIBLE_THRESHOLD = 6;
const CAMERA_DISTANCE = 5;
const CLOUD_COLORS: ReadonlyArray<readonly [number, number, number]> = [
  [45, 212, 191],
  [251, 191, 36],
  [244, 114, 182],
  [129, 140, 248],
];
const HEAT_STOPS: ReadonlyArray<readonly [number, number, number]> = [
  [8, 20, 24],
  [13, 116, 110],
  [45, 212, 191],
  [236, 254, 255],
];

interface Rotation {
  readonly yaw: number;
  readonly pitch: number;
}

interface ProjectedPoint {
  readonly x: number;
  readonly y: number;
  readonly depth: number;
}

function projectPoint(x: number, y: number, z: number, rotation: Rotation): ProjectedPoint {
  const cosYaw = Math.cos(rotation.yaw);
  const sinYaw = Math.sin(rotation.yaw);
  const turnedX = x * cosYaw + z * sinYaw;
  const turnedZ = -x * sinYaw + z * cosYaw;
  const cosPitch = Math.cos(rotation.pitch);
  const sinPitch = Math.sin(rotation.pitch);
  const tiltedY = y * cosPitch - turnedZ * sinPitch;
  const depth = y * sinPitch + turnedZ * cosPitch;
  const perspective = CAMERA_DISTANCE / (CAMERA_DISTANCE + depth);
  const scale = CANVAS_SIZE * 0.24 * perspective;
  return { x: CANVAS_SIZE / 2 + turnedX * scale, y: CANVAS_SIZE / 2 - tiltedY * scale, depth };
}

export function slitWallSpans(
  separationInMeters: number,
  slitWidthInMeters: number,
  halfEdgeInMeters: number,
): readonly (readonly [number, number])[] {
  const inner = (separationInMeters / 2 - slitWidthInMeters / 2) / halfEdgeInMeters;
  const outer = (separationInMeters / 2 + slitWidthInMeters / 2) / halfEdgeInMeters;
  return [
    [-1, -outer],
    [-inner, inner],
    [outer, 1],
  ];
}

function fillPolygon(
  context: CanvasRenderingContext2D,
  points: readonly ProjectedPoint[],
  style: string,
): void {
  context.fillStyle = style;
  context.beginPath();
  points.forEach((point, index) =>
    index === 0 ? context.moveTo(point.x, point.y) : context.lineTo(point.x, point.y),
  );
  context.closePath();
  context.fill();
}

function cubeEdges(): ReadonlyArray<readonly [readonly number[], readonly number[]]> {
  const corners = [-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z) => [x, y, z])));
  return corners.flatMap((first, index) =>
    corners
      .slice(index + 1)
      .filter((second) => first.filter((value, axis) => value !== second[axis]).length === 1)
      .map((second) => [first, second] as const),
  );
}

function drawCube(
  context: CanvasRenderingContext2D,
  space: SpaceSnapshot,
  rotation: Rotation,
): void {
  context.globalCompositeOperation = 'source-over';
  context.fillStyle = '#071214';
  context.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  if (space.potential === 'barrier') {
    const slab = [
      [0, -1, -1],
      [0, 1, -1],
      [0, 1, 1],
      [0, -1, 1],
    ].map(([x, y, z]) => projectPoint(x ?? 0, y ?? 0, z ?? 0, rotation));
    context.fillStyle = 'rgba(251, 146, 60, 0.18)';
    context.beginPath();
    slab.forEach((point, index) =>
      index === 0 ? context.moveTo(point.x, point.y) : context.lineTo(point.x, point.y),
    );
    context.closePath();
    context.fill();
  }
  const halfEdge = space.edgeInMeters / 2;
  if (space.potential === 'doubleSlit') {
    slitWallSpans(
      space.slitSeparationInMeters ?? 0,
      space.slitWidthInMeters ?? 0,
      halfEdge,
    ).forEach(([low, high]) =>
      fillPolygon(
        context,
        [
          [0, low, -1],
          [0, high, -1],
          [0, high, 1],
          [0, low, 1],
        ].map(([x, y, z]) => projectPoint(x ?? 0, y ?? 0, z ?? 0, rotation)),
        WALL_STYLE,
      ),
    );
  }
  if (space.potential === 'doubleWell') {
    const offset = (space.wellSeparationInMeters ?? 0) / 2 / halfEdge;
    [-offset, offset].forEach((x) => {
      const well = projectPoint(x, 0, 0, rotation);
      context.strokeStyle = WELL_STYLE;
      context.beginPath();
      context.arc(well.x, well.y, WELL_MARK_RADIUS, 0, Math.PI * 2);
      context.stroke();
    });
  }
  if (space.potential === 'box') {
    const size = (space.boxSizeInMeters ?? 0) / 2 / halfEdge;
    context.strokeStyle = WALL_STYLE;
    cubeEdges().forEach(([first, second]) => {
      const start = projectPoint(
        (first[0] ?? 0) * size,
        (first[1] ?? 0) * size,
        (first[2] ?? 0) * size,
        rotation,
      );
      const end = projectPoint(
        (second[0] ?? 0) * size,
        (second[1] ?? 0) * size,
        (second[2] ?? 0) * size,
        rotation,
      );
      context.beginPath();
      context.moveTo(start.x, start.y);
      context.lineTo(end.x, end.y);
      context.stroke();
    });
  }
  if (space.potential === 'coulomb') {
    const nucleus = projectPoint(0, 0, 0, rotation);
    context.fillStyle = 'rgba(248, 113, 113, 0.9)';
    context.beginPath();
    context.arc(nucleus.x, nucleus.y, 3.5, 0, Math.PI * 2);
    context.fill();
  }
  context.strokeStyle = 'rgba(148, 197, 194, 0.35)';
  context.lineWidth = 1;
  cubeEdges().forEach(([first, second]) => {
    const start = projectPoint(first[0] ?? 0, first[1] ?? 0, first[2] ?? 0, rotation);
    const end = projectPoint(second[0] ?? 0, second[1] ?? 0, second[2] ?? 0, rotation);
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    context.stroke();
  });
  context.fillStyle = 'rgba(148, 197, 194, 0.8)';
  context.font = '12px ui-monospace, monospace';
  (
    [
      ['x', 1.18, -1, -1],
      ['y', -1, 1.18, -1],
      ['z', -1, -1, 1.18],
    ] as const
  ).forEach(([name, x, y, z]) => {
    const point = projectPoint(x, y, z, rotation);
    context.fillText(name, point.x - 3, point.y + 4);
  });
}

function drawClouds(
  context: CanvasRenderingContext2D,
  clouds: readonly ProbabilityCloud[],
  rotation: Rotation,
): void {
  context.globalCompositeOperation = 'lighter';
  clouds.forEach((cloud, cloudIndex) => {
    const [red, green, blue] = CLOUD_COLORS[cloudIndex % CLOUD_COLORS.length] ?? [45, 212, 191];
    const size = cloud.resolution;
    cloud.density.forEach((value, index) => {
      if (value < VISIBLE_THRESHOLD) {
        return;
      }
      const weight = value / QUANTIZATION_LEVELS;
      const toUnit = (cell: number): number => ((cell + 0.5) / size) * 2 - 1;
      const point = projectPoint(
        toUnit(index % size),
        toUnit(Math.floor(index / size) % size),
        toUnit(Math.floor(index / (size * size))),
        rotation,
      );
      const radius = 8 + 9 * Math.sqrt(weight);
      const glow = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius);
      glow.addColorStop(
        0,
        `rgba(${String(red)}, ${String(green)}, ${String(blue)}, ${String(0.025 + 0.2 * weight)})`,
      );
      glow.addColorStop(1, `rgba(${String(red)}, ${String(green)}, ${String(blue)}, 0)`);
      context.fillStyle = glow;
      context.beginPath();
      context.arc(point.x, point.y, radius, 0, Math.PI * 2);
      context.fill();
    });
  });
}

function heatColor(value: number): readonly [number, number, number] {
  const scaled = (value / QUANTIZATION_LEVELS) * (HEAT_STOPS.length - 1);
  const lower = Math.min(Math.floor(scaled), HEAT_STOPS.length - 2);
  const fraction = scaled - lower;
  const [fromRed, fromGreen, fromBlue] = HEAT_STOPS[lower] ?? [0, 0, 0];
  const [upperRed, upperGreen, upperBlue] = HEAT_STOPS[lower + 1] ?? [0, 0, 0];
  const blend = (from: number, upper: number): number =>
    Math.round(from + (upper - from) * fraction);
  return [blend(fromRed, upperRed), blend(fromGreen, upperGreen), blend(fromBlue, upperBlue)];
}

function Projection({
  values,
  size,
  title,
  horizontal,
  vertical,
}: {
  readonly values: readonly number[];
  readonly size: number;
  readonly title: string;
  readonly horizontal: string;
  readonly vertical: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const context = canvas.current?.getContext('2d');
    if (context === null || context === undefined) {
      return;
    }
    const image = context.createImageData(size, size);
    values.forEach((value, index) => {
      const column = index % size;
      const row = size - 1 - Math.floor(index / size);
      const [red, green, blue] = heatColor(value);
      const offset = 4 * (column + size * row);
      image.data[offset] = red;
      image.data[offset + 1] = green;
      image.data[offset + 2] = blue;
      image.data[offset + 3] = 255;
    });
    context.putImageData(image, 0, 0);
  }, [values, size]);
  return (
    <figure
      className="projection"
      data-tooltip={`${say('Плотность вероятности, просуммированная вдоль третьей оси', 'Probability density summed along the third axis')}: ${title}`}
    >
      <canvas ref={canvas} width={size} height={size} />
      <figcaption>
        {title}{' '}
        <span className="muted">
          →{horizontal} ↑{vertical}
        </span>
      </figcaption>
    </figure>
  );
}

function formatVector(vector: {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}): string {
  return `(${formatLength(vector.x)}, ${formatLength(vector.y)}, ${formatLength(vector.z)})`;
}

export function SpaceView({ space }: { readonly space: SpaceSnapshot }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [rotation, setRotation] = useState<Rotation>({ yaw: 0.6, pitch: 0.45 });
  const [selected, setSelected] = useState(0);
  const cloud = space.clouds[Math.min(selected, space.clouds.length - 1)];

  useEffect(() => {
    const context = canvas.current?.getContext('2d');
    if (context === null || context === undefined) {
      return;
    }
    drawCube(context, space, rotation);
    drawClouds(context, space.clouds, rotation);
  }, [space, rotation]);

  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>): void => {
    if (drag.current === null) {
      return;
    }
    const deltaX = event.clientX - drag.current.x;
    const deltaY = event.clientY - drag.current.y;
    drag.current = { x: event.clientX, y: event.clientY };
    setRotation((current) => ({
      yaw: current.yaw + deltaX * 0.01,
      pitch: Math.max(-1.4, Math.min(1.4, current.pitch + deltaY * 0.01)),
    }));
  };

  return (
    <div className="space-view">
      <div className="space-view-head">
        <strong>{say('Куб', 'Cube')}</strong>
        <span className="muted">
          {say('ребро', 'edge')} {formatLength(space.edgeInMeters)} · {space.gridPointsPerAxis}³{' '}
          {say('ячеек по', 'cells of')} {formatLength(space.cellSizeInMeters)} ·{' '}
          {POTENTIAL_GLOSSARY[space.potential] ?? space.potential}
        </span>
      </div>
      {space.clouds.length === 0 ? (
        <p className="muted">{say('В кубе пока нет частиц.', 'No particles in the cube yet.')}</p>
      ) : (
        <div className="space-view-body">
          <canvas
            ref={canvas}
            className="space-canvas"
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
            aria-label={say(
              'Облака вероятности в кубе; перетащите, чтобы повернуть',
              'Probability clouds in the cube; drag to rotate',
            )}
            data-tooltip={say('Перетащите, чтобы повернуть куб', 'Drag to rotate the cube')}
            onPointerDown={(event) => {
              drag.current = { x: event.clientX, y: event.clientY };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={onPointerMove}
            onPointerUp={() => {
              drag.current = null;
            }}
          />
          <div className="space-side">
            {space.clouds.length > 1 && (
              <div className="cloud-tabs">
                {space.clouds.map((item, index) => (
                  <button
                    key={item.label}
                    type="button"
                    className={index === selected ? 'cloud-tab active' : 'cloud-tab'}
                    style={
                      {
                        '--cloud': `rgb(${(CLOUD_COLORS[index % CLOUD_COLORS.length] ?? []).join(',')})`,
                      } as CSSProperties
                    }
                    onClick={() => setSelected(index)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
            {cloud !== undefined && (
              <>
                <div className="projections">
                  <Projection
                    values={cloud.projectionXy}
                    size={cloud.projectionResolution}
                    title="xy"
                    horizontal="x"
                    vertical="y"
                  />
                  <Projection
                    values={cloud.projectionXz}
                    size={cloud.projectionResolution}
                    title="xz"
                    horizontal="x"
                    vertical="z"
                  />
                  <Projection
                    values={cloud.projectionYz}
                    size={cloud.projectionResolution}
                    title="yz"
                    horizontal="y"
                    vertical="z"
                  />
                </div>
                <dl className="cloud-stats">
                  <dt data-tooltip={say('Среднее положение облака', 'Mean position of the cloud')}>
                    ⟨r⟩
                  </dt>
                  <dd>{formatVector(cloud.meanPositionInMeters)}</dd>
                  <dt
                    data-tooltip={say(
                      'Ширина облака по осям, стандартное отклонение',
                      'Cloud width along the axes, standard deviation',
                    )}
                  >
                    σ
                  </dt>
                  <dd>{formatVector(cloud.spreadInMeters)}</dd>
                  <dt
                    data-tooltip={say(
                      'Средняя энергия: кинетическая плюс потенциальная',
                      'Mean energy: kinetic plus potential',
                    )}
                  >
                    E
                  </dt>
                  <dd>
                    {formatNumber(cloud.energyInEv)} {say('эВ', 'eV')}
                  </dd>
                  <dt
                    data-tooltip={say(
                      'Сколько вероятности осталось внутри куба; остальное поглотили края',
                      'How much probability is left inside the cube; the edges absorbed the rest',
                    )}
                  >
                    {say('P внутри', 'P inside')}
                  </dt>
                  <dd>{formatNumber(cloud.probabilityInside * 100)}%</dd>
                </dl>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
