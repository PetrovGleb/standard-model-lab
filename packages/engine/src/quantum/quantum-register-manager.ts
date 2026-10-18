/* QuantumRegisterManager: allocates registers to particle observables, merges registers by tensor product and keeps particle slots in sync. */
import type { IdGenerator, Observable, ObservableName, Particle } from '@standard-model/contracts';
import { QuantumRegister, type RegisterSlot } from './quantum-register.js';
import type { StateVector } from './state-vector.js';
import { LocalizedError, localizedText } from '@standard-model/contracts';

const REGISTER_ID_PREFIX = 'register';

export class QuantumRegisterManager {
  private readonly registers = new Map<string, QuantumRegister>();
  private readonly particlesById = new Map<string, Particle>();

  constructor(private readonly ids: IdGenerator) {}

  allocate(particle: Particle, observable: Observable, initialState: StateVector): QuantumRegister {
    if (particle.quantumSlot(observable.name) !== null) {
      throw new Error(`${particle.id} ${observable.name} already has a register`);
    }
    const slot: RegisterSlot = {
      particleId: particle.id,
      observable: observable.name,
      dimension: observable.dimension,
    };
    const register = new QuantumRegister(this.ids.next(REGISTER_ID_PREFIX), [slot], initialState);
    this.registers.set(register.id, register);
    this.particlesById.set(particle.id, particle);
    this.bindAll(register);
    return register;
  }

  byId(registerId: string): QuantumRegister {
    const register = this.registers.get(registerId);
    if (register === undefined) {
      throw new Error(`Unknown register ${registerId}`);
    }
    return register;
  }

  registerOf(particle: Particle, observable: ObservableName): QuantumRegister {
    const slot = particle.quantumSlot(observable);
    if (slot === null) {
      throw new LocalizedError(
        localizedText(
          `${particle.id}: ${observable} не приготовлен ни в одном регистре`,
          `${particle.id} ${observable} is not prepared in any register`,
        ),
      );
    }
    return this.byId(slot.registerId);
  }

  merge(first: QuantumRegister, second: QuantumRegister): QuantumRegister {
    if (first.id === second.id) {
      throw new Error('Cannot merge a register with itself');
    }
    this.unbindAll(first);
    this.unbindAll(second);
    this.registers.delete(first.id);
    this.registers.delete(second.id);
    const merged = new QuantumRegister(
      this.ids.next(REGISTER_ID_PREFIX),
      [...first.slots, ...second.slots],
      first.state.tensor(second.state),
    );
    this.registers.set(merged.id, merged);
    this.bindAll(merged);
    return merged;
  }

  dispose(register: QuantumRegister): void {
    this.unbindAll(register);
    this.registers.delete(register.id);
  }

  get size(): number {
    return this.registers.size;
  }

  private bindAll(register: QuantumRegister): void {
    register.slots.forEach((slot, slotIndex) => {
      this.particleOf(slot.particleId).bindQuantumSlot({
        registerId: register.id,
        slotIndex,
        dimension: slot.dimension,
        observable: slot.observable,
      });
    });
  }

  private unbindAll(register: QuantumRegister): void {
    register.slots.forEach((slot) => {
      this.particleOf(slot.particleId).releaseQuantumSlot(slot.observable);
    });
  }

  private particleOf(particleId: string): Particle {
    const particle = this.particlesById.get(particleId);
    if (particle === undefined) {
      throw new Error(`Unknown particle ${particleId}`);
    }
    return particle;
  }
}
