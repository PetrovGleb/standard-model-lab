/* PhenomenologicalDecoherenceContributor: coherence times aspect gives dephasing 1/T2 and relaxation 1/T1 rates. */
import type {
  DecoherenceContributor,
  DecoherenceRates,
  Environment,
  EnvironmentAspectKey,
} from '@standard-model/contracts';

const NO_RATES: DecoherenceRates = { dephasingRateInHertz: 0, relaxationRateInHertz: 0 };

export class PhenomenologicalDecoherenceContributor implements DecoherenceContributor {
  readonly aspectKey: EnvironmentAspectKey = 'coherenceTimes';

  rates(environment: Environment): DecoherenceRates {
    const times = environment.get('coherenceTimes');
    if (times === undefined) {
      return NO_RATES;
    }
    return {
      dephasingRateInHertz:
        times.dephasingTimeInSeconds === null ? 0 : 1 / times.dephasingTimeInSeconds,
      relaxationRateInHertz:
        times.relaxationTimeInSeconds === null ? 0 : 1 / times.relaxationTimeInSeconds,
    };
  }
}
