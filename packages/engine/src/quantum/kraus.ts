/* Kraus channels: dephasing and relaxation operator sets, the exact map on density matrices and the quantum-jump trajectory on pure states. */
import type { RandomSource } from '@standard-model/contracts';
import { sampleIndexByWeights } from '@standard-model/utils';
import { DensityMatrix } from './density-matrix.js';
import {
  addMatrices,
  adjoint,
  identityMatrix,
  multiplyMatrices,
  scaleMatrix,
  zeroMatrix,
  type ComplexMatrix,
} from './linear-algebra.js';
import { StateVector } from './state-vector.js';

export function applyKrausMap(
  density: DensityMatrix,
  krausOperators: readonly ComplexMatrix[],
): DensityMatrix {
  const mapped = krausOperators.reduce(
    (sum, kraus) =>
      addMatrices(sum, multiplyMatrices(multiplyMatrices(kraus, density.matrix), adjoint(kraus))),
    zeroMatrix(density.dimension, density.dimension),
  );
  return new DensityMatrix(mapped);
}

export function sampleKrausTrajectory(
  state: StateVector,
  krausOperators: readonly ComplexMatrix[],
  random: RandomSource,
): StateVector {
  const branches = krausOperators.map((kraus) => state.apply(kraus));
  const weights = branches.map((branch) => branch.norm() ** 2);
  const chosen = branches[sampleIndexByWeights(weights, random)];
  if (chosen === undefined) {
    throw new Error('Kraus channel produced no branch');
  }
  return chosen.normalized();
}

function basisProjector(dimension: number, index: number): ComplexMatrix {
  const projector = zeroMatrix(dimension, dimension);
  projector.real[index * dimension + index] = 1;
  return projector;
}

export function dephasingKraus(dimension: number, probability: number): readonly ComplexMatrix[] {
  const survive = scaleMatrix(identityMatrix(dimension), Math.sqrt(1 - probability));
  const collapses = Array.from({ length: dimension }, (ignored, index) =>
    scaleMatrix(basisProjector(dimension, index), Math.sqrt(probability)),
  );
  return [survive, ...collapses];
}

export function relaxationKraus(
  eigenvectors: readonly ComplexMatrix[],
  groundIndex: number,
  probability: number,
): readonly ComplexMatrix[] {
  const ground = eigenvectors[groundIndex];
  if (ground === undefined) {
    throw new Error(`No eigenvector ${String(groundIndex)}`);
  }
  const dimension = ground.rows;
  const stay = eigenvectors.reduce(
    (sum, vector, index) => {
      const projector = multiplyMatrices(vector, adjoint(vector));
      const weight = index === groundIndex ? 1 : Math.sqrt(1 - probability);
      return addMatrices(sum, scaleMatrix(projector, weight));
    },
    zeroMatrix(dimension, dimension),
  );
  const jumps = eigenvectors
    .map((vector, index) =>
      index === groundIndex
        ? null
        : scaleMatrix(multiplyMatrices(ground, adjoint(vector)), Math.sqrt(probability)),
    )
    .filter((jump): jump is ComplexMatrix => jump !== null);
  return [stay, ...jumps];
}
