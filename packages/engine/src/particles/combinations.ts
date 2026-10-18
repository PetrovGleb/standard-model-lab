/* Combinations: bookkeeping assembly of a catalog composite from its constituents (u u d -> proton); no binding dynamics, momenta add, mass from the catalog, spin left unpolarized. */
import { particleSpec } from '@standard-model/constants';
import {
  PARTICLE_NAMES,
  type Particle,
  type ParticleName,
  type RandomSource,
} from '@standard-model/contracts';
import { addVectors, sampleIsotropicDirection, ZERO_VECTOR } from '@standard-model/utils';
import type { QuantumCore } from '../quantum/quantum-core.js';
import type { ParticleFactory } from './particle-factory.js';
import { LocalizedError, localizedText } from '@standard-model/contracts';

function sortedNames(names: readonly ParticleName[]): string {
  return [...names].sort().join('+');
}

export function compositeFor(constituents: readonly ParticleName[]): ParticleName | null {
  const wanted = sortedNames(constituents);
  const match = PARTICLE_NAMES.find((name) => {
    const spec = particleSpec(name);
    return (
      spec.family !== 'diquark' &&
      spec.constituents !== null &&
      sortedNames(spec.constituents) === wanted
    );
  });
  return match ?? null;
}

export class Combinations {
  constructor(
    private readonly particles: ParticleFactory,
    private readonly quantum: QuantumCore,
    private readonly random: RandomSource,
  ) {}

  combine(constituents: readonly Particle[]): Particle {
    const retired = constituents.find((particle) => particle.status !== 'alive');
    if (retired !== undefined) {
      throw new LocalizedError(
        localizedText(
          `${retired.id} в состоянии ${retired.status} и не может войти в составную частицу`,
          `${retired.id} is ${retired.status} and cannot be combined`,
        ),
      );
    }
    const names = constituents.map((particle) => particle.spec.name);
    const composite = compositeFor(names);
    if (composite === null) {
      throw new LocalizedError(
        localizedText(
          `в каталоге нет частицы из ${names.join(' + ')}`,
          `No catalog particle is made of ${names.join(' + ')}`,
        ),
      );
    }
    const momentum = constituents.reduce(
      (sum, particle) => addVectors(sum, particle.kinematics.fourMomentumInGev.momentum),
      ZERO_VECTOR,
    );
    const centroid = constituents.reduce(
      (sum, particle) => addVectors(sum, particle.kinematics.positionInFemtometers),
      ZERO_VECTOR,
    );
    constituents.forEach((particle) => {
      particle.quantumSlots.forEach((slot) => {
        const register = this.quantum.registers.byId(slot.registerId);
        if (register.slots.length > 1) {
          throw new LocalizedError(
            localizedText(
              `${particle.id} запутана; сборка из запутанных частиц пока не поддерживается`,
              `${particle.id} is entangled; combining entangled particles is not supported yet`,
            ),
          );
        }
        this.quantum.registers.dispose(register);
      });
      particle.markBound();
    });
    const bound = this.particles.create(composite, {
      momentumInGev: momentum,
      positionInFemtometers: {
        x: centroid.x / constituents.length,
        y: centroid.y / constituents.length,
        z: centroid.z / constituents.length,
      },
    });
    this.prepareUnpolarizedSpin(bound);
    return bound;
  }

  private prepareUnpolarizedSpin(particle: Particle): void {
    const spin = particle.observables.find((observable) => observable.name === 'spin');
    if (spin === undefined || spin.dimension !== 2) {
      return;
    }
    const direction = sampleIsotropicDirection(this.random);
    this.quantum.prepare(particle, 'spin', {
      polarAngleDegrees: (Math.acos(direction.z) * 180) / Math.PI,
      azimuthDegrees: (Math.atan2(direction.y, direction.x) * 180) / Math.PI,
    });
  }
}
