/* Neutrino: weak-only fermion exposing spin and a three-dimensional flavor observable for oscillation experiments. */
import type { LeptonFlavor, Observable } from '@standard-model/contracts';
import { leptonFlavorOf } from './capabilities.js';
import { Fermion } from './fermion.js';

const NEUTRINO_FLAVOR_COUNT = 3;

export class Neutrino extends Fermion {
  override get observables(): readonly Observable[] {
    return [...super.observables, { name: 'flavor', dimension: NEUTRINO_FLAVOR_COUNT }];
  }

  get flavor(): LeptonFlavor {
    return leptonFlavorOf(this.spec);
  }
}
