/* Two-qubit entangled states: the four Bell states, the spin singlet and the triplet with zero projection. */
import { ENTANGLED_STATE_AMPLITUDES, type EntangledState } from '@standard-model/contracts';
import { StateVector } from './state-vector.js';

export const ENTANGLED_STATE_DIMENSION = 4;

export function entangledState(name: EntangledState): StateVector {
  return StateVector.fromAmplitudes(ENTANGLED_STATE_AMPLITUDES[name]);
}
