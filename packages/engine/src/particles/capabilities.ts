/* Capability helpers: type guards for the small particle interfaces plus shared derivations of lifetime, lepton flavor and gyromagnetic ratio. */
import { REDUCED_PLANCK_CONSTANT } from '@standard-model/constants';
import type {
  ColorCharged,
  Composite,
  Decayable,
  ElectricallyCharged,
  LeptonFlavor,
  MagneticDipole,
  ObservableName,
  Particle,
  ParticleSpec,
} from '@standard-model/contracts';
import { widthInGevToMeanLifeInSeconds } from '@standard-model/utils';

export function isDecayable(particle: Particle): particle is Particle & Decayable {
  return 'decayChannels' in particle;
}

export function isElectricallyCharged(
  particle: Particle,
): particle is Particle & ElectricallyCharged {
  return 'electricChargeInElementaryUnits' in particle;
}

export function isColorCharged(particle: Particle): particle is Particle & ColorCharged {
  return 'colorRepresentation' in particle;
}

export function isMagneticDipole(particle: Particle): particle is Particle & MagneticDipole {
  return 'gyromagneticRatioInRadiansPerSecondPerTesla' in particle;
}

export function isComposite(particle: Particle): particle is Particle & Composite {
  return 'constituents' in particle;
}

export function meanLifeInSecondsFromSpec(spec: ParticleSpec): number | null {
  if (spec.meanLifeInSeconds !== null) {
    return spec.meanLifeInSeconds.value;
  }
  if (spec.widthInGev !== null && spec.widthInGev.value > 0) {
    return widthInGevToMeanLifeInSeconds(spec.widthInGev.value);
  }
  return null;
}

export function leptonFlavorOf(spec: ParticleSpec): LeptonFlavor {
  const flavors: readonly LeptonFlavor[] = ['electron', 'muon', 'tau'];
  const flavor = flavors.find((candidate) => spec.leptonNumbers[candidate] !== 0);
  if (flavor === undefined) {
    throw new Error(`${spec.name} carries no lepton family number`);
  }
  return flavor;
}

export function gyromagneticRatioFromMoment(
  magneticMomentInJoulesPerTesla: number,
  spinInReducedPlanckUnits: number,
): number {
  return (
    Math.abs(magneticMomentInJoulesPerTesla) /
    (spinInReducedPlanckUnits * REDUCED_PLANCK_CONSTANT.value)
  );
}

export function observableNamesForSpec(spec: ParticleSpec): readonly ObservableName[] {
  const spinDimension = Math.round(2 * spec.spinInReducedPlanckUnits + 1);
  if (spec.family === 'gaugeBoson') {
    return ['polarization'];
  }
  const names: ObservableName[] = spinDimension > 1 ? ['spin'] : [];
  if (spec.family === 'neutrino') {
    names.push('flavor');
  }
  return names;
}

export function directionalObservableOf(spec: ParticleSpec): ObservableName | null {
  return (
    observableNamesForSpec(spec).find((name) => name === 'spin' || name === 'polarization') ?? null
  );
}
