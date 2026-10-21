/* Checks keyframes and particle weights: a keyframe records the watched quantities of a named medium, the system and a particle, the summary carries each keyframe's time and the change between
   keyframes (an alpha particle hands its whole kinetic energy to a water drop), a weight of a thousand multiplies the heat a thousandfold, a body replaced under its own name keeps its
   temperature and absorbed energy, and the compiler refuses keyframes it cannot read. */
import { ELECTRON_VOLT } from '@standard-model/constants';
import type { KeyframeWatch } from '@standard-model/contracts';
import { describe, expect, it } from 'vitest';
import { compilePlan, experiment, runExperiment } from '../src/index.js';

const WATER = 'molecule:8-16,1-1,1-1;0-1-1,0-2-1';
const WATER_MOLECULES_PER_CUBIC_METER = 3.34e28;
const DROP_DIAMETER_IN_METERS = 1e-3;
const ALPHA_MOMENTUM_IN_GEV = 0.1932;
const FLIGHT_IN_SECONDS = 1e-9;
const SHOTS = 5;
const WEIGHT = 1000;
const EV_PER_GEV = 1e9;
const RELATIVE_PRECISION = 1e-9;
const CUBE_POINTS = 32;
const CUBE_CELL_IN_METERS = 1e-4;
const WATCH: readonly KeyframeWatch[] = [
  { target: 'drop', quantity: 'absorbedEnergyInJoules' },
  { target: 'drop', quantity: 'temperatureInKelvin' },
  { target: 'system', quantity: 'particleCount' },
  { target: 'alpha', quantity: 'kineticEnergyInGev' },
];

function alphaInDrop(watch: readonly KeyframeWatch[], weight?: number) {
  const builder = experiment('keyframes')
    .shots(SHOTS)
    .influence('setMedium', {
      name: 'drop',
      components: [{ species: WATER, numberDensityPerCubicMeter: WATER_MOLECULES_PER_CUBIC_METER }],
      temperatureInKelvin: 293,
      pressureInPascals: 101325,
      thicknessInMeters: DROP_DIAMETER_IN_METERS,
    })
    .create('alpha', 'alphaParticle', { momentumInGev: { x: 0, y: 0, z: ALPHA_MOMENTUM_IN_GEV } })
    .keyframe('before', watch)
    .evolve(FLIGHT_IN_SECONDS)
    .keyframe('after', watch);
  return (weight === undefined ? builder : builder.weigh(weight)).build();
}

function track(result: ReturnType<typeof runExperiment>, target: string, quantity: string) {
  return result.keyframes?.tracks.find(
    (candidate) => candidate.target === target && candidate.quantity === quantity,
  );
}

describe('keyframes', () => {
  it('records the watched quantities and the change between keyframes', () => {
    const result = runExperiment(alphaInDrop(WATCH), { includeSystemReport: false });
    expect(result.keyframes?.names).toEqual(['before', 'after']);
    expect(result.keyframes?.timesInSeconds).toEqual([0, FLIGHT_IN_SECONDS]);
    const kinetic = track(result, 'alpha', 'kineticEnergyInGev');
    const absorbed = track(result, 'drop', 'absorbedEnergyInJoules');
    const handedOver = -(kinetic?.changes[0]?.mean ?? 0) * EV_PER_GEV * ELECTRON_VOLT.value;
    expect(absorbed?.values[0]?.mean).toBe(0);
    expect(Math.abs((absorbed?.changes[0]?.mean ?? 0) / handedOver - 1)).toBeLessThan(
      RELATIVE_PRECISION,
    );
    expect(track(result, 'drop', 'temperatureInKelvin')?.changes[0]?.mean).toBeGreaterThan(0);
    expect(track(result, 'system', 'particleCount')?.values[1]?.mean).toBe(1);
  });

  it('multiplies the heat by the particle weight', () => {
    const single = runExperiment(alphaInDrop(WATCH), { includeSystemReport: false });
    const weighted = runExperiment(alphaInDrop(WATCH, WEIGHT), { includeSystemReport: false });
    const heat = (result: typeof single) =>
      track(result, 'drop', 'absorbedEnergyInJoules')?.changes[0]?.mean ?? 0;
    expect(Math.abs(heat(weighted) / (WEIGHT * heat(single)) - 1)).toBeLessThan(RELATIVE_PRECISION);
  });

  it('keeps the temperature and absorbed energy of a body replaced under the same name', () => {
    const watch: readonly KeyframeWatch[] = [
      { target: 'pool', quantity: 'absorbedEnergyInJoules' },
      { target: 'pool', quantity: 'temperatureInKelvin' },
    ];
    const replaced = (name: string) =>
      experiment('replaced body')
        .shots(SHOTS)
        .space({
          gridPointsPerAxis: CUBE_POINTS,
          cellSizeInMeters: CUBE_CELL_IN_METERS,
          potential: 'free',
        })
        .influence('placeBody', {
          name: 'pool',
          shape: 'ball',
          sizeInMeters: DROP_DIAMETER_IN_METERS,
          components: [
            { species: WATER, numberDensityPerCubicMeter: WATER_MOLECULES_PER_CUBIC_METER },
          ],
          temperatureInKelvin: 293,
        })
        .create('alpha', 'alphaParticle', {
          momentumInGev: { x: 0, y: 0, z: ALPHA_MOMENTUM_IN_GEV },
        })
        .evolve(FLIGHT_IN_SECONDS)
        .keyframe('water', watch)
        .influence('placeBody', {
          name,
          shape: 'ball',
          sizeInMeters: DROP_DIAMETER_IN_METERS,
          components: [
            { species: WATER, numberDensityPerCubicMeter: WATER_MOLECULES_PER_CUBIC_METER / 2 },
          ],
          temperatureInKelvin: 293,
        })
        .keyframe('thinner', watch)
        .build();
    const kept = runExperiment(replaced('pool'), { includeSystemReport: false });
    const absorbed = track(kept, 'pool', 'absorbedEnergyInJoules');
    expect(absorbed?.values[0]?.mean).toBeGreaterThan(0);
    expect(absorbed?.changes[0]?.mean).toBe(0);
    expect(track(kept, 'pool', 'temperatureInKelvin')?.changes[0]?.mean).toBe(0);
    const renamed = runExperiment(replaced('vapour'), { includeSystemReport: false });
    expect(track(renamed, 'pool', 'absorbedEnergyInJoules')?.values[1]).toBeNull();
  });

  it('refuses a keyframe it cannot read', () => {
    const refused: readonly KeyframeWatch[][] = [
      [{ target: 'ocean', quantity: 'temperatureInKelvin' }],
      [{ target: 'drop', quantity: 'energyInGev' }],
      [{ target: 'system', quantity: 'temperatureInKelvin' }],
      [
        { target: 'drop', quantity: 'temperatureInKelvin' },
        { target: 'drop', quantity: 'temperatureInKelvin' },
      ],
    ];
    refused.forEach((watch) => expect(() => compilePlan(alphaInDrop(watch))).toThrow());
    expect(() =>
      compilePlan(
        experiment('dotted')
          .create('alpha', 'alphaParticle')
          .keyframe('a.b', [{ target: 'system', quantity: 'particleCount' }])
          .build(),
      ),
    ).toThrow(/dot|точку/);
    expect(() =>
      compilePlan(alphaInDrop([{ target: 'system', quantity: 'count.alphaParticle' }])),
    ).not.toThrow();
  });
});
