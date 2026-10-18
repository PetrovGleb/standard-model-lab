/* Sampling helpers: weighted index choice by cumulative sum, exponential decay times, isotropic directions, Gaussian deviates. */
import type { RandomSource, Vector3 } from '@standard-model/contracts';

export function normalizeWeights(weights: readonly number[]): number[] {
  const total = weights.reduce((sum, weight) => sum + Math.max(weight, 0), 0);
  if (total <= 0) {
    throw new Error('Weights must contain at least one positive value');
  }
  return weights.map((weight) => Math.max(weight, 0) / total);
}

export function sampleIndexByWeights(weights: readonly number[], random: RandomSource): number {
  const probabilities = normalizeWeights(weights);
  const draw = random.nextUnit();
  let cumulative = 0;
  for (let index = 0; index < probabilities.length; index += 1) {
    cumulative += probabilities[index] ?? 0;
    if (draw < cumulative) {
      return index;
    }
  }
  return probabilities.length - 1;
}

export function sampleExponentialTime(meanTime: number, random: RandomSource): number {
  const unitDraw = 1 - random.nextUnit();
  return -meanTime * Math.log(unitDraw);
}

export function sampleIsotropicDirection(random: RandomSource): Vector3 {
  const cosinePolar = 2 * random.nextUnit() - 1;
  const sinePolar = Math.sqrt(1 - cosinePolar * cosinePolar);
  const azimuth = 2 * Math.PI * random.nextUnit();
  return { x: sinePolar * Math.cos(azimuth), y: sinePolar * Math.sin(azimuth), z: cosinePolar };
}

export function sampleGaussian(standardDeviation: number, random: RandomSource): number {
  const radius = Math.sqrt(-2 * Math.log(1 - random.nextUnit()));
  return standardDeviation * radius * Math.cos(2 * Math.PI * random.nextUnit());
}
