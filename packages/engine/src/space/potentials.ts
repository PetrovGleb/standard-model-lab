/* Potentials of the cube in a registry: free space, a harmonic trap, a barrier, a Coulomb centre, a wall with two slits, a quartic double well and a box, each the energy in joules at a point
   for a particle of a given mass and charge; and the mirror wall of the cube for waves, a layer as high as the largest kinetic energy one cell can hold, so it reflects every wave the grid
   carries without shortening the time step. A new potential is one entry in the registry. */
import {
  ELEMENTARY_CHARGE,
  REDUCED_PLANCK_CONSTANT,
  VACUUM_ELECTRIC_PERMITTIVITY,
} from '@standard-model/constants';
import type { PotentialKind } from '@standard-model/contracts';

const HBAR = REDUCED_PLANCK_CONSTANT.value;
const JOULES_PER_EV = ELEMENTARY_CHARGE.value;
const COULOMB_CONSTANT = 1 / (4 * Math.PI * VACUUM_ELECTRIC_PERMITTIVITY.value);
const WELL_CEILING_IN_BARRIERS = 8;
const WELL_TRANSVERSE_STIFFNESS = 4;
const HALF = 0.5;

export interface PotentialSettings {
  readonly cellSizeInMeters: number;
  readonly potentialEnergyInEv: number;
  readonly barrierThicknessInMeters: number;
  readonly nuclearCharge: number;
  readonly slitSeparationInMeters?: number;
  readonly slitWidthInMeters?: number;
  readonly wellSeparationInMeters?: number;
  readonly boxSizeInMeters?: number;
}

export interface PotentialParticle {
  readonly massInKilograms: number;
  readonly chargeInElementaryUnits: number;
}

export type PotentialLaw = (
  x: number,
  y: number,
  z: number,
  settings: PotentialSettings,
  particle: PotentialParticle,
) => number;

function height(settings: PotentialSettings): number {
  return settings.potentialEnergyInEv * JOULES_PER_EV;
}

export const POTENTIAL_LAWS: Readonly<Record<PotentialKind, PotentialLaw>> = {
  free: () => 0,
  harmonic: (x, y, z, settings, particle) => {
    const angularFrequency = height(settings) / HBAR;
    return (
      HALF *
      particle.massInKilograms *
      angularFrequency *
      angularFrequency *
      (x * x + y * y + z * z)
    );
  },
  barrier: (x, y, z, settings) =>
    Math.abs(x) <= settings.barrierThicknessInMeters / 2 ? height(settings) : 0,
  coulomb: (x, y, z, settings, particle) => {
    const softening = settings.cellSizeInMeters / 2;
    return (
      (COULOMB_CONSTANT *
        settings.nuclearCharge *
        particle.chargeInElementaryUnits *
        JOULES_PER_EV *
        JOULES_PER_EV) /
      Math.sqrt(x * x + y * y + z * z + softening * softening)
    );
  },
  doubleSlit: (x, y, z, settings) => {
    const inWall = Math.abs(x) <= settings.barrierThicknessInMeters / 2;
    const inSlit =
      Math.abs(Math.abs(y) - (settings.slitSeparationInMeters ?? 0) / 2) <=
      (settings.slitWidthInMeters ?? 0) / 2;
    return inWall && !inSlit ? height(settings) : 0;
  },
  doubleWell: (x, y, z, settings) => {
    const halfSeparation = (settings.wellSeparationInMeters ?? 0) / 2;
    const along = (x / halfSeparation) ** 2 - 1;
    const across = (WELL_TRANSVERSE_STIFFNESS * (y * y + z * z)) / halfSeparation ** 2;
    return (
      Math.min(along * along + across, WELL_CEILING_IN_BARRIERS) *
      settings.potentialEnergyInEv *
      JOULES_PER_EV
    );
  },
  box: (x, y, z, settings) =>
    Math.max(Math.abs(x), Math.abs(y), Math.abs(z)) > (settings.boxSizeInMeters ?? 0) / 2
      ? height(settings)
      : 0,
};

export function mirrorWallEnergyInJoules(
  settings: PotentialSettings,
  particle: PotentialParticle,
): number {
  return (HBAR * Math.PI) ** 2 / (2 * particle.massInKilograms * settings.cellSizeInMeters ** 2);
}
