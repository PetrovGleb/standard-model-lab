/* SpaceView: the cube of a system frame in one draggable 3D scene: its walls (open or mirror), the bodies of media placed in it, every point particle with a trail from the previous frame and
   a flash where it was born, the probability cloud of each particle held as a wave with three projections and statistics, a legend of particles and bodies; hovering a particle shows a
   chip, a click opens an inspector with the cube (the particle highlighted), its card as in the system state and the other particles to switch to. */
import type {
  BodyGeometry,
  ParticleView,
  ProbabilityCloud,
  SpaceSnapshot,
  SystemFrame,
} from '@standard-model/contracts';
import {
  cubeBodies,
  cubePoints,
  dragged,
  heightOf,
  insideUnitCube,
  multiplied,
  oriented,
  rotationAbout,
  type CubeAxis,
  type CubeBody,
  type CubePoint,
  type Orientation,
  type PointTone,
} from '../cube-scene';
import { ZoomToolbar } from './zoom-toolbar';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { kindWord } from '../particle-text';
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { formatLength, formatNumber, formatSymbol } from '../format';
import { POTENTIAL_GLOSSARY, bodyShapeText } from '../glossary';
import { say } from '../language';

const WALL_STYLE = 'rgba(251, 146, 60, 0.45)';
const WELL_STYLE = 'rgba(167, 139, 250, 0.9)';
const WELL_MARK_RADIUS = 9;
const CANVAS_SIZE = 520;
const QUANTIZATION_LEVELS = 255;
const VISIBLE_THRESHOLD = 6;
const CAMERA_DISTANCE = 5;
const MIRROR_STYLE = 'rgba(226, 232, 240, 0.85)';
const MIRROR_FACE_STYLE = 'rgba(226, 232, 240, 0.05)';
const OPEN_EDGE_STYLE = 'rgba(148, 197, 194, 0.35)';
const TRAIL_STYLE = 'rgba(148, 163, 184, 0.35)';
const BORN_RING_RADIUS = 7;
const HIGHLIGHT_RADIUS = 9;
const HIGHLIGHT_STYLE = '#ffffff';
const DIMMED_OPACITY = 0.45;
const CLICK_TOLERANCE_IN_PIXELS = 4;
const HOVER_RADIUS = 10;
const CHIP_OFFSET = 14;
const DEFAULT_YAW_IN_RADIANS = 0.6;
const DEFAULT_PITCH_IN_RADIANS = 0.45;
const WHEEL_ZOOM_RATE = 0.0015;
const MINIMUM_CUBE_ZOOM = 0.4;
const MAXIMUM_CUBE_ZOOM = 8;
const RADIANS_PER_DEGREE = Math.PI / 180;
const DRAG_RADIANS_PER_PIXEL = 0.01;
const TURN_STEP_IN_DEGREES = 10;
const TURN_DURATION_IN_MILLISECONDS = 220;
const TURN_EASING_EXPONENT = 3;
const TURN_SIGNS = [1, -1] as const;
const CUBE_AXES: readonly CubeAxis[] = ['x', 'y', 'z'];
const MAXIMUM_TRAIL_IN_HALF_EDGES = 1;
const BODY_FILL_ALPHA = 0.14;
const BODY_EDGE_ALPHA = 0.7;
const CYLINDER_SEGMENTS = 32;
const CYLINDER_SIDE_EVERY = 8;
const SCENE_SCALE = 0.24;
const POINT_STYLES: Readonly<
  Record<PointTone, { readonly color: string; readonly radius: number }>
> = {
  neutron: { color: '#60a5fa', radius: 2.6 },
  nucleus: { color: '#fb923c', radius: 3.6 },
  photon: { color: '#fde047', radius: 2.2 },
  lepton: { color: '#4ade80', radius: 2.2 },
  other: { color: '#cbd5e1', radius: 2.4 },
};
const BODY_COLORS: ReadonlyArray<readonly [number, number, number]> = [
  [167, 139, 250],
  [45, 212, 191],
  [244, 114, 182],
  [163, 230, 53],
];
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

interface Camera {
  readonly orientation: Orientation;
  readonly zoom: number;
  readonly panX: number;
  readonly panY: number;
}

