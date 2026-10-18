/* Random pure states: Haar-distributed vectors from complex Gaussian amplitudes, and a random state inside a projector's subspace. */
import type { RandomSource } from '@standard-model/contracts';
import { multiplyMatrices, type ComplexMatrix } from './linear-algebra.js';
import { StateVector } from './state-vector.js';

function standardGaussianPair(random: RandomSource): readonly [number, number] {
  const radial = Math.sqrt(-2 * Math.log(1 - random.nextUnit()));
  const angle = 2 * Math.PI * random.nextUnit();
  return [radial * Math.cos(angle), radial * Math.sin(angle)];
}

export function haarRandomState(dimension: number, random: RandomSource): StateVector {
  const amplitudes = Array.from({ length: dimension }, () => {
    const [real, imaginary] = standardGaussianPair(random);
    return { real, imaginary };
  });
  return StateVector.fromAmplitudes(amplitudes).normalized();
}

export function randomStateInSubspace(projector: ComplexMatrix, random: RandomSource): StateVector {
  const projected = StateVector.fromColumn(
    multiplyMatrices(projector, haarRandomState(projector.rows, random).amplitudes),
  );
  return projected.normalized();
}
