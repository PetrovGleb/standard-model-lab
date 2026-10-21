/* Field and medium influences: apply or remove magnetic and electric fields, set coherence times, set the statistical medium of one or more components, place a body of a medium in space
   (a body with the same shape, centre and size replaces the old one, others stay; one with the same name too is the same body with a new makeup and keeps its temperature and absorbed
   energy). */
import type {
  CoherenceTimesAspect,
  Influence,
  InfluenceOutcome,
  MediumAspect,
  Particle,
  Vector3,
} from '@standard-model/contracts';
import type { EngineInfluenceContext } from './context.js';
import { sameGeometry } from '../space/geometry.js';

export class ApplyMagneticField implements Influence<EngineInfluenceContext> {
  readonly name = 'applyMagneticField';
  readonly environmentOnly = true;

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
  readonly environmentOnly = true;

  apply(targets: readonly Particle[], context: EngineInfluenceContext): InfluenceOutcome {
    return { environment: context.environment.without('magneticField'), notes: [] };
  }
}

export class ApplyElectricField implements Influence<EngineInfluenceContext> {
  readonly name = 'applyElectricField';
  readonly environmentOnly = true;

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
  readonly environmentOnly = true;

  constructor(private readonly times: CoherenceTimesAspect) {}

  apply(targets: readonly Particle[], context: EngineInfluenceContext): InfluenceOutcome {
    return { environment: context.environment.with('coherenceTimes', this.times), notes: [] };
  }
}

export class SetMedium implements Influence<EngineInfluenceContext> {
  readonly name = 'setMedium';
  readonly environmentOnly = true;

  constructor(private readonly medium: MediumAspect) {}

  apply(targets: readonly Particle[], context: EngineInfluenceContext): InfluenceOutcome {
    return { environment: context.environment.with('medium', this.medium), notes: [] };
  }
}

export class PlaceBody implements Influence<EngineInfluenceContext> {
  readonly name = 'placeBody';
  readonly environmentOnly = true;

  constructor(private readonly body: MediumAspect) {}

  apply(targets: readonly Particle[], context: EngineInfluenceContext): InfluenceOutcome {
    const geometry = this.body.geometry;
    const bodies = context.environment.get('bodies')?.bodies ?? [];
    const replaces = (body: MediumAspect): boolean =>
      geometry !== undefined &&
      body.geometry !== undefined &&
      sameGeometry(body.geometry, geometry);
    const same = bodies.find(
      (body) => replaces(body) && body.name !== undefined && body.name === this.body.name,
    );
    const placed =
      same === undefined
        ? this.body
        : {
            ...this.body,
            temperatureInKelvin: same.temperatureInKelvin,
            ...(same.absorbedEnergyInJoules === undefined
              ? {}
              : { absorbedEnergyInJoules: same.absorbedEnergyInJoules }),
          };
    return {
      environment: context.environment.with('bodies', {
        bodies: [...bodies.filter((body) => !replaces(body)), placed],
      }),
      notes: [],
    };
  }
}
