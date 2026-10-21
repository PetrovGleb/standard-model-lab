/* Checks the cube scene: bodies from the bodies aspect and a legacy ball, particles in units of the half edge with their trail and birth, the body a particle lies in, quarter turns that come
   back after four, ten-degree turns that come back after thirty-six, and a drag with Command that moves the near side the way the pointer goes. */
import type {
  ParticleName,
  ParticleView,
  SpaceSnapshot,
  SystemFrame,
} from '@standard-model/contracts';
import { describe, expect, it } from 'vitest';
import {
  IDENTITY_ORIENTATION,
  bodyAt,
  cubeBodies,
  cubePoints,
  dragged,
  multiplied,
  oriented,
  rotationAbout,
  type Orientation,
} from '../src/cube-scene';

const FEMTOMETERS_PER_METER = 1e15;
const PRECISION = 12;
const SMALL_DRAG = 0.1;
const TEN_DEGREE_TURNS_PER_CIRCLE = 36;
const TEN_DEGREES_IN_RADIANS = (2 * Math.PI) / TEN_DEGREE_TURNS_PER_CIRCLE;

function view(
  id: string,
  name: string,
  family: ParticleView['family'],
  xInMeters: number,
): ParticleView {
  return {
    label: id,
    id,
    name: name as ParticleName,
    symbol: name,
    family,
    status: 'alive',
    massInGev: 1,
    chargeInElementaryUnits: 0,
    energyInGev: 1,
    momentumInGev: { x: 0, y: 0, z: 0 },
    positionInFemtometers: { x: xInMeters * FEMTOMETERS_PER_METER, y: 0, z: 0 },
    properTimeInSeconds: 0,
    lorentzFactor: 1,
    quantum: [],
  };
}

const medium = (shape: 'ball' | 'box', sizeInMeters: number, species: string) => ({
  components: [{ species, numberDensityPerCubicMeter: 1, crossSectionInSquareMeters: 0 }],
  temperatureInKelvin: 293,
  bulkVelocityInMetersPerSecond: { x: 0, y: 0, z: 0 },
  reactionMode: 'oneReactionPerStep',
  geometry: { shape, centerInMeters: { x: 0, y: 0, z: 0 }, sizeInMeters },
});

function frame(particles: readonly ParticleView[]): SystemFrame {
  return {
    stepIndex: 0,
    step: null,
    particles,
    environment: {
      bodies: {
        bodies: [medium('box', 0.2, 'atom:92:238:0'), medium('ball', 0.1, 'atom:92:235:0')],
      },
    },
    events: [],
    totals: {
      chargeInElementaryUnits: 0,
      baryonNumber: 0,
      electronNumber: 0,
      muonNumber: 0,
      tauNumber: 0,
      energyInGev: 0,
    },
    space: null,
  } as unknown as SystemFrame;
}

const space = { edgeInMeters: 0.4, clouds: [] } as unknown as SpaceSnapshot;

describe('cube scene', () => {
  it('places bodies and particles in units of the half edge and marks newborns', () => {
    const now = frame([
      view('n1', 'neutron', 'baryon', 0.1),
      view('f1', 'nucleus:56:140', 'nucleus', 0),
    ]);
    const before = frame([view('n1', 'neutron', 'baryon', 0)]);
    expect(cubeBodies(now).map((body) => body.geometry.shape)).toEqual(['box', 'ball']);
    const points = cubePoints(space, now, before);
    expect(
      points.map((point) => [point.tone, point.at.x, point.before?.x ?? null, point.born]),
    ).toEqual([
      ['neutron', 0.5, 0, false],
      ['nucleus', 0, null, true],
    ]);
  });

  it('finds the smallest body that holds a particle', () => {
    const now = frame([]);
    expect(bodyAt(now, view('a', 'neutron', 'baryon', 0.02))?.geometry?.shape).toBe('ball');
    expect(bodyAt(now, view('b', 'neutron', 'baryon', 0.08))?.geometry?.shape).toBe('box');
    expect(bodyAt(now, view('c', 'neutron', 'baryon', 0.15))).toBeUndefined();
  });

  it('comes back after four quarter turns about any axis', () => {
    (['x', 'y', 'z'] as const).forEach((axis) => {
      const quarter = rotationAbout(axis, Math.PI / 2);
      const full = multiplied(multiplied(quarter, quarter), multiplied(quarter, quarter));
      full.forEach((value, index) =>
        expect(value).toBeCloseTo(IDENTITY_ORIENTATION[index] ?? 0, PRECISION),
      );
    });
  });

  it('moves the near side of the cube the way the pointer is dragged', () => {
    const near = { x: 0, y: 0, z: -1 };
    expect(oriented(dragged(IDENTITY_ORIENTATION, SMALL_DRAG, 0), near).x).toBeGreaterThan(0);
    expect(oriented(dragged(IDENTITY_ORIENTATION, 0, SMALL_DRAG), near).y).toBeLessThan(0);
  });

  it('comes back after thirty-six turns of ten degrees', () => {
    const step = rotationAbout('y', TEN_DEGREES_IN_RADIANS);
    const full = Array.from({ length: TEN_DEGREE_TURNS_PER_CIRCLE }).reduce<Orientation>(
      (orientation) => multiplied(orientation, step),
      IDENTITY_ORIENTATION,
    );
    full.forEach((value, index) =>
      expect(value).toBeCloseTo(IDENTITY_ORIENTATION[index] ?? 0, PRECISION),
    );
  });
});
