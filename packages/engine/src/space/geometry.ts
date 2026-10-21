/* Geometry of the cube and the bodies in it: ball, box and cylinder (along z) shapes in a registry (whether they hold a point, the distance along a ray to their surface, their volume), the body a point lies in (the
   smallest one that holds it), the walls of the cube as open or mirror laws (a ray to the nearest wall, the bounce, the exact fold of a straight flight between mirrors) and the world one
   particle sees: the media around it by position and the walls. A legacy medium with only a thickness is a ball of that diameter at the centre; a medium without either fills all space. */
import type {
  BodyGeometry,
  BodyShape,
  Environment,
  MediumAspect,
  SpaceWalls,
  Vector3,
} from '@standard-model/contracts';
import { dotProduct, scaleVector, subtractVectors, vectorMagnitude } from '@standard-model/utils';

const HALF = 0.5;
const BALL_VOLUME_FACTOR = Math.PI / 6;
const ORIGIN: Vector3 = { x: 0, y: 0, z: 0 };
export const AXES = ['x', 'y', 'z'] as const;
export type Axis = (typeof AXES)[number];

interface ShapeLaw {
  contains(geometry: BodyGeometry, pointInMeters: Vector3): boolean;
  surfaceDistanceInMeters(
    geometry: BodyGeometry,
    pointInMeters: Vector3,
    unitDirection: Vector3,
  ): number;
  volumeInCubicMeters(geometry: BodyGeometry): number;
}

const BALL: ShapeLaw = {
  contains: (geometry, point) =>
    vectorMagnitude(subtractVectors(point, geometry.centerInMeters)) <=
    HALF * geometry.sizeInMeters,
  surfaceDistanceInMeters: (geometry, point, direction) => {
    const radius = HALF * geometry.sizeInMeters;
    const offset = subtractVectors(point, geometry.centerInMeters);
    const along = dotProduct(offset, direction);
    const discriminant = along ** 2 - (dotProduct(offset, offset) - radius ** 2);
    if (discriminant < 0) {
      return Number.POSITIVE_INFINITY;
    }
    const root = Math.sqrt(discriminant);
    const near = -along - root;
    const far = -along + root;
    return near > 0 ? near : far > 0 ? far : Number.POSITIVE_INFINITY;
  },
  volumeInCubicMeters: (geometry) => BALL_VOLUME_FACTOR * geometry.sizeInMeters ** 3,
};

const BOX: ShapeLaw = {
  contains: (geometry, point) =>
    AXES.every(
      (axis) =>
        Math.abs(point[axis] - geometry.centerInMeters[axis]) <= HALF * geometry.sizeInMeters,
    ),
  surfaceDistanceInMeters: (geometry, point, direction) => {
    const half = HALF * geometry.sizeInMeters;
    let entry = Number.NEGATIVE_INFINITY;
    let exit = Number.POSITIVE_INFINITY;
    for (const axis of AXES) {
      const offset = point[axis] - geometry.centerInMeters[axis];
      if (direction[axis] === 0) {
        if (Math.abs(offset) > half) {
          return Number.POSITIVE_INFINITY;
        }
        continue;
      }
      const first = (-half - offset) / direction[axis];
      const second = (half - offset) / direction[axis];
      entry = Math.max(entry, Math.min(first, second));
      exit = Math.min(exit, Math.max(first, second));
    }
    if (entry > exit) {
      return Number.POSITIVE_INFINITY;
    }
    return entry > 0 ? entry : exit > 0 ? exit : Number.POSITIVE_INFINITY;
  },
  volumeInCubicMeters: (geometry) => geometry.sizeInMeters ** 3,
};

function heightOf(geometry: BodyGeometry): number {
  return geometry.heightInMeters ?? geometry.sizeInMeters;
}

