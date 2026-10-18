/* Flat phase-space sampling for two- and three-body decays in the parent rest frame, with an optional matrix-element weight, plus the boost to the lab frame. */
import type { FourMomentumInGev, RandomSource } from '@standard-model/contracts';
import {
  boostFromRest,
  lorentzBoost,
  sampleIsotropicDirection,
  scaleVector,
  totalEnergyInGev,
  twoBodyDecayMomentumInGev,
  velocityFractionVector,
} from '@standard-model/utils';

export type MatrixElementWeight = (
  energiesInParentFrameInGev: readonly number[],
  parentMassInGev: number,
) => number;

const MAX_REJECTION_TRIES = 100_000;
const WEIGHT_SCAN_POINTS = 256;

function backToBack(
  firstMassInGev: number,
  secondMassInGev: number,
  momentumMagnitudeInGev: number,
  random: RandomSource,
): readonly [FourMomentumInGev, FourMomentumInGev] {
  const direction = sampleIsotropicDirection(random);
  const firstMomentum = scaleVector(direction, momentumMagnitudeInGev);
  const secondMomentum = scaleVector(direction, -momentumMagnitudeInGev);
  return [
    { energy: totalEnergyInGev(firstMassInGev, momentumMagnitudeInGev), momentum: firstMomentum },
    { energy: totalEnergyInGev(secondMassInGev, momentumMagnitudeInGev), momentum: secondMomentum },
  ];
}

export function twoBodyRestFrame(
  parentMassInGev: number,
  masses: readonly [number, number],
  random: RandomSource,
): readonly FourMomentumInGev[] {
  const [first, second] = masses;
  return backToBack(
    first,
    second,
    twoBodyDecayMomentumInGev(parentMassInGev, first, second),
    random,
  );
}

function threeBodyWeight(
  parentMassInGev: number,
  masses: readonly [number, number, number],
  pairMassInGev: number,
): number {
  const [first, second, third] = masses;
  return (
    twoBodyDecayMomentumInGev(parentMassInGev, pairMassInGev, third) *
    twoBodyDecayMomentumInGev(pairMassInGev, first, second)
  );
}

function samplePairMass(
  parentMassInGev: number,
  masses: readonly [number, number, number],
  random: RandomSource,
): number {
  const [first, second, third] = masses;
  const lower = first + second;
  const upper = parentMassInGev - third;
  if (upper <= lower) {
    throw new Error('Three-body decay is kinematically forbidden');
  }
  let maximumWeight = 0;
  for (let point = 0; point <= WEIGHT_SCAN_POINTS; point += 1) {
    const candidate = lower + ((upper - lower) * point) / WEIGHT_SCAN_POINTS;
    maximumWeight = Math.max(maximumWeight, threeBodyWeight(parentMassInGev, masses, candidate));
  }
  for (let attempt = 0; attempt < MAX_REJECTION_TRIES; attempt += 1) {
    const candidate = lower + (upper - lower) * random.nextUnit();
    if (random.nextUnit() * maximumWeight <= threeBodyWeight(parentMassInGev, masses, candidate)) {
      return candidate;
    }
  }
  throw new Error('Three-body phase-space sampling did not converge');
}

export function threeBodyRestFrame(
  parentMassInGev: number,
  masses: readonly [number, number, number],
  random: RandomSource,
  weight: MatrixElementWeight | null = null,
): readonly FourMomentumInGev[] {
  const [first, second, third] = masses;
  for (let attempt = 0; attempt < MAX_REJECTION_TRIES; attempt += 1) {
    const pairMass = samplePairMass(parentMassInGev, masses, random);
    const [pair, thirdMomentum] = backToBack(
      pairMass,
      third,
      twoBodyDecayMomentumInGev(parentMassInGev, pairMass, third),
      random,
    );
    const pairVelocity = velocityFractionVector(pair);
    const [firstMomentum, secondMomentum] = backToBack(
      first,
      second,
      twoBodyDecayMomentumInGev(pairMass, first, second),
      random,
    ).map((momentum) => lorentzBoost(momentum, pairVelocity)) as [
      FourMomentumInGev,
      FourMomentumInGev,
    ];
    const momenta = [firstMomentum, secondMomentum, thirdMomentum];
    if (weight === null) {
      return momenta;
    }
    const acceptance = Math.min(
      1,
      weight(
        momenta.map((momentum) => momentum.energy),
        parentMassInGev,
      ),
    );
    if (random.nextUnit() <= acceptance) {
      return momenta;
    }
  }
  throw new Error('Matrix-element sampling did not converge');
}

export function boostToLab(
  restFrameMomenta: readonly FourMomentumInGev[],
  parent: FourMomentumInGev,
  parentMassInGev?: number,
): readonly FourMomentumInGev[] {
  return restFrameMomenta.map((momentum) => boostFromRest(momentum, parent, parentMassInGev));
}
