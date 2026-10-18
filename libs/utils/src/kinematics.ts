/* Relativistic kinematics in natural units (GeV): energies, Lorentz factor, boosts, two-body decay momentum. */
import { SPEED_OF_LIGHT } from '@standard-model/constants';
import type { FourMomentumInGev, Vector3 } from '@standard-model/contracts';
import { addVectors, dotProduct, scaleVector, vectorMagnitude, ZERO_VECTOR } from './vector.js';

export function totalEnergyInGev(massInGev: number, momentumMagnitudeInGev: number): number {
  return Math.sqrt(momentumMagnitudeInGev * momentumMagnitudeInGev + massInGev * massInGev);
}

export function lorentzFactor(massInGev: number, momentumMagnitudeInGev: number): number {
  if (massInGev === 0) {
    return Number.POSITIVE_INFINITY;
  }
  return totalEnergyInGev(massInGev, momentumMagnitudeInGev) / massInGev;
}

export function velocityFraction(massInGev: number, momentumMagnitudeInGev: number): number {
  return momentumMagnitudeInGev / totalEnergyInGev(massInGev, momentumMagnitudeInGev);
}

export function fourMomentumFromMomentum(
  massInGev: number,
  momentumInGev: Vector3,
): FourMomentumInGev {
  return {
    energy: totalEnergyInGev(massInGev, vectorMagnitude(momentumInGev)),
    momentum: momentumInGev,
  };
}

export function velocityInMetersPerSecond(massInGev: number, momentumInGev: Vector3): Vector3 {
  const magnitude = vectorMagnitude(momentumInGev);
  if (magnitude === 0) {
    return ZERO_VECTOR;
  }
  const speed = velocityFraction(massInGev, magnitude) * SPEED_OF_LIGHT.value;
  return scaleVector(momentumInGev, speed / magnitude);
}

export function velocityFractionVector(fourMomentum: FourMomentumInGev): Vector3 {
  return scaleVector(fourMomentum.momentum, 1 / fourMomentum.energy);
}

export function twoBodyDecayMomentumInGev(
  parentMassInGev: number,
  firstMassInGev: number,
  secondMassInGev: number,
): number {
  const massSum = firstMassInGev + secondMassInGev;
  if (parentMassInGev < massSum) {
    throw new Error('Decay is kinematically forbidden: parent lighter than products');
  }
  const massDifference = firstMassInGev - secondMassInGev;
  const parentMassSquared = parentMassInGev * parentMassInGev;
  const radicand =
    (parentMassSquared - massSum * massSum) * (parentMassSquared - massDifference * massDifference);
  return Math.sqrt(radicand) / (2 * parentMassInGev);
}

export function threeBodyEndpointEnergyInGev(
  parentMassInGev: number,
  daughterMassInGev: number,
): number {
  return (
    (parentMassInGev * parentMassInGev + daughterMassInGev * daughterMassInGev) /
    (2 * parentMassInGev)
  );
}

export function invariantMassInGev(fourMomentum: FourMomentumInGev): number {
  const momentumSquared = dotProduct(fourMomentum.momentum, fourMomentum.momentum);
  return Math.sqrt(Math.max(fourMomentum.energy * fourMomentum.energy - momentumSquared, 0));
}

export function lorentzBoost(
  fourMomentum: FourMomentumInGev,
  velocityFraction: Vector3,
): FourMomentumInGev {
  const speedFractionSquared = dotProduct(velocityFraction, velocityFraction);
  if (speedFractionSquared >= 1) {
    throw new Error('Boost velocity must be below the speed of light');
  }
  if (speedFractionSquared === 0) {
    return fourMomentum;
  }
  const boostFactor = 1 / Math.sqrt(1 - speedFractionSquared);
  const momentumAlongBoost = dotProduct(fourMomentum.momentum, velocityFraction);
  const energy = boostFactor * (fourMomentum.energy + momentumAlongBoost);
  const momentumShift =
    ((boostFactor - 1) * momentumAlongBoost) / speedFractionSquared +
    boostFactor * fourMomentum.energy;
  const momentum = addVectors(fourMomentum.momentum, scaleVector(velocityFraction, momentumShift));
  return { energy, momentum };
}

export function boostFromRest(
  fourMomentum: FourMomentumInGev,
  system: FourMomentumInGev,
  systemMassInGev: number = invariantMassInGev(system),
): FourMomentumInGev {
  if (!(systemMassInGev > 0)) {
    return fourMomentum;
  }
  const lorentzFactorValue = system.energy / systemMassInGev;
  const rapidityVector = scaleVector(system.momentum, 1 / systemMassInGev);
  const projection = dotProduct(rapidityVector, fourMomentum.momentum);
  return {
    energy: lorentzFactorValue * fourMomentum.energy + projection,
    momentum: addVectors(
      fourMomentum.momentum,
      scaleVector(rapidityVector, fourMomentum.energy + projection / (lorentzFactorValue + 1)),
    ),
  };
}

export function boostToRest(
  fourMomentum: FourMomentumInGev,
  system: FourMomentumInGev,
  systemMassInGev: number = invariantMassInGev(system),
): FourMomentumInGev {
  return boostFromRest(
    fourMomentum,
    { energy: system.energy, momentum: scaleVector(system.momentum, -1) },
    systemMassInGev,
  );
}
