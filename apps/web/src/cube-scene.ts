/* Cube scene of a system frame: the bodies of media placed in space (from the bodies aspect and a legacy medium ball at the centre) and every point particle in units of the half edge, with
   where it was a frame ago and whether it was just born, the body a particle lies in and the bodies around it, and the bodies as a tree by containment; particles held as waves in the
   cube are left to their clouds. */
import type {
  BodyGeometry,
  BodyShape,
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
  return holdsPoint(geometry, {
    x: view.positionInFemtometers.x * METERS_PER_FEMTOMETER,
    y: view.positionInFemtometers.y * METERS_PER_FEMTOMETER,
    z: view.positionInFemtometers.z * METERS_PER_FEMTOMETER,
  });
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
              size: volumeOf(geometry),
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

export interface BodyNode {
  readonly index: number;
  readonly medium: MediumAspect;
  readonly geometry: BodyGeometry;
  readonly depth: number;
  readonly parent: number | null;
}

export function heightOf(geometry: BodyGeometry): number {
  return geometry.heightInMeters ?? geometry.sizeInMeters;
}

const SHAPE_VIEWS: Readonly<
  Record<
    BodyShape,
    {
      readonly holds: (offset: UnitPoint, geometry: BodyGeometry) => boolean;
      readonly volume: (geometry: BodyGeometry) => number;
    }
  >
> = {
  ball: {
    holds: (offset, geometry) =>
      Math.hypot(offset.x, offset.y, offset.z) <= HALF * geometry.sizeInMeters,
    volume: (geometry) => BALL_VOLUME_FACTOR * geometry.sizeInMeters ** 3,
  },
  box: {
    holds: (offset, geometry) =>
      Math.max(Math.abs(offset.x), Math.abs(offset.y), Math.abs(offset.z)) <=
      HALF * geometry.sizeInMeters,
    volume: (geometry) => geometry.sizeInMeters ** 3,
  },
  cylinder: {
    holds: (offset, geometry) =>
      Math.hypot(offset.x, offset.y) <= HALF * geometry.sizeInMeters &&
      Math.abs(offset.z) <= HALF * heightOf(geometry),
    volume: (geometry) => Math.PI * (HALF * geometry.sizeInMeters) ** 2 * heightOf(geometry),
  },
};

function volumeOf(geometry: BodyGeometry): number {
  return SHAPE_VIEWS[geometry.shape].volume(geometry);
}

function holdsPoint(geometry: BodyGeometry, point: UnitPoint): boolean {
  return SHAPE_VIEWS[geometry.shape].holds(
    {
      x: point.x - geometry.centerInMeters.x,
      y: point.y - geometry.centerInMeters.y,
      z: point.z - geometry.centerInMeters.z,
    },
    geometry,
  );
}

export function bodyTree(bodies: readonly MediumAspect[]): readonly BodyNode[] {
  const placed = bodies.flatMap((medium, index) => {
    const geometry = geometryOf(medium);
    return geometry === null ? [] : [{ index, medium, geometry }];
  });
  const parentOf = new Map(
    placed.map((body) => {
      const holders = placed.filter(
        (other) =>
          other.index !== body.index &&
          volumeOf(other.geometry) > volumeOf(body.geometry) &&
          holdsPoint(other.geometry, body.geometry.centerInMeters),
      );
      const parent = holders.sort(
        (first, second) => volumeOf(first.geometry) - volumeOf(second.geometry),
      )[0];
      return [body.index, parent?.index ?? null] as const;
    }),
  );
  const depthOf = (index: number): number => {
    const parent = parentOf.get(index) ?? null;
    return parent === null ? 0 : depthOf(parent) + 1;
  };
  const visit = (parent: number | null): readonly BodyNode[] =>
    placed
      .filter((body) => (parentOf.get(body.index) ?? null) === parent)
      .flatMap((body) => [{ ...body, depth: depthOf(body.index), parent }, ...visit(body.index)]);
  return visit(null);
}

export function placedBodies(frame: SystemFrame): readonly MediumAspect[] {
  return (
    (frame.environment.bodies as { readonly bodies?: readonly MediumAspect[] } | undefined)
      ?.bodies ?? []
  );
}

export function mediumPath(frame: SystemFrame, view: ParticleView): readonly MediumAspect[] {
  const body = bodyAt(frame, view);
  if (body === undefined) {
    return [];
  }
  const tree = bodyTree(placedBodies(frame));
  const chain: MediumAspect[] = [];
  let node = tree.find((candidate) => candidate.medium === body);
  while (node !== undefined) {
    chain.push(node.medium);
    const parent = node.parent;
    node = parent === null ? undefined : tree.find((candidate) => candidate.index === parent);
  }
  return chain;
}
