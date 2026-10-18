/* NeutrinoFlavorContributor: vacuum oscillation Hamiltonian on the flavor slot, U diag(0, dm21, dm31) U-dagger / 2E with the PMNS matrix (CP phase zero). */
import { PDG_2026, REDUCED_PLANCK_CONSTANT_IN_EV_SECOND } from '@standard-model/constants';
import type {
  Environment,
  EnvironmentAspectKey,
  HamiltonianContributor,
  HamiltonianTerm,
  NeutrinoMixingAspect,
  Particle,
} from '@standard-model/contracts';
import { EV_PER_GEV } from '@standard-model/utils';
import {
  adjoint,
  matrixFromRows,
  multiplyMatrices,
  scaleMatrix,
  type ComplexMatrix,
} from '../quantum/linear-algebra.js';
import { LocalizedError, localizedText } from '@standard-model/contracts';

const oscillation = PDG_2026.neutrinoOscillation;

export const PDG_NEUTRINO_MIXING: NeutrinoMixingAspect = {
  mixingAngle12SinSquared: oscillation.mixingAngle12SinSquared.value,
  mixingAngle13SinSquared: oscillation.mixingAngle13SinSquared.value,
  mixingAngle23SinSquared: oscillation.mixingAngle23SinSquaredNormalOrdering.value,
  massSquaredDifference21InElectronVoltsSquared:
    oscillation.massSquaredDifference21InElectronVoltsSquared.value,
  massSquaredDifference31InElectronVoltsSquared:
    oscillation.massSquaredDifference32NormalOrderingInElectronVoltsSquared.value +
    oscillation.massSquaredDifference21InElectronVoltsSquared.value,
};

export function pmnsMatrix(mixing: NeutrinoMixingAspect): ComplexMatrix {
  const sine12 = Math.sqrt(mixing.mixingAngle12SinSquared);
  const sine13 = Math.sqrt(mixing.mixingAngle13SinSquared);
  const sine23 = Math.sqrt(mixing.mixingAngle23SinSquared);
  const cosine12 = Math.sqrt(1 - mixing.mixingAngle12SinSquared);
  const cosine13 = Math.sqrt(1 - mixing.mixingAngle13SinSquared);
  const cosine23 = Math.sqrt(1 - mixing.mixingAngle23SinSquared);
  return matrixFromRows([
    [cosine12 * cosine13, sine12 * cosine13, sine13],
    [
      -sine12 * cosine23 - cosine12 * sine23 * sine13,
      cosine12 * cosine23 - sine12 * sine23 * sine13,
      sine23 * cosine13,
    ],
    [
      sine12 * sine23 - cosine12 * cosine23 * sine13,
      -cosine12 * sine23 - sine12 * cosine23 * sine13,
      cosine23 * cosine13,
    ],
  ]);
}

export function flavorHamiltonianInRadiansPerSecond(
  mixing: NeutrinoMixingAspect,
  energyInGev: number,
): ComplexMatrix {
  if (energyInGev <= 0) {
    throw new LocalizedError(
      localizedText(
        'осцилляциям нейтрино нужна положительная энергия; задайте нейтрино импульс',
        'Neutrino oscillation needs a positive energy; give the neutrino momentum',
      ),
    );
  }
  const energyInEv = energyInGev * EV_PER_GEV;
  const massBasis = matrixFromRows([
    [0, 0, 0],
    [0, mixing.massSquaredDifference21InElectronVoltsSquared, 0],
    [0, 0, mixing.massSquaredDifference31InElectronVoltsSquared],
  ]);
  const mixingMatrix = pmnsMatrix(mixing);
  const flavorBasis = multiplyMatrices(
    multiplyMatrices(mixingMatrix, massBasis),
    adjoint(mixingMatrix),
  );
  return scaleMatrix(
    flavorBasis,
    1 / (2 * energyInEv * REDUCED_PLANCK_CONSTANT_IN_EV_SECOND.value),
  );
}

export class NeutrinoFlavorContributor implements HamiltonianContributor<ComplexMatrix> {
  readonly aspectKey: EnvironmentAspectKey | null = null;

  contribute(
    environment: Environment,
    particle: Particle,
  ): readonly HamiltonianTerm<ComplexMatrix>[] {
    if (particle.spec.family !== 'neutrino' || particle.kinematics.fourMomentumInGev.energy <= 0) {
      return [];
    }
    const mixing = environment.get('neutrinoMixing') ?? PDG_NEUTRINO_MIXING;
    return [
      {
        observable: 'flavor',
        operatorInRadiansPerSecond: flavorHamiltonianInRadiansPerSecond(
          mixing,
          particle.kinematics.fourMomentumInGev.energy,
        ),
      },
    ];
  }
}
