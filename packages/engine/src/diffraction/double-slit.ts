/* DoubleSlit: Fraunhofer two-slit pattern for a particle's de Broglie wavelength; fringe visibility drops with which-path detection or environment decoherence over the flight. */
import { PLANCK_CONSTANT_IN_EV_PER_HERTZ, SPEED_OF_LIGHT } from '@standard-model/constants';
import type { Environment, Particle, RandomSource } from '@standard-model/contracts';
import { EV_PER_GEV, vectorMagnitude, velocityInMetersPerSecond } from '@standard-model/utils';
import type { Dynamics } from '../environment/dynamics.js';
import { LocalizedError, localizedText } from '@standard-model/contracts';

export interface SlitGeometry {
  readonly slitSeparationInMeters: number;
  readonly slitWidthInMeters: number;
  readonly screenDistanceInMeters: number;
  readonly whichPathDetector: boolean;
  readonly pathMarked?: boolean;
}

export interface ScreenHit {
  readonly positionInMicrometers: number;
  readonly wavelengthInMeters: number;
  readonly fringeSpacingInMicrometers: number;
  readonly visibility: number;
  readonly relativePhaseInRadians: number;
  readonly coherence: number;
}

const MICROMETERS_PER_METER = 1e6;
const FEMTOMETERS_PER_METER = 1e15;
const ENVELOPE_ZEROS_ON_EACH_SIDE = 3;
const PEAK_INTENSITY = 2;
const MAX_REJECTION_TRIES = 1_000_000;
const PLANCK_TIMES_LIGHT_IN_EV_METERS =
  PLANCK_CONSTANT_IN_EV_PER_HERTZ.value * SPEED_OF_LIGHT.value;

function sinc(argument: number): number {
  return argument === 0 ? 1 : Math.sin(argument) / argument;
}

export function deBroglieWavelengthInMeters(momentumInGev: number): number {
  if (momentumInGev <= 0) {
    throw new LocalizedError(
      localizedText(
        'у покоящейся частицы нет длины волны де Бройля; задайте ей импульс',
        'A particle at rest has no de Broglie wavelength; give it momentum',
      ),
    );
  }
  return PLANCK_TIMES_LIGHT_IN_EV_METERS / (momentumInGev * EV_PER_GEV);
}

export function screenIntensity(
  positionInMeters: number,
  wavelengthInMeters: number,
  geometry: Omit<SlitGeometry, 'whichPathDetector' | 'pathMarked'>,
  visibility: number,
): number {
  const scale =
    (Math.PI * positionInMeters) / (wavelengthInMeters * geometry.screenDistanceInMeters);
  const envelope = sinc(scale * geometry.slitWidthInMeters) ** 2;
  return envelope * (1 + visibility * Math.cos(2 * scale * geometry.slitSeparationInMeters));
}

export class DoubleSlit {
  constructor(
    private readonly dynamics: Dynamics,
    private readonly random: RandomSource,
  ) {}

  fringeVisibility(particle: Particle, environment: Environment, geometry: SlitGeometry): number {
    if (geometry.whichPathDetector) {
      return 0;
    }
    const speed = vectorMagnitude(
      velocityInMetersPerSecond(
        particle.spec.massInGev.value,
        particle.kinematics.fourMomentumInGev.momentum,
      ),
    );
    const flightTime = geometry.screenDistanceInMeters / speed;
    const dephasingRate = this.dynamics.decoherenceRates(
      particle,
      environment,
    ).dephasingRateInHertz;
    return Math.exp(-dephasingRate * flightTime);
  }

  sample(particle: Particle, environment: Environment, geometry: SlitGeometry): ScreenHit {
    if (
      geometry.slitWidthInMeters <= 0 ||
      geometry.slitSeparationInMeters <= 0 ||
      geometry.screenDistanceInMeters <= 0
    ) {
      throw new LocalizedError(
        localizedText(
          'ширина щелей, расстояние между ними и до экрана должны быть положительными',
          'Slit width, separation and screen distance must be positive',
        ),
      );
    }
    const momentum = particle.kinematics.fourMomentumInGev.momentum;
    const wavelength = deBroglieWavelengthInMeters(vectorMagnitude(momentum));
    const coherence = this.fringeVisibility(particle, environment, geometry);
    const visibility = geometry.pathMarked === true ? 0 : coherence;
    const halfRange =
      (ENVELOPE_ZEROS_ON_EACH_SIDE * wavelength * geometry.screenDistanceInMeters) /
      geometry.slitWidthInMeters;
    for (let attempt = 0; attempt < MAX_REJECTION_TRIES; attempt += 1) {
      const position = (2 * this.random.nextUnit() - 1) * halfRange;
      if (
        this.random.nextUnit() * PEAK_INTENSITY <=
        screenIntensity(position, wavelength, geometry, visibility)
      ) {
        const current = particle.kinematics.positionInFemtometers;
        particle.setPosition({
          x: current.x,
          y: current.y + position * FEMTOMETERS_PER_METER,
          z: current.z + geometry.screenDistanceInMeters * FEMTOMETERS_PER_METER,
        });
        return {
          positionInMicrometers: position * MICROMETERS_PER_METER,
          wavelengthInMeters: wavelength,
          fringeSpacingInMicrometers:
            ((wavelength * geometry.screenDistanceInMeters) / geometry.slitSeparationInMeters) *
            MICROMETERS_PER_METER,
          visibility,
          relativePhaseInRadians:
            (2 * Math.PI * position * geometry.slitSeparationInMeters) /
            (wavelength * geometry.screenDistanceInMeters),
          coherence,
        };
      }
    }
    throw new Error('Double-slit sampling did not converge');
  }
}
