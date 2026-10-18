/* Checks the new cube potentials and shapes: hydrogen 2s, 2p and 3d mean radii and the 2p anisotropy on the grid, the 1s + 2p dipole and its flip after half a period, tunnelling into
   the other well, the mirror revival in a box, cat-state fringes, double-slit fringes and the refusal of geometries that cannot exist. */
import { describe, expect, it } from 'vitest';
import type { ExperimentResult, ProbabilityCloud } from '@standard-model/contracts';
import {
  DOUBLE_SLIT_IN_CUBE_TEMPLATE,
  DOUBLE_WELL_TUNNELING_TEMPLATE,
  HYDROGEN_DIPOLE_OSCILLATION_TEMPLATE,
  QUANTUM_CARPET_IN_BOX_TEMPLATE,
  SCHRODINGER_CAT_IN_TRAP_TEMPLATE,
  createEngine,
  experiment,
  runExperiment,
  type ResolvedSpace,
  type SpatialState,
} from '../src/index.js';

const BOHR_RADIUS = 5.29177e-11;
const GRID_PRECISION = 0.03;
const DIPOLE_MOMENT_IN_BOHR = 0.7449;
const CUBE_TIMEOUT_IN_MILLISECONDS = 120_000;
const SHOTS = 200;

function coulombSpace(gridPointsPerAxis: number, cellSizeInMeters: number): ResolvedSpace {
  return {
    gridPointsPerAxis,
    cellSizeInMeters,
    potential: 'coulomb',
    potentialEnergyInEv: 0,
    barrierThicknessInMeters: 0,
    nuclearCharge: 1,
  };
}

function moments(space: ResolvedSpace, state: SpatialState) {
  const size = space.gridPointsPerAxis;
  const coordinate = (index: number): number => (index - size / 2 + 0.5) * space.cellSizeInMeters;
  let total = 0;
  let radius = 0;
  let zMean = 0;
  let xSquared = 0;
  let zSquared = 0;
  state.real.forEach((real, index) => {
    const probability = real ** 2 + (state.imaginary[index] ?? 0) ** 2;
    const x = coordinate(index % size);
    const y = coordinate(Math.floor(index / size) % size);
    const z = coordinate(Math.floor(index / (size * size)));
    total += probability;
    radius += probability * Math.hypot(x, y, z);
    zMean += probability * z;
    xSquared += probability * x * x;
    zSquared += probability * z * z;
  });
  return {
    meanRadius: radius / total,
    meanZ: zMean / total,
    xSquared: xSquared / total,
    zSquared: zSquared / total,
  };
}

function placed(
  space: ResolvedSpace,
  shape: 'hydrogen2s' | 'hydrogen2p' | 'hydrogen3d' | 'hydrogen1s2p',
): SpatialState {
  const engine = createEngine({ seed: 1 });
  return engine.space.place(
    space,
    engine.particles.create('electron'),
    { x: 0, y: 0, z: 0 },
    BOHR_RADIUS,
    shape,
  );
}

function cloudAt(result: ExperimentResult, frame: number): ProbabilityCloud {
  const cloud = result.systemReport?.frames[frame]?.space?.clouds[0];
  if (cloud === undefined) {
    throw new Error(`frame ${String(frame)} has no cloud`);
  }
  return cloud;
}

function profileAlongX(cloud: ProbabilityCloud): readonly number[] {
  const size = cloud.projectionResolution;
  return Array.from({ length: size }, (unused, x) =>
    Array.from({ length: size }, (ignored, y) => cloud.projectionXy[x + size * y] ?? 0).reduce(
      (sum, value) => sum + value,
      0,
    ),
  );
}

function profileAlongYBeyondWall(cloud: ProbabilityCloud): readonly number[] {
  const size = cloud.projectionResolution;
  return Array.from({ length: size }, (unused, y) =>
    Array.from({ length: size / 2 }, (ignored, column) => {
      const x = size / 2 + column;
      return cloud.projectionXy[x + size * y] ?? 0;
    }).reduce((sum, value) => sum + value, 0),
  );
}

function localMaxima(profile: readonly number[]): number {
  const peak = Math.max(...profile);
  return profile.filter(
    (value, index) =>
      index > 0 &&
      index < profile.length - 1 &&
      value > (profile[index - 1] ?? 0) &&
      value >= (profile[index + 1] ?? 0) &&
      value > peak / 10,
  ).length;
}

function rightShare(cloud: ProbabilityCloud): number {
  const profile = profileAlongX(cloud);
  const total = profile.reduce((sum, value) => sum + value, 0);
  return profile.slice(profile.length / 2).reduce((sum, value) => sum + value, 0) / total;
}