const CYLINDER: ShapeLaw = {
  contains: (geometry, point) => {
    const offset = subtractVectors(point, geometry.centerInMeters);
    return (
      Math.hypot(offset.x, offset.y) <= HALF * geometry.sizeInMeters &&
      Math.abs(offset.z) <= HALF * heightOf(geometry)
    );
  },
  surfaceDistanceInMeters: (geometry, point, direction) => {
    const radius = HALF * geometry.sizeInMeters;
    const halfHeight = HALF * heightOf(geometry);
    const offset = subtractVectors(point, geometry.centerInMeters);
    const planar = direction.x * direction.x + direction.y * direction.y;
    let entry = Number.NEGATIVE_INFINITY;
    let exit = Number.POSITIVE_INFINITY;
    if (planar === 0) {
      if (Math.hypot(offset.x, offset.y) > radius) {
        return Number.POSITIVE_INFINITY;
      }
    } else {
      const along = offset.x * direction.x + offset.y * direction.y;
      const discriminant =
        along * along - planar * (offset.x * offset.x + offset.y * offset.y - radius * radius);
      if (discriminant < 0) {
        return Number.POSITIVE_INFINITY;
      }
      const root = Math.sqrt(discriminant);
      entry = (-along - root) / planar;
      exit = (-along + root) / planar;
    }
    if (direction.z === 0) {
      if (Math.abs(offset.z) > halfHeight) {
        return Number.POSITIVE_INFINITY;
      }
    } else {
      const first = (-halfHeight - offset.z) / direction.z;
      const second = (halfHeight - offset.z) / direction.z;
      entry = Math.max(entry, Math.min(first, second));
      exit = Math.min(exit, Math.max(first, second));
    }
    if (entry > exit) {
      return Number.POSITIVE_INFINITY;
    }
    return entry > 0 ? entry : exit > 0 ? exit : Number.POSITIVE_INFINITY;
  },
  volumeInCubicMeters: (geometry) =>
    Math.PI * (HALF * geometry.sizeInMeters) ** 2 * heightOf(geometry),
};

export const BODY_SHAPE_LAWS: Readonly<Record<BodyShape, ShapeLaw>> = {
  ball: BALL,
  box: BOX,
  cylinder: CYLINDER,
};

export function unitDirection(direction: Vector3): Vector3 {
  const length = vectorMagnitude(direction);
  return length > 0 ? scaleVector(direction, 1 / length) : { x: 0, y: 0, z: 1 };
}

export function geometryOf(medium: MediumAspect): BodyGeometry | null {
  if (medium.geometry !== undefined) {
    return medium.geometry;
  }
  const thickness = medium.thicknessInMeters;
  return thickness !== undefined && thickness > 0
    ? { shape: 'ball', centerInMeters: ORIGIN, sizeInMeters: thickness }
    : null;
}

export function mediumHolds(medium: MediumAspect, pointInMeters: Vector3): boolean {
  const geometry = geometryOf(medium);
  return geometry === null || BODY_SHAPE_LAWS[geometry.shape].contains(geometry, pointInMeters);
}

export function mediumSurfaceDistanceInMeters(
  medium: MediumAspect,
  pointInMeters: Vector3,
  direction: Vector3,
): number {
  const geometry = geometryOf(medium);
  return geometry === null
    ? Number.POSITIVE_INFINITY
    : BODY_SHAPE_LAWS[geometry.shape].surfaceDistanceInMeters(
        geometry,
        pointInMeters,
        unitDirection(direction),
      );
}

export function geometryVolumeInCubicMeters(medium: MediumAspect): number | null {
  const geometry = geometryOf(medium);
  return geometry === null ? null : BODY_SHAPE_LAWS[geometry.shape].volumeInCubicMeters(geometry);
}

export function innermostBody(
  bodies: readonly MediumAspect[],
  pointInMeters: Vector3,
): MediumAspect | undefined {
  return bodies
    .filter((body) => geometryOf(body) !== null && mediumHolds(body, pointInMeters))
    .reduce<MediumAspect | undefined>(
      (smallest, body) =>
        smallest === undefined ||
        (geometryVolumeInCubicMeters(body) ?? 0) < (geometryVolumeInCubicMeters(smallest) ?? 0)
          ? body
          : smallest,
      undefined,
    );
}

export function withBodyMedium(environment: Environment, pointInMeters: Vector3): Environment {
  const body = innermostBody(environment.get('bodies')?.bodies ?? [], pointInMeters);
  return body === undefined ? environment : environment.with('medium', body);
}

