/* Molecule: atoms held by covalent bonds, the top of the composition chain molecule ⊃ atom ⊃ nucleus and electrons ⊃ nucleons ⊃ quarks; carries its internal (rotational and vibrational) temperature and its UFF structure. */
import { CompositeParticle } from './composite-particle.js';
import { molecularStructure, type MolecularStructure } from '../molecules/molecular-structure.js';

export class Molecule extends CompositeParticle {
  internalTemperatureInKelvin = 0;

  get structure(): MolecularStructure {
    return molecularStructure(this.spec.name);
  }
}
