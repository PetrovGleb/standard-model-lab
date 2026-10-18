/* Checks the spatial cube: FFT round trip, refusals at invalid scales, hydrogen 1s radius, packet spreading, tunnelling and the trap oscillation. */
import { describe, expect, it } from 'vitest';
import {
  createEngine,
  experiment,
  fft3d,
  HARMONIC_OSCILLATOR_TEMPLATE,
  HYDROGEN_ATOM_TEMPLATE,
  QUANTUM_TUNNELING_TEMPLATE,
  runExperiment,
  WAVEPACKET_SPREADING_TEMPLATE,
} from '../src/index.js';

const BOHR_RADIUS = 5.29177e-11;
const CUBE_EVOLUTION_TIMEOUT_IN_MILLISECONDS = 60_000;

describe('fft3d', () => {
  it('returns the input after a forward and inverse transform', () => {
    const size = 8;
    const real = Float64Array.from({ length: size ** 3 }, (ignored, index) =>
      Math.sin(index * 0.37),
    );
    const imaginary = Float64Array.from({ length: size ** 3 }, (ignored, index) =>
      Math.cos(index * 0.11),
    );
    const originalReal = Float64Array.from(real);
    fft3d(real, imaginary, size, false);
    fft3d(real, imaginary, size, true);
    real.forEach((value, index) => expect(value).toBeCloseTo(originalReal[index] ?? 0, 10));
  });
});

describe('valid scales only', () => {
  it('refuses photons, too small cells, relativistic speeds and missing space', () => {
    const photon = experiment('photon')
      .space({ gridPointsPerAxis: 32, cellSizeInMeters: 1e-10, potential: 'free' })
      .create('g', 'photon')
      .place('g', { x: 0, y: 0, z: 0 }, 3e-10)
      .build();
    expect(() => runExperiment(photon, { shots: 1 })).toThrow(/massless/);
    const tiny = experiment('tiny')
      .space({ gridPointsPerAxis: 32, cellSizeInMeters: 1e-14, potential: 'free' })
      .create('e', 'electron')
      .place('e', { x: 0, y: 0, z: 0 }, 3e-14)
      .build();
    expect(() => runExperiment(tiny, { shots: 1 })).toThrow(/комптоновских/);
    const fast = experiment('fast')
      .space({ gridPointsPerAxis: 32, cellSizeInMeters: 1e-10, potential: 'free' })
      .create('e', 'electron', { momentumInGev: { x: 0, y: 0, z: 0.001 } })
      .place('e', { x: 0, y: 0, z: 0 }, 3e-10)
      .build();
    expect(() => runExperiment(fast, { shots: 1 })).toThrow(/0.1 c/);
    const noSpace = experiment('noSpace')
      .create('e', 'electron')
      .place('e', { x: 0, y: 0, z: 0 }, 1e-10)
      .build();
    expect(() => runExperiment(noSpace, { shots: 1 })).toThrow(/needs a space/);
    const badGrid = {
      ...noSpace,
      space: { gridPointsPerAxis: 48, cellSizeInMeters: 1e-10, potential: 'free' as const },
    };
    expect(() => runExperiment(badGrid, { shots: 1 })).toThrow();
  });
});

describe('physics in the cube', () => {
  it('gives the hydrogen 1s cloud a mean radius of 1.5 Bohr radii', () => {
    const result = runExperiment(HYDROGEN_ATOM_TEMPLATE, { shots: 6000, seed: 2 });
    const meanRadius = result.reportValues['Средний радиус, м'] ?? 0;
    expect(meanRadius / BOHR_RADIUS).toBeGreaterThan(1.4);
    expect(meanRadius / BOHR_RADIUS).toBeLessThan(1.6);
    const cloud = result.systemReport?.frames[2]?.space?.clouds[0];
    expect(cloud?.energyInEv).toBeLessThan(-10);
    expect(cloud?.density).toHaveLength(16 ** 3);
  });

  it('doubles a 0.1 nm packet width after 0.3 fs', () => {
    const result = runExperiment(WAVEPACKET_SPREADING_TEMPLATE, {
      shots: 6000,
      seed: 2,
      includeSystemReport: false,
    });
    const width = result.reportValues['Ширина σx, м'] ?? 0;
    const expected = 1e-10 * Math.sqrt(1 + ((1.0546e-34 * 3e-16) / (2 * 9.109e-31 * 1e-20)) ** 2);
    expect(width / expected).toBeGreaterThan(0.93);
    expect(width / expected).toBeLessThan(1.07);
  });

  it(
    'lets about a third of a 5 eV electron through a 10 eV barrier and swings the trap packet across',
    () => {
      const tunnel = runExperiment(QUANTUM_TUNNELING_TEMPLATE, {
        shots: 8000,
        seed: 2,
        includeSystemReport: false,
      });
      const histogram = Object.values(tunnel.distributions)[0];
      if (histogram === undefined) {
        throw new Error('histogram expected');
      }
      const beyond =
        histogram.binEdges
          .slice(0, -1)
          .reduce(
            (sum, edge, bin) => (edge >= 5e-11 ? sum + (histogram.counts[bin] ?? 0) : sum),
            0,
          ) / histogram.samples;
      expect(beyond).toBeGreaterThan(0.2);
      expect(beyond).toBeLessThan(0.45);
      const trap = runExperiment(HARMONIC_OSCILLATOR_TEMPLATE, {
        shots: 4000,
        seed: 2,
        includeSystemReport: false,
      });
      expect((trap.reportValues['Средняя координата x, м'] ?? 0) / -2e-10).toBeGreaterThan(0.9);
    },
    CUBE_EVOLUTION_TIMEOUT_IN_MILLISECONDS,
  );

  it('collapses the cloud on measurement and records a position', () => {
    const engine = createEngine({ seed: 1 });
    const electron = engine.particles.create('electron');
    const space = {
      gridPointsPerAxis: 32,
      cellSizeInMeters: 5e-11,
      potential: 'free' as const,
      potentialEnergyInEv: 0,
      barrierThicknessInMeters: 0,
      nuclearCharge: 1,
    };
    const state = engine.space.place(space, electron, { x: 0, y: 0, z: 0 }, 1e-10, 'gaussian');
    const outcome = engine.space.measure(space, state);
    expect(
      Math.hypot(
        outcome.positionInMeters.x,
        outcome.positionInMeters.y,
        outcome.positionInMeters.z,
      ),
    ).toBeLessThan(8e-10);
    expect(outcome.collapsed.real.reduce((sum, value) => sum + value * value, 0)).toBeCloseTo(
      1,
      12,
    );
    expect(outcome.probabilityInside).toBeCloseTo(1, 9);
  });
});
