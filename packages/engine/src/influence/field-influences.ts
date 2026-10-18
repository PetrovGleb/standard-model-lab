/* Field and medium influences: apply or remove magnetic and electric fields, set coherence times, set the statistical medium of one or more components. */
import type {
  CoherenceTimesAspect,
  Influence,
  InfluenceOutcome,
  MediumAspect,
  Particle,
  Vector3,
} from '@standard-model/contracts';
import type { EngineInfluenceContext } from './context.js';

export class ApplyMagneticField implements Influence<EngineInfluenceContext> {
  readonly name = 'applyMagneticField';

  constructor(private readonly fieldInTesla: Vector3) {}

  apply(targets: readonly Particle[], context: EngineInfluenceContext): InfluenceOutcome {
    return {
      environment: context.environment.with('magneticField', { fieldInTesla: this.fieldInTesla }),
      notes: [],
    };
  }
}

export class RemoveMagneticField implements Influence<EngineInfluenceContext> {
  readonly name = 'removeMagneticField';

  apply(targets: readonly Particle[], context: EngineInfluenceContext): InfluenceOutcome {
    return { environment: context.environment.without('magneticField'), notes: [] };
  }
}

export class ApplyElectricField implements Influence<EngineInfluenceContext> {
  readonly name = 'applyElectricField';

  constructor(private readonly fieldInVoltsPerMeter: Vector3) {}

  apply(targets: readonly Particle[], context: EngineInfluenceContext): InfluenceOutcome {
    return {
      environment: context.environment.with('electricField', {
        fieldInVoltsPerMeter: this.fieldInVoltsPerMeter,
      }),
      notes: [],
    };
  }
}

export class SetCoherenceTimes implements Influence<EngineInfluenceContext> {
  readonly name = 'setCoherenceTimes';

  constructor(private readonly times: CoherenceTimesAspect) {}

  apply(targets: readonly Particle[], context: EngineInfluenceContext): InfluenceOutcome {
    return { environment: context.environment.with('coherenceTimes', this.times), notes: [] };
  }
}

export class SetMedium implements Influence<EngineInfluenceContext> {
  readonly name = 'setMedium';

  constructor(private readonly medium: MediumAspect) {}

  apply(targets: readonly Particle[], context: EngineInfluenceContext): InfluenceOutcome {
    return { environment: context.environment.with('medium', this.medium), notes: [] };
  }
}
