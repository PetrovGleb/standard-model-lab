/* ProjectiveCollapse: the von Neumann collapse strategy, sampling one outcome by its Born probability. */
import type {
  CollapseStrategy,
  MeasurementCandidate,
  RandomSource,
} from '@standard-model/contracts';
import { sampleIndexByWeights } from '@standard-model/utils';
import type { StateVector } from './state-vector.js';

export class ProjectiveCollapse implements CollapseStrategy<StateVector> {
  readonly name = 'projective';

  choose(
    candidates: readonly MeasurementCandidate<StateVector>[],
    random: RandomSource,
  ): MeasurementCandidate<StateVector> {
    const index = sampleIndexByWeights(
      candidates.map((candidate) => candidate.probability),
      random,
    );
    const chosen = candidates[index];
    if (chosen === undefined) {
      throw new Error('No measurement candidate to choose from');
    }
    return chosen;
  }
}