describe('hydrogen orbitals on the grid', () => {
  it('gives 2s, 2p and 3d their mean radii of 6, 5 and 10.5 Bohr radii', () => {
    const near = coulombSpace(64, 3.5e-11);
    const far = coulombSpace(64, 4.5e-11);
    expect(moments(near, placed(near, 'hydrogen2s')).meanRadius / (6 * BOHR_RADIUS)).toBeCloseTo(
      1,
      1,
    );
    const twoP = moments(near, placed(near, 'hydrogen2p'));
    expect(Math.abs(twoP.meanRadius / (5 * BOHR_RADIUS) - 1)).toBeLessThan(GRID_PRECISION);
    expect(Math.abs(twoP.zSquared / twoP.xSquared / 3 - 1)).toBeLessThan(GRID_PRECISION);
    expect(Math.abs(twoP.meanZ)).toBeLessThan(1e-15);
    expect(
      Math.abs(moments(far, placed(far, 'hydrogen3d')).meanRadius / (10.5 * BOHR_RADIUS) - 1),
    ).toBeLessThan(GRID_PRECISION);
  });

  it(
    'starts the 1s + 2p superposition with the dipole ⟨z⟩ = 0.745 a₀ and flips it after half a period',
    () => {
      const space = coulombSpace(64, 2.5e-11);
      expect(
        Math.abs(
          moments(space, placed(space, 'hydrogen1s2p')).meanZ /
            (DIPOLE_MOMENT_IN_BOHR * BOHR_RADIUS) -
            1,
        ),
      ).toBeLessThan(GRID_PRECISION);
      const result = runExperiment(HYDROGEN_DIPOLE_OSCILLATION_TEMPLATE, { shots: SHOTS, seed: 1 });
      expect(cloudAt(result, 2).meanPositionInMeters.z).toBeGreaterThan(0);
      expect(cloudAt(result, 8).meanPositionInMeters.z).toBeLessThan(0);
    },
    CUBE_TIMEOUT_IN_MILLISECONDS,
  );
});

describe('cube potentials at work', () => {
  it(
    'tunnels from the left well into the right one and back',
    () => {
      const result = runExperiment(DOUBLE_WELL_TUNNELING_TEMPLATE, { shots: SHOTS, seed: 1 });
      expect(rightShare(cloudAt(result, 2))).toBeLessThan(0.1);
      expect(rightShare(cloudAt(result, 6))).toBeGreaterThan(0.8);
      expect(rightShare(cloudAt(result, 10))).toBeLessThan(0.3);
    },
    CUBE_TIMEOUT_IN_MILLISECONDS,
  );

  it(
    'revives the packet as its mirror image at half the revival time of the box',
    () => {
      const result = runExperiment(QUANTUM_CARPET_IN_BOX_TEMPLATE, { shots: SHOTS, seed: 1 });
      const start = cloudAt(result, 2);
      const half = cloudAt(result, 6);
      expect(half.meanPositionInMeters.x / -start.meanPositionInMeters.x).toBeGreaterThan(0.8);
      expect(half.spreadInMeters.x / start.spreadInMeters.x).toBeLessThan(1.2);
    },
    CUBE_TIMEOUT_IN_MILLISECONDS,
  );

  it(
    'shows fringes where the two halves of the cat overlap and swaps them after half a period',
    () => {
      const result = runExperiment(SCHRODINGER_CAT_IN_TRAP_TEMPLATE, { shots: SHOTS, seed: 1 });
      expect(localMaxima(profileAlongX(cloudAt(result, 2)))).toBe(2);
      expect(localMaxima(profileAlongX(cloudAt(result, 4)))).toBeGreaterThanOrEqual(3);
      expect(localMaxima(profileAlongX(cloudAt(result, 6)))).toBe(2);
    },
    CUBE_TIMEOUT_IN_MILLISECONDS,
  );

  it(
    'leaves a central maximum and side fringes behind the two slits',
    () => {
      const result = runExperiment(DOUBLE_SLIT_IN_CUBE_TEMPLATE, { shots: SHOTS, seed: 1 });
      const profile = profileAlongYBeyondWall(cloudAt(result, 8));
      const center = profile.length / 2;
      expect(Math.max(profile[center - 1] ?? 0, profile[center] ?? 0)).toBe(Math.max(...profile));
      expect(localMaxima(profile)).toBeGreaterThanOrEqual(3);
    },
    CUBE_TIMEOUT_IN_MILLISECONDS,
  );

  it('refuses slits that overlap, orbitals without a nucleus and a box larger than the cube', () => {
    const slits = experiment('slits')
      .space({
        gridPointsPerAxis: 32,
        cellSizeInMeters: 5e-11,
        potential: 'doubleSlit',
        potentialEnergyInEv: 100,
        barrierThicknessInMeters: 1e-10,
        slitWidthInMeters: 2e-10,
        slitSeparationInMeters: 1e-10,
      })
      .create('electron', 'electron')
      .place('electron', { x: -3e-10, y: 0, z: 0 }, 1.5e-10)
      .build();
    expect(() => runExperiment(slits, { shots: 1 })).toThrow(/slit/);
    const orbital = experiment('orbital')
      .space({ gridPointsPerAxis: 32, cellSizeInMeters: 5e-11, potential: 'free' })
      .create('electron', 'electron')
      .place('electron', { x: 0, y: 0, z: 0 }, BOHR_RADIUS, 'hydrogen2p')
      .build();
    expect(() => runExperiment(orbital, { shots: 1 })).toThrow(/Coulomb/);
    const box = experiment('box')
      .space({
        gridPointsPerAxis: 32,
        cellSizeInMeters: 4e-11,
        potential: 'box',
        potentialEnergyInEv: 100,
        boxSizeInMeters: 2e-9,
      })
      .create('electron', 'electron')
      .place('electron', { x: 0, y: 0, z: 0 }, 1e-10)
      .build();
    expect(() => runExperiment(box, { shots: 1 })).toThrow(/box/);
  });
});