export function sameGeometry(first: BodyGeometry, second: BodyGeometry): boolean {
  return (
    first.shape === second.shape &&
    first.sizeInMeters === second.sizeInMeters &&
    first.heightInMeters === second.heightInMeters &&
    AXES.every((axis) => first.centerInMeters[axis] === second.centerInMeters[axis])
  );
}

export interface WallLaw {
  readonly reflectsWaves: boolean;
  bounce(direction: Vector3, axis: Axis): Vector3 | null;
  fold(
    positionInMeters: Vector3,
    momentum: Vector3,
    halfEdgeInMeters: number,
  ): { readonly positionInMeters: Vector3; readonly momentum: Vector3 };
}

function foldedCoordinate(coordinate: number, halfEdge: number): readonly [number, number] {
  const period = 4 * halfEdge;
  const shifted = (((coordinate + halfEdge) % period) + period) % period;
  return shifted <= 2 * halfEdge ? [shifted - halfEdge, 1] : [3 * halfEdge - shifted, -1];
}

const OPEN_WALLS: WallLaw = {
  reflectsWaves: false,
  bounce: () => null,
  fold: (positionInMeters, momentum) => ({ positionInMeters, momentum }),
};

const MIRROR_WALLS: WallLaw = {
  reflectsWaves: true,
  bounce: (direction, axis) => ({ ...direction, [axis]: -direction[axis] }),
  fold: (position, momentum, halfEdge) => {
    const [x, signX] = foldedCoordinate(position.x, halfEdge);
    const [y, signY] = foldedCoordinate(position.y, halfEdge);
    const [z, signZ] = foldedCoordinate(position.z, halfEdge);
    return {
      positionInMeters: { x, y, z },
      momentum: { x: momentum.x * signX, y: momentum.y * signY, z: momentum.z * signZ },
    };
  },
};

export const WALL_LAWS: Readonly<Record<SpaceWalls, WallLaw>> = {
  open: OPEN_WALLS,
  reflecting: MIRROR_WALLS,
};

export interface CubeWalls {
  readonly law: WallLaw;
  readonly halfEdgeInMeters: number;
}

export function insideCube(walls: CubeWalls, pointInMeters: Vector3): boolean {
  return AXES.every((axis) => Math.abs(pointInMeters[axis]) <= walls.halfEdgeInMeters);
}

export function wallHit(
  walls: CubeWalls,
  pointInMeters: Vector3,
  direction: Vector3,
): { readonly distanceInMeters: number; readonly axis: Axis } {
  return AXES.reduce<{ distanceInMeters: number; axis: Axis }>(
    (nearest, axis) => {
      const component = direction[axis];
      if (component === 0) {
        return nearest;
      }
      const target = component > 0 ? walls.halfEdgeInMeters : -walls.halfEdgeInMeters;
      const distance = Math.max((target - pointInMeters[axis]) / component, 0);
      return distance < nearest.distanceInMeters ? { distanceInMeters: distance, axis } : nearest;
    },
    { distanceInMeters: Number.POSITIVE_INFINITY, axis: 'x' },
  );
}

export interface World {
  readonly walls: CubeWalls | null;
  readonly ambient: MediumAspect | undefined;
  readonly bodies: readonly MediumAspect[];
}

export function worldOf(environment: Environment, walls: CubeWalls | null): World {
  return {
    walls,
    ambient: environment.get('medium'),
    bodies: environment.get('bodies')?.bodies ?? [],
  };
}

export function finiteMedia(world: World): readonly MediumAspect[] {
  return [
    ...world.bodies,
    ...(world.ambient !== undefined && geometryOf(world.ambient) !== null ? [world.ambient] : []),
  ];
}

export function mediumAt(world: World, pointInMeters: Vector3): MediumAspect | undefined {
  const body = innermostBody(finiteMedia(world), pointInMeters);
  if (body !== undefined) {
    return body;
  }
  return world.ambient !== undefined && geometryOf(world.ambient) === null
    ? world.ambient
    : undefined;
}

export function surfaceDistanceInMeters(
  world: World,
  pointInMeters: Vector3,
  direction: Vector3,
): number {
  return Math.min(
    Number.POSITIVE_INFINITY,
    ...finiteMedia(world).map((medium) =>
      mediumSurfaceDistanceInMeters(medium, pointInMeters, direction),
    ),
  );
}
