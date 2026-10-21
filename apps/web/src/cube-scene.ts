/* Cube scene of a system frame: the bodies of media placed in space (from the bodies aspect and a legacy medium ball at the centre) and every point particle in units of the half edge, with
   where it was a frame ago and whether it was just born, and the body a particle lies in; particles held as waves in the cube are left to their clouds. */
import type {
  BodyGeometry,
  MediumAspect,
  ParticleView,
  SpaceSnapshot,
  SystemFrame,
} from '@standard-model/contracts';

const METERS_PER_FEMTOMETER = 1e-15;
const HALF = 0.5;
const ORIGIN = { x: 0, y: 0, z: 0 };
const BALL_VOLUME_FACTOR = Math.PI / 6;

export type PointTone = 'neutron' | 'nucleus' | 'photon' | 'lepton' | 'other';

export interface CubeBody {
  readonly index: number;
  readonly geometry: BodyGeometry;
  readonly medium: MediumAspect;
}

export interface UnitPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface CubePoint {
  readonly id: string;
  readonly label: string;
  readonly symbol: string;
  readonly tone: PointTone;
  readonly at: UnitPoint;
  readonly before: UnitPoint | null;
  readonly born: boolean;
}

function geometryOf(medium: MediumAspect): BodyGeometry | null {
  if (medium.geometry !== undefined) {
    return medium.geometry;
  }
  const thickness = medium.thicknessInMeters;
  return thickness !== undefined && thickness > 0
    ? { shape: 'ball', centerInMeters: ORIGIN, sizeInMeters: thickness }
    : null;
}

export function cubeBodies(frame: SystemFrame): readonly CubeBody[] {
  const placed =
    (frame.environment.bodies as { readonly bodies?: readonly MediumAspect[] } | undefined)
      ?.bodies ?? [];
  const ambient = frame.environment.medium as MediumAspect | undefined;
  return [...placed, ...(ambient === undefined ? [] : [ambient])].flatMap((medium, index) => {
    const geometry = geometryOf(medium);
    return geometry === null ? [] : [{ index, geometry, medium }];
  });
}

export function toneOf(view: ParticleView): PointTone {
  if (view.name === 'neutron') {
    return 'neutron';
  }
  if (view.name === 'photon') {
    return 'photon';
  }
  if (view.family === 'nucleus' || view.family === 'atom' || view.family === 'molecule') {
    return 'nucleus';
  }
  return view.family === 'chargedLepton' || view.family === 'neutrino' ? 'lepton' : 'other';
}

function unitOf(view: ParticleView, halfEdgeInMeters: number): UnitPoint {
  const scale = METERS_PER_FEMTOMETER / halfEdgeInMeters;
  return {
    x: view.positionInFemtometers.x * scale,
    y: view.positionInFemtometers.y * scale,
    z: view.positionInFemtometers.z * scale,
  };
}

export function cubePoints(
  space: SpaceSnapshot,
  frame: SystemFrame,
  previous: SystemFrame | undefined,
): readonly CubePoint[] {
  const halfEdge = HALF * space.edgeInMeters;
  const waves = new Set(space.clouds.map((cloud) => cloud.label));
  const before = new Map((previous?.particles ?? []).map((view) => [view.id, view]));
  return frame.particles
    .filter((view) => view.status === 'alive' && !waves.has(view.label))
    .map((view) => {
      const earlier = before.get(view.id);
      return {
        id: view.id,
        label: view.label,
        symbol: view.symbol,
        tone: toneOf(view),
        at: unitOf(view, halfEdge),
        before: earlier === undefined ? null : unitOf(earlier, halfEdge),
        born: previous !== undefined && earlier === undefined,
      };
    });
}

export function insideUnitCube(point: UnitPoint): boolean {
  return Math.max(Math.abs(point.x), Math.abs(point.y), Math.abs(point.z)) <= 1;
}

function holds(geometry: BodyGeometry, view: ParticleView): boolean {
  const point = {
    x: view.positionInFemtometers.x * METERS_PER_FEMTOMETER - geometry.centerInMeters.x,
    y: view.positionInFemtometers.y * METERS_PER_FEMTOMETER - geometry.centerInMeters.y,
    z: view.positionInFemtometers.z * METERS_PER_FEMTOMETER - geometry.centerInMeters.z,
  };
  const half = HALF * geometry.sizeInMeters;
  return geometry.shape === 'ball'
    ? Math.hypot(point.x, point.y, point.z) <= half
    : Math.max(Math.abs(point.x), Math.abs(point.y), Math.abs(point.z)) <= half;
}

export function bodyAt(frame: SystemFrame, view: ParticleView): MediumAspect | undefined {
  const placed =
    (frame.environment.bodies as { readonly bodies?: readonly MediumAspect[] } | undefined)
      ?.bodies ?? [];
  return placed
    .flatMap((medium) => {
      const geometry = geometryOf(medium);
      return geometry !== null && holds(geometry, view)
        ? [
            {
              medium,
              size:
                geometry.sizeInMeters ** 3 * (geometry.shape === 'ball' ? BALL_VOLUME_FACTOR : 1),
            },
          ]
        : [];
    })
    .sort((first, second) => first.size - second.size)[0]?.medium;
}

export type Orientation = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

export type CubeAxis = 'x' | 'y' | 'z';

export const IDENTITY_ORIENTATION: Orientation = [1, 0, 0, 0, 1, 0, 0, 0, 1];

export function multiplied(first: Orientation, second: Orientation): Orientation {
  const entry = (row: number, column: number): number =>
    [0, 1, 2].reduce(
      (sum, index) => sum + (first[row * 3 + index] ?? 0) * (second[index * 3 + column] ?? 0),
      0,
    );
  return [
    entry(0, 0),
    entry(0, 1),
    entry(0, 2),
    entry(1, 0),
    entry(1, 1),
    entry(1, 2),
    entry(2, 0),
    entry(2, 1),
    entry(2, 2),
  ];
}

export function rotationAbout(axis: CubeAxis, angleInRadians: number): Orientation {
  const cosine = Math.cos(angleInRadians);
  const sine = Math.sin(angleInRadians);
  if (axis === 'x') {
    return [1, 0, 0, 0, cosine, -sine, 0, sine, cosine];
  }
  if (axis === 'y') {
    return [cosine, 0, sine, 0, 1, 0, -sine, 0, cosine];
  }
  return [cosine, -sine, 0, sine, cosine, 0, 0, 0, 1];
}

export function oriented(orientation: Orientation, point: UnitPoint): UnitPoint {
  return {
    x: orientation[0] * point.x + orientation[1] * point.y + orientation[2] * point.z,
    y: orientation[3] * point.x + orientation[4] * point.y + orientation[5] * point.z,
    z: orientation[6] * point.x + orientation[7] * point.y + orientation[8] * point.z,
  };
}

export function dragged(
  orientation: Orientation,
  rightInRadians: number,
  downInRadians: number,
): Orientation {
  return multiplied(
    rotationAbout('x', -downInRadians),
    multiplied(rotationAbout('y', -rightInRadians), orientation),
  );
}