const DEFAULT_CAMERA: Camera = {
  orientation: multiplied(
    rotationAbout('x', DEFAULT_PITCH_IN_RADIANS),
    rotationAbout('y', DEFAULT_YAW_IN_RADIANS),
  ),
  zoom: 1,
  panX: 0,
  panY: 0,
};

interface ProjectedPoint {
  readonly x: number;
  readonly y: number;
  readonly depth: number;
}

function projectPoint(x: number, y: number, z: number, camera: Camera): ProjectedPoint {
  const turned = oriented(camera.orientation, { x, y, z });
  const scale = scaleAt(turned.z, camera);
  return {
    x: CANVAS_SIZE / 2 + camera.panX + turned.x * scale,
    y: CANVAS_SIZE / 2 + camera.panY - turned.y * scale,
    depth: turned.z,
  };
}

function scaleAt(depth: number, camera: Camera): number {
  return (CANVAS_SIZE * SCENE_SCALE * CAMERA_DISTANCE * camera.zoom) / (CAMERA_DISTANCE + depth);
}

function rgba(color: readonly [number, number, number], opacity: number): string {
  return `rgba(${color.join(', ')}, ${String(opacity)})`;
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

function drawCube(context: CanvasRenderingContext2D, space: SpaceSnapshot, camera: Camera): void {
  context.globalCompositeOperation = 'source-over';
  context.fillStyle = '#071214';
  context.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  if (space.potential === 'barrier') {
    const slab = [
      [0, -1, -1],
      [0, 1, -1],
      [0, 1, 1],
      [0, -1, 1],
    ].map(([x, y, z]) => projectPoint(x ?? 0, y ?? 0, z ?? 0, camera));
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
        ].map(([x, y, z]) => projectPoint(x ?? 0, y ?? 0, z ?? 0, camera)),
        WALL_STYLE,
      ),
    );
  }
  if (space.potential === 'doubleWell') {
    const offset = (space.wellSeparationInMeters ?? 0) / 2 / halfEdge;
    [-offset, offset].forEach((x) => {
      const well = projectPoint(x, 0, 0, camera);
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
        camera,
      );
      const end = projectPoint(
        (second[0] ?? 0) * size,
        (second[1] ?? 0) * size,
        (second[2] ?? 0) * size,
        camera,
      );
      context.beginPath();
      context.moveTo(start.x, start.y);
      context.lineTo(end.x, end.y);
      context.stroke();
    });
  }
  if (space.potential === 'coulomb') {
    const nucleus = projectPoint(0, 0, 0, camera);
    context.fillStyle = 'rgba(248, 113, 113, 0.9)';
    context.beginPath();
    context.arc(nucleus.x, nucleus.y, 3.5, 0, Math.PI * 2);
    context.fill();
  }
  const mirror = space.walls === 'reflecting';
  if (mirror) {
    (
      [
        [
          [-1, -1, -1],
          [1, -1, -1],
          [1, 1, -1],
          [-1, 1, -1],
        ],
        [
          [-1, -1, -1],
          [-1, 1, -1],
          [-1, 1, 1],
          [-1, -1, 1],
        ],
        [
          [-1, -1, -1],
          [1, -1, -1],
          [1, -1, 1],
          [-1, -1, 1],
        ],
      ] as const
    ).forEach((face) =>
      fillPolygon(
        context,
        face.map(([x, y, z]) => projectPoint(x, y, z, camera)),
        MIRROR_FACE_STYLE,
      ),
    );
  }
  context.strokeStyle = mirror ? MIRROR_STYLE : OPEN_EDGE_STYLE;
  context.lineWidth = mirror ? 1.6 : 1;
  cubeEdges().forEach(([first, second]) => {
    const start = projectPoint(first[0] ?? 0, first[1] ?? 0, first[2] ?? 0, camera);
    const end = projectPoint(second[0] ?? 0, second[1] ?? 0, second[2] ?? 0, camera);
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
    const point = projectPoint(x, y, z, camera);
    context.fillText(name, point.x - 3, point.y + 4);
  });
}

