/* Abstract base of every particle: identity, spec, classical kinematics, register slot binding and the interaction set derived from quantum numbers. */
import type {
  InteractionKind,
  Observable,
  ObservableName,
  Particle,
  ParticleCreationOptions,
  ParticleKinematics,
  ParticleSpec,
  ParticleStatus,
  QuantumSlot,
  Vector3,
} from '@standard-model/contracts';
import {
  lorentzBoost,
  lorentzFactor as lorentzFactorOf,
  totalEnergyInGev,
  vectorMagnitude,
  ZERO_VECTOR,
} from '@standard-model/utils';

export interface ParticleBuildContext {
  readonly id: string;
  readonly options: ParticleCreationOptions;
  readonly constituents: readonly Particle[];
}

export abstract class AbstractParticle implements Particle {
  readonly id: string;
  readonly spec: ParticleSpec;
  private momentumInGev: Vector3;
  private positionInFemtometers: Vector3;
  private properTimeInSeconds = 0;
  private currentStatus: ParticleStatus = 'alive';
  private readonly slots = new Map<ObservableName, QuantumSlot>();
  private cachedInteractions: ReadonlySet<InteractionKind> | null = null;

  constructor(spec: ParticleSpec, context: ParticleBuildContext) {
    this.spec = spec;
    this.id = context.id;
    this.momentumInGev = context.options.momentumInGev ?? ZERO_VECTOR;
    this.positionInFemtometers = context.options.positionInFemtometers ?? ZERO_VECTOR;
  }

  get observables(): readonly Observable[] {
    const spinDimension = Math.round(2 * this.spec.spinInReducedPlanckUnits + 1);
    return spinDimension > 1 ? [{ name: 'spin', dimension: spinDimension }] : [];
  }

  get interactions(): ReadonlySet<InteractionKind> {
    if (this.cachedInteractions === null) {
      this.cachedInteractions = new Set(this.deriveInteractions());
    }
    return this.cachedInteractions;
  }

  get kinematics(): ParticleKinematics {
    return {
      fourMomentumInGev: { energy: this.energyInGev, momentum: this.momentumInGev },
      positionInFemtometers: this.positionInFemtometers,
      properTimeInSeconds: this.properTimeInSeconds,
    };
  }

  get status(): ParticleStatus {
    return this.currentStatus;
  }

  get isAlive(): boolean {
    return this.currentStatus === 'alive';
  }

  markDecayed(): void {
    this.retire('decayed');
  }

  markBound(): void {
    this.retire('bound');
  }

  markCollided(): void {
    this.retire('collided');
  }

  private retire(status: ParticleStatus): void {
    if (this.currentStatus !== 'alive') {
      throw new Error(`${this.id} is already ${this.currentStatus}`);
    }
    this.currentStatus = status;
  }

  get quantumSlots(): ReadonlyMap<ObservableName, QuantumSlot> {
    return this.slots;
  }

  quantumSlot(observable: ObservableName): QuantumSlot | null {
    return this.slots.get(observable) ?? null;
  }

  get massInGev(): number {
    return this.spec.massInGev.value;
  }

  get momentumMagnitudeInGev(): number {
    return vectorMagnitude(this.momentumInGev);
  }

  get energyInGev(): number {
    return totalEnergyInGev(this.massInGev, this.momentumMagnitudeInGev);
  }

  get lorentzFactor(): number {
    return lorentzFactorOf(this.massInGev, this.momentumMagnitudeInGev);
  }

  get isAtRest(): boolean {
    return this.momentumMagnitudeInGev === 0;
  }

  get isAntiparticle(): boolean {
    return this.spec.pdgId < 0;
  }

  get isStable(): boolean {
    return this.spec.decays.length === 0;
  }

  setMomentum(momentumInGev: Vector3): void {
    this.momentumInGev = momentumInGev;
  }

  setPosition(positionInFemtometers: Vector3): void {
    this.positionInFemtometers = positionInFemtometers;
  }

  boost(velocityFraction: Vector3): void {
    this.momentumInGev = lorentzBoost(this.kinematics.fourMomentumInGev, velocityFraction).momentum;
  }

  advanceProperTime(seconds: number): void {
    if (seconds < 0) {
      throw new Error('Proper time cannot move backwards');
    }
    this.properTimeInSeconds += seconds;
  }

  bindQuantumSlot(slot: QuantumSlot): void {
    const existing = this.slots.get(slot.observable);
    if (existing !== undefined) {
      throw new Error(
        `${this.id} ${slot.observable} is already bound to register ${existing.registerId}`,
      );
    }
    this.slots.set(slot.observable, slot);
  }

  releaseQuantumSlot(observable: ObservableName): void {
    this.slots.delete(observable);
  }

  protected deriveInteractions(): readonly InteractionKind[] {
    const kinds: InteractionKind[] = ['gravitational'];
    if (this.spec.electricChargeInElementaryUnits !== 0) {
      kinds.push('electromagnetic');
    }
    if (this.spec.colorRepresentation !== 'singlet') {
      kinds.push('strong');
    }
    if (
      this.spec.weakIsospinThirdComponent.leftHanded !== 0 ||
      this.spec.weakHypercharge.leftHanded !== 0
    ) {
      kinds.push('weak');
    }
    if (this.massInGev > 0) {
      kinds.push('yukawa');
    }
    return [...kinds, ...this.carrierInteractions()];
  }

  protected carrierInteractions(): readonly InteractionKind[] {
    return [];
  }
}
