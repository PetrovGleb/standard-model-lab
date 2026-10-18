/* CollisionalDecoherenceContributor: a statistical medium scrambles phase at the collision rate summed over its components, n sigma v_rel each; also exposes mean free path. */
import { SPEED_OF_LIGHT, particleSpec } from '@standard-model/constants';
import type {
  DecoherenceContributor,
  DecoherenceRates,
  Environment,
  EnvironmentAspectKey,
  MediumAspect,
  Particle,
} from '@standard-model/contracts';
import {
  gevToKilograms,
  subtractVectors,
  thermalMeanSpeedInMetersPerSecond,
  vectorMagnitude,
  velocityInMetersPerSecond,
} from '@standard-model/utils';

const NO_RATES: DecoherenceRates = { dephasingRateInHertz: 0, relaxationRateInHertz: 0 };

export function meanFreePathInMeters(medium: MediumAspect): number {
  return (
    1 /
    medium.components.reduce(
      (sum, component) =>
        sum + component.numberDensityPerCubicMeter * component.crossSectionInSquareMeters,
      0,
    )
  );
}

export function collisionRatePerSecond(medium: MediumAspect, particle: Particle): number {
  const relativeDrift = vectorMagnitude(
    subtractVectors(
      velocityInMetersPerSecond(
        particle.spec.massInGev.value,
        particle.kinematics.fourMomentumInGev.momentum,
      ),
      medium.bulkVelocityInMetersPerSecond,
    ),
  );
  return medium.components.reduce((sum, component) => {
    const speciesMassInKilograms = gevToKilograms(particleSpec(component.species).massInGev.value);
    const thermalSpeed =
      speciesMassInKilograms > 0
        ? thermalMeanSpeedInMetersPerSecond(speciesMassInKilograms, medium.temperatureInKelvin)
        : SPEED_OF_LIGHT.value;
    return (
      sum +
      component.numberDensityPerCubicMeter *
        component.crossSectionInSquareMeters *
        (relativeDrift + thermalSpeed)
    );
  }, 0);
}

export class CollisionalDecoherenceContributor implements DecoherenceContributor {
  readonly aspectKey: EnvironmentAspectKey = 'medium';

  rates(environment: Environment, particle: Particle): DecoherenceRates {
    const medium = environment.get('medium');
    if (medium === undefined) {
      return NO_RATES;
    }
    return {
      dephasingRateInHertz: collisionRatePerSecond(medium, particle),
      relaxationRateInHertz: 0,
    };
  }
}
