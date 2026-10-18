/* Electrolysis: electrodes at a voltage pass a current through the targets for a time. A molecule splits into its elements once the voltage exceeds its decomposition energy per transferred electron
   (bond energies of the molecule minus those of the element molecules it makes, the electrons being the orders of its bonds between unlike atoms); Faraday's law gives the share of molecules split,
   I·t/(z·e) electrons over the molecules of that kind in the cell, and atoms of elements whose diatomic molecule is a gas at room conditions pair up at the electrodes (2 H₂O → 2 H₂ + O₂). */
import {
  ELEMENTARY_CHARGE,
  atomName,
  moleculeName,
  moleculeStructureOf,
  ordinaryValence,
  type MoleculeStructure,
} from '@standard-model/constants';
import {
  LocalizedError,
  localizedText,
  type Influence,
  type InfluenceOutcome,
  type InfluenceReaction,
  type Particle,
  type ParticleName,
} from '@standard-model/contracts';
import { aggregateState } from '../environment/aggregate-state.js';
import { molecularStructure } from '../molecules/molecular-structure.js';
import { unchanged, type EngineInfluenceContext } from './context.js';

const ROOM_TEMPERATURE_IN_KELVIN = 298.15;
const STANDARD_ATMOSPHERE_IN_PASCALS = 101325;
const MAXIMUM_BOND_ORDER = 3;
const PAIR = 2;

export interface ElectrolysisSettings {
  readonly voltageInVolts: number;
  readonly currentInAmperes: number;
  readonly durationInSeconds: number;
}

function elementMolecule(protons: number, massNumber: number): ParticleName | null {
  const order = Math.min(ordinaryValence(protons), MAXIMUM_BOND_ORDER);
  if (order < 1) {
    return null;
  }
  const name = moleculeName({
    atoms: [
      { protons, massNumber },
      { protons, massNumber },
    ],
    bonds: [{ first: 0, second: 1, order }],
  });
  return aggregateState(name, ROOM_TEMPERATURE_IN_KELVIN, STANDARD_ATMOSPHERE_IN_PASCALS).phase ===
    'gas'
    ? name
    : null;
}

export function transferredElectrons(structure: MoleculeStructure): number {
  return structure.bonds
    .filter(
      (bond) => structure.atoms[bond.first]?.protons !== structure.atoms[bond.second]?.protons,
    )
    .reduce((sum, bond) => sum + bond.order, 0);
}

export function decompositionVoltageInVolts(name: ParticleName): number | null {
  if (!name.startsWith('molecule:')) {
    return null;
  }
  const structure = moleculeStructureOf(name);
  const electrons = transferredElectrons(structure);
  if (electrons === 0) {
    return null;
  }
  const broken = molecularStructure(name).bonds.reduce(
    (sum, bond) => sum + bond.dissociationEnergyInEv,
    0,
  );
  const formed = structure.atoms.reduce((sum, atom) => {
    const pairMolecule = elementMolecule(atom.protons, atom.massNumber);
    return pairMolecule === null
      ? sum
      : sum + (molecularStructure(pairMolecule).bonds[0]?.dissociationEnergyInEv ?? 0) / PAIR;
  }, 0);
  return (broken - formed) / electrons;
}

export class Electrolyze implements Influence<EngineInfluenceContext> {
  readonly name = 'electrolyze';

  constructor(private readonly settings: ElectrolysisSettings) {
    if (settings.currentInAmperes < 0 || settings.durationInSeconds < 0) {
      throw new LocalizedError(
        localizedText(
          'электролизу нужны неотрицательные ток и время',
          'electrolyze needs a non-negative current and duration',
        ),
      );
    }
  }

  apply(targets: readonly Particle[], context: EngineInfluenceContext): InfluenceOutcome {
    const candidates = targets.filter((particle) => {
      const voltage = decompositionVoltageInVolts(particle.spec.name);
      return (
        particle.status === 'alive' && voltage !== null && this.settings.voltageInVolts >= voltage
      );
    });
    const notes = targets
      .filter((particle) => !candidates.includes(particle))
      .map((particle) => {
        const voltage = decompositionVoltageInVolts(particle.spec.name);
        return voltage === null
          ? `${particle.spec.symbol} has no bonds between unlike atoms to split`
          : `${particle.spec.symbol} needs ${voltage.toFixed(2)} V to split`;
      });
    const electrons =
      (this.settings.currentInAmperes * this.settings.durationInSeconds) / ELEMENTARY_CHARGE.value;
    const bySpecies = new Map<ParticleName, number>();
    candidates.forEach((particle) =>
      bySpecies.set(particle.spec.name, (bySpecies.get(particle.spec.name) ?? 0) + 1),
    );
    const split = candidates.filter((particle) => {
      const structure = moleculeStructureOf(particle.spec.name);
      const share =
        electrons / (transferredElectrons(structure) * (bySpecies.get(particle.spec.name) ?? 1));
      return context.random.nextUnit() < Math.min(1, share);
    });
    const waiting = new Map<string, number>();
    const reactions: InfluenceReaction[] = split.map((parent, position) => {
      const names: ParticleName[] = [];
      moleculeStructureOf(parent.spec.name).atoms.forEach((atom) => {
        const pairMolecule = elementMolecule(atom.protons, atom.massNumber);
        const key = `${String(atom.protons)}:${String(atom.massNumber)}`;
        if (pairMolecule === null) {
          names.push(atomName(atom.protons, atom.massNumber, 0));
          return;
        }
        const pending = (waiting.get(key) ?? 0) + 1;
        if (pending === PAIR) {
          names.push(pairMolecule);
          waiting.set(key, 0);
        } else {
          waiting.set(key, pending);
        }
      });
      if (position === split.length - 1) {
        waiting.forEach((count, key) => {
          const [protons = 0, massNumber = 0] = key.split(':').map(Number);
          Array.from({ length: count }, () => names.push(atomName(protons, massNumber, 0)));
        });
      }
      return {
        parent,
        products: names.map((name) =>
          context.particles.create(name, {
            momentumInGev: parent.kinematics.fourMomentumInGev.momentum,
            positionInFemtometers: parent.kinematics.positionInFemtometers,
          }),
        ),
        label: localizedText(
          `электролиз при ${this.settings.voltageInVolts.toFixed(2)} В`,
          `electrolysis at ${this.settings.voltageInVolts.toFixed(2)} V`,
        ),
      };
    });
    return { ...unchanged(context, notes), reactions };
  }
}
