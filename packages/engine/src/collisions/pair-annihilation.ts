/* PairAnnihilation: an electron and a positron overlapping in the space cube annihilate at the contact rate (π r_e² c) · ∫ρ₋ρ₊ d³r, weighted by their spin-singlet share; the pair turns into two photons. */
import { CLASSICAL_ELECTRON_RADIUS, SPEED_OF_LIGHT_IN_VACUUM } from '@standard-model/constants';
import type { Particle, RandomSource } from '@standard-model/contracts';
import { ENTANGLED_STATE_DIMENSION, entangledState } from '../quantum/entangled-states.js';
import { entryAt } from '../quantum/linear-algebra.js';
import type { QuantumCore } from '../quantum/quantum-core.js';
import type { ResolvedSpace, SpaceLab, SpatialState } from '../space/space-lab.js';
import type { CollisionEvent, Collisions } from './collisions.js';

export const SPIN_AVERAGED_ANNIHILATION_RATE_COEFFICIENT_IN_CUBIC_METERS_PER_SECOND =
  Math.PI * CLASSICAL_ELECTRON_RADIUS.value ** 2 * SPEED_OF_LIGHT_IN_VACUUM.value;

const SINGLET_STATES_PER_SPIN_AVERAGE = 4;
const SPIN = 'spin';
const TWO_PHOTONS = 'photon+photon';

interface BlochVector {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export class PairAnnihilation {
  constructor(
    private readonly quantum: QuantumCore,
    private readonly collisions: Collisions,
    private readonly space: SpaceLab,
    private readonly random: RandomSource,
  ) {}

  singletShare(electron: Particle, positron: Particle): number | null {
    const electronSlot = electron.quantumSlots.get(SPIN);
    const positronSlot = positron.quantumSlots.get(SPIN);
    if (electronSlot === undefined || positronSlot === undefined) {
      return null;
    }
    if (electronSlot.registerId === positronSlot.registerId) {
      const register = this.quantum.registers.registerOf(electron, SPIN);
      if (register.dimension === ENTANGLED_STATE_DIMENSION) {
        return register.state.fidelityWith(entangledState('spinSinglet'));
      }
    }
    const first = this.bloch(electron);
    const second = this.bloch(positron);
    return (
      (1 - (first.x * second.x + first.y * second.y + first.z * second.z)) /
      SINGLET_STATES_PER_SPIN_AVERAGE
    );
  }

  ratePerSecond(
    space: ResolvedSpace,
    electron: Particle,
    electronState: SpatialState,
    positron: Particle,
    positronState: SpatialState,
  ): number {
    const share = this.singletShare(electron, positron);
    const spinWeight = share === null ? 1 : SINGLET_STATES_PER_SPIN_AVERAGE * share;
    return (
      spinWeight *
      SPIN_AVERAGED_ANNIHILATION_RATE_COEFFICIENT_IN_CUBIC_METERS_PER_SECOND *
      this.space.overlapDensityPerCubicMeter(space, electronState, positronState)
    );
  }

  happens(integratedRate: number): boolean {
    return this.random.nextUnit() < 1 - Math.exp(-integratedRate);
  }

  annihilate(electron: Particle, positron: Particle): CollisionEvent {
    return this.collisions.collide(electron, positron, TWO_PHOTONS);
  }

  private bloch(particle: Particle): BlochVector {
    const reduced = this.quantum.reducedStateOf(particle, SPIN).matrix;
    const offDiagonal = entryAt(reduced, 0, 1);
    return {
      x: 2 * offDiagonal.real,
      y: -2 * offDiagonal.imaginary,
      z: entryAt(reduced, 0, 0).real - entryAt(reduced, 1, 1).real,
    };
  }
}
