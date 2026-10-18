/* Checks the two-slit physics: de Broglie wavelength, fringe spacing and minima, loss of fringes with which-path detection or gas, sampled histograms and the delayed-choice eraser coincidences. */
import type { Distribution } from '@standard-model/contracts';
import { DEFAULT_MONTE_CARLO_SHOTS } from '@standard-model/utils';
import { describe, expect, it } from 'vitest';
import {
  createEngine,
  createEnvironment,
  deBroglieWavelengthInMeters,
  DELAYED_CHOICE_ERASER_TEMPLATE,
  DOUBLE_SLIT_TEMPLATE,
  DOUBLE_SLIT_WHICH_PATH_TEMPLATE,
  runExperiment,
  screenIntensity,
} from '../src/index.js';

const GEOMETRY = {
  slitSeparationInMeters: 1e-6,
  slitWidthInMeters: 2e-7,
  screenDistanceInMeters: 1,
};
const ELECTRON_50_KEV_MOMENTUM_IN_GEV = 2.315e-4;

describe('double slit', () => {
  it('gives a 50 keV electron a wavelength of about 5.36 pm', () => {
    expect(deBroglieWavelengthInMeters(ELECTRON_50_KEV_MOMENTUM_IN_GEV)).toBeCloseTo(5.356e-12, 14);
    expect(() => deBroglieWavelengthInMeters(0)).toThrow(/rest/);
  });

  it('has bright fringes every λL/d and dark ones in between, unless the path is known', () => {
    const wavelength = deBroglieWavelengthInMeters(ELECTRON_50_KEV_MOMENTUM_IN_GEV);
    const spacing =
      (wavelength * GEOMETRY.screenDistanceInMeters) / GEOMETRY.slitSeparationInMeters;
    expect(screenIntensity(0, wavelength, GEOMETRY, 1)).toBeCloseTo(2, 12);
    expect(screenIntensity(spacing / 2, wavelength, GEOMETRY, 1)).toBeCloseTo(0, 12);
    expect(screenIntensity(spacing, wavelength, GEOMETRY, 1)).toBeGreaterThan(1.5);
    expect(screenIntensity(spacing / 2, wavelength, GEOMETRY, 0)).toBeGreaterThan(0.9);
  });

  it('loses fringe visibility to a gas along the flight', () => {
    const engine = createEngine({ seed: 1 });
    const electron = engine.particles.create('electron', {
      momentumInGev: { x: 0, y: 0, z: ELECTRON_50_KEV_MOMENTUM_IN_GEV },
    });
    const vacuum = createEnvironment();
    const gas = createEnvironment({
      medium: {
        components: [
          {
            species: 'proton',
            numberDensityPerCubicMeter: 1e19,
            crossSectionInSquareMeters: 1e-19,
          },
        ],
        temperatureInKelvin: 300,
        bulkVelocityInMetersPerSecond: { x: 0, y: 0, z: 0 },
        reactionMode: 'oneReactionPerStep',
      },
    });
    const geometry = { ...GEOMETRY, whichPathDetector: false };
    expect(engine.doubleSlit.fringeVisibility(electron, vacuum, geometry)).toBe(1);
    const inGas = engine.doubleSlit.fringeVisibility(electron, gas, geometry);
    expect(inGas).toBeGreaterThan(0.3);
    expect(inGas).toBeLessThan(0.45);
    expect(
      engine.doubleSlit.fringeVisibility(electron, vacuum, {
        ...geometry,
        whichPathDetector: true,
      }),
    ).toBe(0);
  });

  it('fills the first dark fringe only when the which-path detector is on', () => {
    const darkFringeInMicrometers = 2.678;
    const windowInMicrometers = 0.4;
    const shots = 6000;
    const fractionNear = (target: number, whichPathDetector: boolean): number => {
      const engine = createEngine({ seed: 3 });
      const environment = createEnvironment();
      let hits = 0;
      for (let shot = 0; shot < shots; shot += 1) {
        const electron = engine.particles.create('electron', {
          momentumInGev: { x: 0, y: 0, z: ELECTRON_50_KEV_MOMENTUM_IN_GEV },
        });
        const hit = engine.doubleSlit.sample(electron, environment, {
          ...GEOMETRY,
          whichPathDetector,
        });
        if (Math.abs(Math.abs(hit.positionInMicrometers) - target) < windowInMicrometers) {
          hits += 1;
        }
      }
      return hits / shots;
    };
    expect(fractionNear(darkFringeInMicrometers, true)).toBeGreaterThan(
      5 * fractionNear(darkFringeInMicrometers, false),
    );
    expect(fractionNear(0, false)).toBeGreaterThan(1.5 * fractionNear(0, true));
    const histogram = runExperiment(DOUBLE_SLIT_TEMPLATE, {
      shots: 500,
      seed: 3,
      includeSystemReport: false,
    });
    expect(Object.values(histogram.distributions)[0]?.samples).toBe(500);
    const detected = runExperiment(DOUBLE_SLIT_WHICH_PATH_TEMPLATE, {
      shots: 500,
      seed: 3,
      includeSystemReport: false,
    });
    expect(Object.values(detected.distributions)[0]?.samples).toBe(500);
  });
});

describe('delayed-choice quantum eraser', () => {
  const geometry = DELAYED_CHOICE_ERASER_TEMPLATE.parameters;
  const micrometersPerMeter = 1e6;
  const fringeSpacingInMicrometers =
    ((deBroglieWavelengthInMeters(geometry.momentumInGev ?? 0) *
      (geometry.screenDistanceInMeters ?? 0)) /
      (geometry.slitSeparationInMeters ?? 1)) *
    micrometersPerMeter;
  const contrast = (distribution: Distribution | undefined): number => {
    let weighted = 0;
    let total = 0;
    distribution?.counts.forEach((count, index) => {
      const center =
        ((distribution.binEdges[index] ?? 0) + (distribution.binEdges[index + 1] ?? 0)) / 2;
      weighted += count * Math.cos((2 * Math.PI * center) / fringeSpacingInMicrometers);
      total += count;
    });
    return weighted / total;
  };
  const run = (idlerPolarAngleDegrees: number) => {
    const plan = DELAYED_CHOICE_ERASER_TEMPLATE;
    return Object.values(
      runExperiment(
        { ...plan, parameters: { ...plan.parameters, idlerPolarAngleDegrees } },
        { shots: DEFAULT_MONTE_CARLO_SHOTS, seed: 9 },
      ).distributions,
    ).map(contrast);
  };

  it('hides fringes on the whole screen and shows fringes and anti-fringes in eraser coincidences', () => {
    const [all, plus, minus] = run(90);
    expect(Math.abs(all ?? 1)).toBeLessThan(0.05);
    expect(plus).toBeGreaterThan(0.4);
    expect(minus).toBeLessThan(-0.4);
  });

  it('shows no fringes in either group when the idler reveals the path', () => {
    run(0).forEach((value) => expect(Math.abs(value)).toBeLessThan(0.05));
  });
});
