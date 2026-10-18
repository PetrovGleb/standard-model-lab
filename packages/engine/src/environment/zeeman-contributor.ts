/* ZeemanContributor: magnetic field aspect gives H = -(mu / j hbar) (B . S) in rad/s on the spin slot of magnetic dipoles. */
import { REDUCED_PLANCK_CONSTANT } from '@standard-model/constants';
import type {
  Environment,
  EnvironmentAspectKey,
  HamiltonianContributor,
  HamiltonianTerm,
  Particle,
} from '@standard-model/contracts';
import { isMagneticDipole } from '../particles/capabilities.js';
import { addMatrices, scaleMatrix, type ComplexMatrix } from '../quantum/linear-algebra.js';
import { spinFromDimension, spinOperators } from '../quantum/spin-operators.js';

export class ZeemanContributor implements HamiltonianContributor<ComplexMatrix> {
  readonly aspectKey: EnvironmentAspectKey = 'magneticField';

  contribute(
    environment: Environment,
    particle: Particle,
  ): readonly HamiltonianTerm<ComplexMatrix>[] {
    const field = environment.get('magneticField');
    const spinObservable = particle.observables.find((observable) => observable.name === 'spin');
    if (field === undefined || spinObservable === undefined || !isMagneticDipole(particle)) {
      return [];
    }
    const spin = spinFromDimension(spinObservable.dimension);
    const signedGyromagneticRatio =
      particle.magneticMomentInJoulesPerTesla / (spin * REDUCED_PLANCK_CONSTANT.value);
    const operators = spinOperators(spin);
    const fieldDotSpin = addMatrices(
      addMatrices(
        scaleMatrix(operators.x, field.fieldInTesla.x),
        scaleMatrix(operators.y, field.fieldInTesla.y),
      ),
      scaleMatrix(operators.z, field.fieldInTesla.z),
    );
    return [
      {
        observable: 'spin',
        operatorInRadiansPerSecond: scaleMatrix(fieldDotSpin, -signedGyromagneticRatio),
      },
    ];
  }
}