function shapeText(geometry: BodyGeometry): string {
  return bodyShapeText(
    geometry.shape,
    formatLength(geometry.sizeInMeters),
    geometry.shape === 'cylinder' ? formatLength(heightOf(geometry)) : undefined,
  );
}

function drawBodies(
  context: CanvasRenderingContext2D,
  bodies: readonly CubeBody[],
  halfEdgeInMeters: number,
  camera: Camera,
): void {
  context.globalCompositeOperation = 'source-over';
  bodies.forEach((body, order) => {
    const color = BODY_COLORS[order % BODY_COLORS.length] ?? [251, 146, 60];
    const center = body.geometry.centerInMeters;
    const half = body.geometry.sizeInMeters / 2 / halfEdgeInMeters;
    const middle = {
      x: center.x / halfEdgeInMeters,
      y: center.y / halfEdgeInMeters,
      z: center.z / halfEdgeInMeters,
    };
    context.strokeStyle = rgba(color, BODY_EDGE_ALPHA);
    context.lineWidth = 1.2;
    if (body.geometry.shape === 'ball') {
      const projected = projectPoint(middle.x, middle.y, middle.z, camera);
      const radius = half * scaleAt(projected.depth, camera);
      const glow = context.createRadialGradient(
        projected.x - radius / 3,
        projected.y - radius / 3,
        radius / 8,
        projected.x,
        projected.y,
        radius,
      );
      glow.addColorStop(0, rgba(color, BODY_FILL_ALPHA * 2));
      glow.addColorStop(1, rgba(color, BODY_FILL_ALPHA / 2));
      context.fillStyle = glow;
      context.beginPath();
      context.arc(projected.x, projected.y, radius, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      return;
    }
    if (body.geometry.shape === 'cylinder') {
      const halfHeight = heightOf(body.geometry) / 2 / halfEdgeInMeters;
      const ring = (level: number) =>
        Array.from({ length: CYLINDER_SEGMENTS }, (unused, index) => {
          const angle = (2 * Math.PI * index) / CYLINDER_SEGMENTS;
          return projectPoint(
            middle.x + half * Math.cos(angle),
            middle.y + half * Math.sin(angle),
            middle.z + level,
            camera,
          );
        });
      const bottom = ring(-halfHeight);
      const top = ring(halfHeight);
      fillPolygon(context, bottom, rgba(color, BODY_FILL_ALPHA));
      fillPolygon(context, top, rgba(color, BODY_FILL_ALPHA / 2));
      [bottom, top].forEach((points) => {
        context.beginPath();
        points.forEach((point, index) =>
          index === 0 ? context.moveTo(point.x, point.y) : context.lineTo(point.x, point.y),
        );
        context.closePath();
        context.stroke();
      });
      bottom.forEach((point, index) => {
        const upper = top[index];
        if (index % CYLINDER_SIDE_EVERY === 0 && upper !== undefined) {
          context.beginPath();
          context.moveTo(point.x, point.y);
          context.lineTo(upper.x, upper.y);
          context.stroke();
        }
      });
      return;
    }
    cubeEdges().forEach(([first, second]) => {
      const start = projectPoint(
        middle.x + (first[0] ?? 0) * half,
        middle.y + (first[1] ?? 0) * half,
        middle.z + (first[2] ?? 0) * half,
        camera,
      );
      const end = projectPoint(
        middle.x + (second[0] ?? 0) * half,
        middle.y + (second[1] ?? 0) * half,
        middle.z + (second[2] ?? 0) * half,
        camera,
      );
      context.beginPath();
      context.moveTo(start.x, start.y);
      context.lineTo(end.x, end.y);
      context.stroke();
    });
    fillPolygon(
      context,
      [
        [-1, -1, -1],
        [1, -1, -1],
        [1, 1, -1],
        [-1, 1, -1],
      ].map(([x, y, z]) =>
        projectPoint(
          middle.x + (x ?? 0) * half,
          middle.y + (y ?? 0) * half,
          middle.z + (z ?? 0) * half,
          camera,
        ),
      ),
      rgba(color, BODY_FILL_ALPHA / 2),
    );
  });
}

interface ScreenPoint {
  readonly id: string;
  readonly x: number;
  readonly y: number;
}

function drawPoints(
  context: CanvasRenderingContext2D,
  points: readonly CubePoint[],
  camera: Camera,
  highlightId: string | null,
): readonly ScreenPoint[] {
  context.globalCompositeOperation = 'source-over';
  const drawn: ScreenPoint[] = [];
  points
    .filter((point) => insideUnitCube(point.at))
    .map((point) => ({
      point,
      projected: projectPoint(point.at.x, point.at.y, point.at.z, camera),
    }))
    .sort((first, second) => second.projected.depth - first.projected.depth)
    .forEach(({ point, projected }) => {
      const style = POINT_STYLES[point.tone];
      const before = point.before;
      if (
        before !== null &&
        Math.hypot(point.at.x - before.x, point.at.y - before.y, point.at.z - before.z) <
          MAXIMUM_TRAIL_IN_HALF_EDGES
      ) {
        const start = projectPoint(before.x, before.y, before.z, camera);
        context.strokeStyle = TRAIL_STYLE;
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(start.x, start.y);
        context.lineTo(projected.x, projected.y);
        context.stroke();
      }
      if (point.born) {
        context.strokeStyle = style.color;
        context.lineWidth = 1;
        context.beginPath();
        context.arc(projected.x, projected.y, BORN_RING_RADIUS, 0, Math.PI * 2);
        context.stroke();
      }
      const dimmed = highlightId !== null && point.id !== highlightId;
      context.globalAlpha = dimmed ? DIMMED_OPACITY : 1;
      context.fillStyle = style.color;
      context.beginPath();
      context.arc(projected.x, projected.y, style.radius, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;
      if (point.id === highlightId) {
        context.strokeStyle = HIGHLIGHT_STYLE;
        context.lineWidth = 2;
        context.beginPath();
        context.arc(projected.x, projected.y, HIGHLIGHT_RADIUS, 0, Math.PI * 2);
        context.stroke();
      }
      drawn.push({ id: point.id, x: projected.x, y: projected.y });
    });
  return drawn;
}

function drawClouds(
  context: CanvasRenderingContext2D,
  clouds: readonly ProbabilityCloud[],
  camera: Camera,
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
        camera,
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

const TONE_NAMES: Readonly<Record<PointTone, readonly [string, string]>> = {
  neutron: ['нейтроны', 'neutrons'],
  nucleus: ['ядра и атомы', 'nuclei and atoms'],
  photon: ['фотоны', 'photons'],
  lepton: ['лептоны', 'leptons'],
  other: ['другие', 'others'],
};

function SceneLegend({
  points,
  bodies,
  pendingNeutrons,
  symbolOf,
}: {
  readonly points: readonly CubePoint[];
  readonly bodies: readonly CubeBody[];
  readonly pendingNeutrons: number;
  readonly symbolOf: (name: string) => string;
}) {
  const inside = points.filter((point) => insideUnitCube(point.at));
  const tones = (Object.keys(POINT_STYLES) as PointTone[]).filter((tone) =>
    inside.some((point) => point.tone === tone),
  );
  return (
    <div className="cube-legend">
      {tones.map((tone) => (
        <span key={tone} className="cube-legend-row">
          <i style={{ background: POINT_STYLES[tone].color }} />
          {say(...TONE_NAMES[tone])} <b>{inside.filter((point) => point.tone === tone).length}</b>
        </span>
      ))}
      {points.length > inside.length && (
        <span
          className="cube-legend-row muted"
          data-tooltip={say(
            'Частицы, вылетевшие через открытые стенки куба',
            'Particles that left through the open walls of the cube',
          )}
        >
          {say('вылетели из куба', 'left the cube')} <b>{points.length - inside.length}</b>
        </span>
      )}
      {pendingNeutrons > 0 && (
        <span
          className="cube-legend-row muted"
          data-tooltip={say(
            'Осколки деления, которые еще не распались: каждый испустит запаздывающий нейтрон через секунды. Эти нейтроны делают реактор управляемым',
            'Fission fragments that have not decayed yet: each will emit a delayed neutron seconds later. These neutrons make a reactor controllable',
          )}
        >
          {say('ждут запаздывающие нейтроны', 'delayed neutrons pending')} <b>{pendingNeutrons}</b>
        </span>
      )}
      {bodies.map((body, order) => (
        <span
          key={body.index}
          className="cube-legend-row"
          data-tooltip={say(
            'Тело среды в кубе: форма, размер, состав, температура и поглощенная энергия',
            'A body of a medium in the cube: shape, size, composition, temperature and absorbed energy',
          )}
        >
          <i
            className="cube-legend-body"
            style={{ background: rgba(BODY_COLORS[order % BODY_COLORS.length] ?? [0, 0, 0], 0.8) }}
          />
          {body.medium.name === undefined ? '' : `${body.medium.name} · `}
          {shapeText(body.geometry)} ·{' '}
          {body.medium.components.map((component) => symbolOf(component.species)).join(' + ')} ·{' '}
          {formatNumber(body.medium.temperatureInKelvin)} {say('К', 'K')}
          {(body.medium.absorbedEnergyInJoules ?? 0) > 0 &&
            ` · ${formatNumber(body.medium.absorbedEnergyInJoules)} ${say('Дж', 'J')}`}
        </span>
      ))}
    </div>
  );
}

interface Spin {
  readonly axis: CubeAxis;
  readonly angle: number;
  readonly startInMilliseconds: number;
  done: number;
}

function easedTurn(progress: number): number {
  const clamped = Math.min(Math.max(progress, 0), 1);
  return 1 - (1 - clamped) ** TURN_EASING_EXPONENT;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function CubeCanvas({
  space,
  frame,
  previous,
  highlightId = null,
  onPick,
}: {
  readonly space: SpaceSnapshot;
  readonly frame: SystemFrame;
  readonly previous?: SystemFrame | undefined;
  readonly highlightId?: string | null;
  readonly onPick?: (id: string) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const pressed = useRef<{ x: number; y: number } | null>(null);
  const screen = useRef<readonly ScreenPoint[]>([]);
  const [hovered, setHovered] = useState<{
    readonly id: string;
    readonly x: number;
    readonly y: number;
  } | null>(null);
  const [camera, setCamera] = useState<Camera>(DEFAULT_CAMERA);
  const bodies = cubeBodies(frame);
  const points = cubePoints(space, frame, previous);
  const zoomAround = (factor: number, canvasX: number, canvasY: number): void =>
    setCamera((current) => {
      const zoom = Math.min(MAXIMUM_CUBE_ZOOM, Math.max(MINIMUM_CUBE_ZOOM, current.zoom * factor));
      const applied = zoom / current.zoom;
      const offsetX = canvasX - CANVAS_SIZE / 2;
      const offsetY = canvasY - CANVAS_SIZE / 2;
      return {
        ...current,
        zoom,
        panX: offsetX - applied * (offsetX - current.panX),
        panY: offsetY - applied * (offsetY - current.panY),
      };
    });
  const spins = useRef<Spin[]>([]);
  const frameRequest = useRef<number | null>(null);
  const spin = (now: number): void => {
    const steps = spins.current.map((current) => {
      const eased = easedTurn((now - current.startInMilliseconds) / TURN_DURATION_IN_MILLISECONDS);
      const step = { axis: current.axis, angle: current.angle * (eased - current.done) };
      current.done = eased;
      return step;
    });
    spins.current = spins.current.filter((current) => current.done < 1);
    setCamera((current) => ({
      ...current,
      orientation: steps.reduce(
        (orientation, step) => multiplied(orientation, rotationAbout(step.axis, step.angle)),
        current.orientation,
      ),
    }));
    frameRequest.current = spins.current.length > 0 ? requestAnimationFrame(spin) : null;
  };
  const turn = (axis: CubeAxis, sign: number): void => {
    const angle = sign * TURN_STEP_IN_DEGREES * RADIANS_PER_DEGREE;
    if (prefersReducedMotion()) {
      setCamera((current) => ({
        ...current,
        orientation: multiplied(current.orientation, rotationAbout(axis, angle)),
      }));
      return;
    }
    spins.current = [
      ...spins.current,
      { axis, angle, startInMilliseconds: performance.now(), done: 0 },
    ];
    if (frameRequest.current === null) {
      frameRequest.current = requestAnimationFrame(spin);
    }
  };
  useEffect(
    () => () => {
      if (frameRequest.current !== null) {
        cancelAnimationFrame(frameRequest.current);
      }
    },
    [],
  );
  useEffect(() => {
    const element = canvas.current;
    if (element === null) {
      return undefined;
    }
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault();
      const bounds = element.getBoundingClientRect();
      zoomAround(
        Math.exp(-event.deltaY * WHEEL_ZOOM_RATE),
        ((event.clientX - bounds.left) * CANVAS_SIZE) / bounds.width,
        ((event.clientY - bounds.top) * CANVAS_SIZE) / bounds.height,
      );
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  });

  useEffect(() => {
    const context = canvas.current?.getContext('2d');
    if (context === null || context === undefined) {
      return;
    }
    drawCube(context, space, camera);
    drawBodies(context, bodies, space.edgeInMeters / 2, camera);
    drawClouds(context, space.clouds, camera);
    screen.current = drawPoints(context, points, camera, highlightId);
  }, [space, frame, previous, camera, highlightId]);

  const nearestAt = (event: PointerEvent<HTMLCanvasElement>): string | null => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) * CANVAS_SIZE) / bounds.width;
    const y = ((event.clientY - bounds.top) * CANVAS_SIZE) / bounds.height;
    return (
      screen.current.reduce<{ id: string; distance: number } | null>((best, point) => {
        const distance = Math.hypot(point.x - x, point.y - y);
        return distance <= HOVER_RADIUS && (best === null || distance < best.distance)
          ? { id: point.id, distance }
          : best;
      }, null)?.id ?? null
    );
  };
  const hoveredView =
    hovered === null ? undefined : frame.particles.find((view) => view.id === hovered.id);

  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>): void => {
    if (drag.current === null) {
      const id = nearestAt(event);
      setHovered(id === null ? null : { id, x: event.clientX, y: event.clientY });
      return;
    }
    const deltaX = event.clientX - drag.current.x;
    const deltaY = event.clientY - drag.current.y;
    drag.current = { x: event.clientX, y: event.clientY };
    const bounds = event.currentTarget.getBoundingClientRect();
    const pixels = CANVAS_SIZE / bounds.width;
    const rotating = event.metaKey || event.ctrlKey;
    setCamera((current) =>
      rotating
        ? {
            ...current,
            orientation: dragged(
              current.orientation,
              deltaX * DRAG_RADIANS_PER_PIXEL,
              deltaY * DRAG_RADIANS_PER_PIXEL,
            ),
          }
        : {
            ...current,
            panX: current.panX + deltaX * pixels,
            panY: current.panY + deltaY * pixels,
          },
    );
  };

  return (
    <div className="cube-canvas">
      <div className="space-canvas-frame">
        <ZoomToolbar
          zoom={camera.zoom}
          minimumZoom={MINIMUM_CUBE_ZOOM}
          maximumZoom={MAXIMUM_CUBE_ZOOM}
          onZoomBy={(factor) => zoomAround(factor, CANVAS_SIZE / 2, CANVAS_SIZE / 2)}
          onFit={() => setCamera(DEFAULT_CAMERA)}
          fitted={camera === DEFAULT_CAMERA}
          onCenter={() => setCamera((current) => ({ ...current, panX: 0, panY: 0 }))}
          fitTooltip={say(
            'Вернуть вид по умолчанию: поворот, масштаб и центр',
            'Back to the default view: rotation, zoom and centre',
          )}
        />
        <div className="cube-turns" role="group" aria-label={say('Повороты', 'Turns')}>
          {CUBE_AXES.map((axis) => (
            <span key={axis} className="cube-turn-axis">
              {TURN_SIGNS.map((sign) => (
                <button
                  key={sign}
                  type="button"
                  className="cube-turn"
                  aria-label={say(
                    `Повернуть вокруг оси ${axis} на ${sign > 0 ? '+' : '−'}${String(TURN_STEP_IN_DEGREES)}°`,
                    `Rotate about ${axis} by ${sign > 0 ? '+' : '−'}${String(TURN_STEP_IN_DEGREES)}°`,
                  )}
                  data-tooltip={say(
                    `Повернуть сцену вокруг оси ${axis} на ${String(TURN_STEP_IN_DEGREES)}° ${sign > 0 ? 'против часовой стрелки' : 'по часовой стрелке'}`,
                    `Rotate the scene about the ${axis} axis by ${String(TURN_STEP_IN_DEGREES)}° ${sign > 0 ? 'counterclockwise' : 'clockwise'}`,
                  )}
                  onClick={() => turn(axis, sign)}
                >
                  {sign > 0 ? '↺' : '↻'}
                </button>
              ))}
              <b>{axis}</b>
            </span>
          ))}
        </div>
        <canvas
          ref={canvas}
          className={hovered === null ? 'space-canvas' : 'space-canvas pointing'}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          aria-label={say(
            'Куб: перетаскивание сдвигает сцену, с ⌘ или Ctrl поворачивает ее, колесо меняет масштаб, кнопки поворачивают по осям, щелчок по частице открывает ее карточку',
            'Cube: dragging moves the scene, with ⌘ or Ctrl it turns it, the wheel zooms, the buttons rotate about the axes, a click on a particle opens its card',
          )}
          onPointerDown={(event) => {
            drag.current = { x: event.clientX, y: event.clientY };
            pressed.current = { x: event.clientX, y: event.clientY };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={onPointerMove}
          onPointerUp={(event) => {
            drag.current = null;
            const start = pressed.current;
            pressed.current = null;
            const id = nearestAt(event);
            if (
              start !== null &&
              id !== null &&
              onPick !== undefined &&
              Math.hypot(event.clientX - start.x, event.clientY - start.y) <=
                CLICK_TOLERANCE_IN_PIXELS
            ) {
              setHovered(null);
              onPick(id);
            }
          }}
          onPointerLeave={() => setHovered(null)}
        />
      </div>
      <p className="cube-hint muted">
        {say(
          'перетаскивание — сдвиг сцены, с ⌘ или Ctrl — поворот, колесо — масштаб, кнопки ↺ ↻ — поворот на 10°, щелчок по частице — ее карточка',
          'drag to move the scene, with ⌘ or Ctrl to turn it, wheel to zoom, ↺ ↻ to rotate by 10°, click a particle for its card',
        )}
      </p>
      {hovered !== null && hoveredView !== undefined && (
        <div
          className="cube-chip"
          style={{ left: hovered.x + CHIP_OFFSET, top: hovered.y + CHIP_OFFSET }}
        >
          <b>{formatSymbol(hoveredView.symbol)}</b> {hoveredView.label}
          <small>{kindWord(hoveredView)}</small>
        </div>
      )}
    </div>
  );
}

function ParticleInspector({
  space,
  frame,
  previous,
  selectedId,
  onSelect,
  onClose,
  renderCard,
}: {
  readonly space: SpaceSnapshot;
  readonly frame: SystemFrame;
  readonly previous?: SystemFrame | undefined;
  readonly selectedId: string;
  readonly onSelect: (id: string) => void;
  readonly onClose: () => void;
  readonly renderCard: (view: ParticleView) => ReactNode;
}) {
  const [query, setQuery] = useState('');
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const points = cubePoints(space, frame, previous).filter((point) => insideUnitCube(point.at));
  const selected = frame.particles.find((view) => view.id === selectedId);
  const needle = query.trim().toLowerCase();
  const listed = points.filter(
    (point) =>
      needle === '' ||
      point.label.toLowerCase().includes(needle) ||
      point.symbol.toLowerCase().includes(needle),
  );
  const tones = (Object.keys(POINT_STYLES) as PointTone[]).filter((tone) =>
    listed.some((point) => point.tone === tone),
  );
  return createPortal(
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="inspector-modal"
        role="dialog"
        aria-modal="true"
        aria-label={say('Частицы в кубе', 'Particles in the cube')}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="inspector-head">
          <strong>{say('Частицы в кубе', 'Particles in the cube')}</strong>
          <span className="muted">
            {say(`в кубе: ${String(points.length)}`, `in the cube: ${String(points.length)}`)}
          </span>
          <button
            type="button"
            className="icon-button round push-right"
            aria-label={say('Закрыть', 'Close')}
            data-tooltip={say('Закрыть, Esc', 'Close, Esc')}
            onClick={onClose}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <div className="inspector-body">
          <div className="inspector-cube">
            <CubeCanvas
              space={space}
              frame={frame}
              previous={previous}
              highlightId={selectedId}
              onPick={onSelect}
            />
          </div>
          <div className="inspector-card">
            {selected === undefined ? (
              <p className="muted">{say('Частица не найдена.', 'Particle not found.')}</p>
            ) : (
              renderCard(selected)
            )}
          </div>
          <nav className="inspector-list" aria-label={say('Другие частицы', 'Other particles')}>
            <label className="search-field">
              <input
                type="search"
                placeholder={say('Найти частицу', 'Find a particle')}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            {tones.map((tone) => (
              <section key={tone} className="inspector-group">
                <h5>
                  <i style={{ background: POINT_STYLES[tone].color }} />
                  {say(...TONE_NAMES[tone])} ·{' '}
                  {listed.filter((point) => point.tone === tone).length}
                </h5>
                {listed
                  .filter((point) => point.tone === tone)
                  .map((point) => (
                    <button
                      key={point.id}
                      type="button"
                      className={point.id === selectedId ? 'inspector-row active' : 'inspector-row'}
                      aria-current={point.id === selectedId ? 'true' : undefined}
                      onClick={() => onSelect(point.id)}
                    >
                      <b>{formatSymbol(point.symbol)}</b>
                      <span>{point.label}</span>
                      {point.born && <small>{say('новая', 'new')}</small>}
                    </button>
                  ))}
              </section>
            ))}
          </nav>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function SpaceView({
  space,
  frame,
  previous,
  symbolOf = (name) => name,
  renderCard,
}: {
  readonly space: SpaceSnapshot;
  readonly frame: SystemFrame;
  readonly previous?: SystemFrame | undefined;
  readonly symbolOf?: (name: string) => string;
  readonly renderCard?: (view: ParticleView) => ReactNode;
}) {
  const [selected, setSelected] = useState(0);
  const [inspected, setInspected] = useState<string | null>(null);
  const cloud = space.clouds[Math.min(selected, space.clouds.length - 1)];
  const bodies = cubeBodies(frame);
  const points = cubePoints(space, frame, previous);

  return (
    <div className="space-view">
      <div className="space-view-head">
        <strong>{say('Куб', 'Cube')}</strong>
        <span className="muted">
          {say('ребро', 'edge')} {formatLength(space.edgeInMeters)} · {space.gridPointsPerAxis}³{' '}
          {say('ячеек по', 'cells of')} {formatLength(space.cellSizeInMeters)} ·{' '}
          {POTENTIAL_GLOSSARY[space.potential] ?? space.potential} ·{' '}
          {space.walls === 'reflecting'
            ? say('зеркальные стенки', 'mirror walls')
            : say('открытые стенки', 'open walls')}
        </span>
      </div>
      {space.clouds.length === 0 && points.length === 0 && bodies.length === 0 ? (
        <p className="muted">{say('В кубе пока нет частиц.', 'No particles in the cube yet.')}</p>
      ) : (
        <div className="space-view-body">
          <CubeCanvas
            space={space}
            frame={frame}
            previous={previous}
            onPick={renderCard === undefined ? undefined : setInspected}
          />
          <div className="space-side">
            {(points.length > 0 || bodies.length > 0) && (
              <SceneLegend
                points={points}
                bodies={bodies}
                pendingNeutrons={frame.pendingNeutrons ?? 0}
                symbolOf={symbolOf}
              />
            )}
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
      {inspected !== null && renderCard !== undefined && (
        <ParticleInspector
          space={space}
          frame={frame}
          previous={previous}
          selectedId={inspected}
          onSelect={setInspected}
          onClose={() => setInspected(null)}
          renderCard={renderCard}
        />
      )}
    </div>
  );
}
