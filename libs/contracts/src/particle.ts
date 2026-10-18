/* Engine-facing particle interfaces: what a live particle exposes, split into small capability interfaces. */
import type { ColorRepresentation, DecayChannel, ParticleSpec } from './particle-spec.js';
import type { Observable, ObservableName, QuantumSlot } from './quantum.js';
import type { FourMomentumInGev, Vector3 } from './vector.js';

export type InteractionKind = 'electromagnetic' | 'weak' | 'strong' | 'yukawa' | 'gravitational';

export interface ParticleKinematics {
  readonly fourMomentumInGev: FourMomentumInGev;
  readonly positionInFemtometers: Vector3;
  readonly properTimeInSeconds: number;
}

export type ParticleStatus = 'alive' | 'decayed' | 'bound' | 'collided';

export interface ParticleCreationOptions {
  readonly momentumInGev?: Vector3;
  readonly positionInFemtometers?: Vector3;
}

export interface Particle {
  readonly id: string;
  readonly spec: ParticleSpec;
  readonly interactions: ReadonlySet<InteractionKind>;
  readonly observables: readonly Observable[];
  readonly kinematics: ParticleKinematics;
  readonly status: ParticleStatus;
  readonly quantumSlots: ReadonlyMap<ObservableName, QuantumSlot>;
  quantumSlot(observable: ObservableName): QuantumSlot | null;
  setMomentum(momentumInGev: Vector3): void;
  setPosition(positionInFemtometers: Vector3): void;
  boost(velocityFraction: Vector3): void;
  advanceProperTime(seconds: number): void;
  bindQuantumSlot(slot: QuantumSlot): void;
  releaseQuantumSlot(observable: ObservableName): void;
  markDecayed(): void;
  markBound(): void;
  markCollided(): void;
}

export interface Decayable {
  readonly decayChannels: readonly DecayChannel[];
  readonly meanLifeInSeconds: number | null;
}

export interface ElectricallyCharged {
  readonly electricChargeInElementaryUnits: number;
}

export interface ColorCharged {
  readonly colorRepresentation: ColorRepresentation;
}

export interface MagneticDipole {
  readonly magneticMomentInJoulesPerTesla: number;
  readonly gyromagneticRatioInRadiansPerSecondPerTesla: number;
}

export interface Composite {
  readonly constituents: readonly Particle[];
}
