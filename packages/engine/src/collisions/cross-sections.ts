/* Tree-level Standard Model cross sections in natural units (GeV⁻²): e⁺e⁻ → f f̄ through γ and Z with running α, e⁺e⁻ ↔ γγ (Breit–Wheeler and detailed balance), Klein–Nishina Compton. */
import {
  FINE_STRUCTURE_CONSTANT,
  PARTICLE_CATALOG,
  PDG_2026,
  REDUCED_PLANCK_CONSTANT_TIMES_SPEED_OF_LIGHT_IN_MEV_FEMTOMETER,
  particleSpec,
} from '@standard-model/constants';
import type { ParticleName } from '@standard-model/contracts';

const ALPHA_AT_ZERO = FINE_STRUCTURE_CONSTANT.value;
const Z_MASS_IN_GEV = PARTICLE_CATALOG.zBoson.massInGev.value;
const Z_WIDTH_IN_GEV = PARTICLE_CATALOG.zBoson.widthInGev?.value ?? 0;
const WEAK_MIXING_SIN_SQUARED = PDG_2026.couplings.effectiveLeptonicWeakMixingAngleSinSquared.value;
const STRONG_COUPLING_AT_Z = PDG_2026.couplings.strongCouplingAtZMass.value;
const HADRONIC_VACUUM_POLARIZATION_AT_Z =
  PDG_2026.couplings.hadronicVacuumPolarizationAtZMass.value;
const ACTIVE_QUARK_FLAVORS = 5;
const FIVE_THIRDS = 5 / 3;
const HADRONIC_RUNNING_SCALE_IN_GEV_SQUARED = 1;
const MILLIBARN_PER_SQUARE_FEMTOMETER = 10;
const NANOBARN_PER_MILLIBARN = 1e6;
const GEV_PER_MEV = 1e-3;

const HBAR_C_IN_GEV_FEMTOMETER =
  REDUCED_PLANCK_CONSTANT_TIMES_SPEED_OF_LIGHT_IN_MEV_FEMTOMETER.value * GEV_PER_MEV;
export const NANOBARN_PER_INVERSE_GEV_SQUARED =
  HBAR_C_IN_GEV_FEMTOMETER *
  HBAR_C_IN_GEV_FEMTOMETER *
  MILLIBARN_PER_SQUARE_FEMTOMETER *
  NANOBARN_PER_MILLIBARN;

const LEPTONS: readonly ParticleName[] = ['electron', 'muon', 'tau'];

export function runningAlpha(centerOfMassEnergySquared: number): number {
  const leptonic = LEPTONS.reduce((sum, lepton) => {
    const massSquared = particleSpec(lepton).massInGev.value ** 2;
    if (centerOfMassEnergySquared <= 4 * massSquared) {
      return sum;
    }
    return (
      sum +
      (ALPHA_AT_ZERO / (3 * Math.PI)) *
        (Math.log(centerOfMassEnergySquared / massSquared) - FIVE_THIRDS)
    );
  }, 0);
  const hadronic =
    centerOfMassEnergySquared <= HADRONIC_RUNNING_SCALE_IN_GEV_SQUARED
      ? 0
      : (HADRONIC_VACUUM_POLARIZATION_AT_Z *
          Math.log(centerOfMassEnergySquared / HADRONIC_RUNNING_SCALE_IN_GEV_SQUARED)) /
        Math.log((Z_MASS_IN_GEV * Z_MASS_IN_GEV) / HADRONIC_RUNNING_SCALE_IN_GEV_SQUARED);
  return ALPHA_AT_ZERO / (1 - leptonic - hadronic);
}

export function runningStrongCoupling(centerOfMassEnergySquared: number): number {
  const firstCoefficient = 11 - (2 / 3) * ACTIVE_QUARK_FLAVORS;
  return (
    STRONG_COUPLING_AT_Z /
    (1 +
      ((STRONG_COUPLING_AT_Z * firstCoefficient) / (4 * Math.PI)) *
        Math.log(centerOfMassEnergySquared / (Z_MASS_IN_GEV * Z_MASS_IN_GEV)))
  );
}

export interface FermionChannel {
  readonly products: readonly [ParticleName, ParticleName];
  readonly chargeInElementaryUnits: number;
  readonly weakIsospin: number;
  readonly colors: number;
  readonly thresholdInGev: number;
  readonly massInGev: number;
}

function lepton(name: ParticleName, anti: ParticleName): FermionChannel {
  const mass = particleSpec(name).massInGev.value;
  return {
    products: [name, anti],
    chargeInElementaryUnits: -1,
    weakIsospin: -0.5,
    colors: 1,
    thresholdInGev: 2 * mass,
    massInGev: mass,
  };
}

function neutrino(name: ParticleName, anti: ParticleName): FermionChannel {
  return {
    products: [name, anti],
    chargeInElementaryUnits: 0,
    weakIsospin: 0.5,
    colors: 1,
    thresholdInGev: 0,
    massInGev: 0,
  };
}

function quark(name: ParticleName, anti: ParticleName, thresholdInGev: number): FermionChannel {
  const spec = particleSpec(name);
  const upType = spec.electricChargeInElementaryUnits > 0;
  return {
    products: [name, anti],
    chargeInElementaryUnits: spec.electricChargeInElementaryUnits,
    weakIsospin: upType ? 0.5 : -0.5,
    colors: 3,
    thresholdInGev,
    massInGev: spec.massInGev.value,
  };
}

const PERTURBATIVE_QCD_THRESHOLD_IN_GEV = 2;
const OPEN_CHARM_THRESHOLD_IN_GEV = 3.73;
const OPEN_BOTTOM_THRESHOLD_IN_GEV = 10.56;

export const ANNIHILATION_FERMION_CHANNELS: readonly FermionChannel[] = [
  lepton('muon', 'antiMuon'),
  lepton('tau', 'antiTau'),
  neutrino('electronNeutrino', 'electronAntineutrino'),
  neutrino('muonNeutrino', 'muonAntineutrino'),
  neutrino('tauNeutrino', 'tauAntineutrino'),
  quark('up', 'antiUp', PERTURBATIVE_QCD_THRESHOLD_IN_GEV),
  quark('down', 'antiDown', PERTURBATIVE_QCD_THRESHOLD_IN_GEV),
  quark('strange', 'antiStrange', PERTURBATIVE_QCD_THRESHOLD_IN_GEV),
  quark('charm', 'antiCharm', OPEN_CHARM_THRESHOLD_IN_GEV),
  quark('bottom', 'antiBottom', OPEN_BOTTOM_THRESHOLD_IN_GEV),
  quark('top', 'antiTop', 2 * PARTICLE_CATALOG.top.massInGev.value),
];

interface PropagatorFactors {
  readonly real: number;
  readonly squaredMagnitude: number;
}

function zPropagator(centerOfMassEnergySquared: number): PropagatorFactors {
  const normalization = 1 / (4 * WEAK_MIXING_SIN_SQUARED * (1 - WEAK_MIXING_SIN_SQUARED));
  const offShell = centerOfMassEnergySquared - Z_MASS_IN_GEV * Z_MASS_IN_GEV;
  const widthTerm = Z_MASS_IN_GEV * Z_WIDTH_IN_GEV;
  const denominator = offShell * offShell + widthTerm * widthTerm;
  const scale = normalization * centerOfMassEnergySquared;
  return {
    real: (scale * offShell) / denominator,
    squaredMagnitude: (scale * scale) / denominator,
  };
}

function vectorCoupling(weakIsospin: number, charge: number): number {
  return weakIsospin - 2 * charge * WEAK_MIXING_SIN_SQUARED;
}

export interface AngularCoefficients {
  readonly symmetric: number;
  readonly antisymmetric: number;
}

export function annihilationAngularCoefficients(
  channel: FermionChannel,
  centerOfMassEnergySquared: number,
): AngularCoefficients {
  const electronVector = vectorCoupling(-0.5, -1);
  const electronAxial = -0.5;
  const fermionVector = vectorCoupling(channel.weakIsospin, channel.chargeInElementaryUnits);
  const fermionAxial = channel.weakIsospin;
  const charge = channel.chargeInElementaryUnits;
  const propagator = zPropagator(centerOfMassEnergySquared);
  const symmetric =
    charge * charge -
    2 * charge * electronVector * fermionVector * propagator.real +
    (electronVector * electronVector + electronAxial * electronAxial) *
      (fermionVector * fermionVector + fermionAxial * fermionAxial) *
      propagator.squaredMagnitude;
  const antisymmetric =
    -4 * charge * electronAxial * fermionAxial * propagator.real +
    8 * electronVector * electronAxial * fermionVector * fermionAxial * propagator.squaredMagnitude;
  return { symmetric, antisymmetric };
}

function threshold(channel: FermionChannel, centerOfMassEnergy: number): number {
  if (centerOfMassEnergy <= channel.thresholdInGev || centerOfMassEnergy <= 2 * channel.massInGev) {
    return 0;
  }
  const velocitySquared =
    1 - (4 * channel.massInGev * channel.massInGev) / (centerOfMassEnergy * centerOfMassEnergy);
  const velocity = Math.sqrt(Math.max(velocitySquared, 0));
  return (velocity * (3 - velocitySquared)) / 2;
}

export function annihilationToFermions(
  channel: FermionChannel,
  centerOfMassEnergy: number,
): number {
  const suppression = threshold(channel, centerOfMassEnergy);
  if (suppression === 0) {
    return 0;
  }
  const centerOfMassEnergySquared = centerOfMassEnergy * centerOfMassEnergy;
  const fineStructure = runningAlpha(centerOfMassEnergySquared);
  const qcdCorrection =
    channel.colors === 3 ? 1 + runningStrongCoupling(centerOfMassEnergySquared) / Math.PI : 1;
  const { symmetric } = annihilationAngularCoefficients(channel, centerOfMassEnergySquared);
  return (
    ((4 * Math.PI * fineStructure * fineStructure) / (3 * centerOfMassEnergySquared)) *
    channel.colors *
    symmetric *
    qcdCorrection *
    suppression
  );
}

export function pairProductionFromPhotons(
  centerOfMassEnergy: number,
  fermionMassInGev: number,
): number {
  const ratio =
    (4 * fermionMassInGev * fermionMassInGev) / (centerOfMassEnergy * centerOfMassEnergy);
  if (ratio >= 1) {
    return 0;
  }
  const velocity = Math.sqrt(1 - ratio);
  const radiusSquared = (ALPHA_AT_ZERO / fermionMassInGev) ** 2;
  return (
    ((Math.PI * radiusSquared) / 2) *
    (1 - velocity * velocity) *
    ((3 - velocity ** 4) * Math.log((1 + velocity) / (1 - velocity)) -
      2 * velocity * (2 - velocity * velocity))
  );
}

export function annihilationToPhotons(centerOfMassEnergy: number): number {
  const electronMass = PARTICLE_CATALOG.electron.massInGev.value;
  const ratio = (4 * electronMass * electronMass) / (centerOfMassEnergy * centerOfMassEnergy);
  const velocity = Math.sqrt(Math.max(1 - ratio, 0));
  if (velocity < 1e-6) {
    return Infinity;
  }
  return pairProductionFromPhotons(centerOfMassEnergy, electronMass) / (2 * velocity * velocity);
}

export function kleinNishina(
  photonEnergyInElectronFrame: number,
  electronMassInGev: number,
): number {
  const ratio = photonEnergyInElectronFrame / electronMassInGev;
  const radiusSquared = (ALPHA_AT_ZERO / electronMassInGev) ** 2;
  if (ratio < 1e-4) {
    return ((8 * Math.PI) / 3) * radiusSquared * (1 - 2 * ratio);
  }
  const doubled = 1 + 2 * ratio;
  return (
    2 *
    Math.PI *
    radiusSquared *
    (((1 + ratio) / (ratio * ratio)) * ((2 * (1 + ratio)) / doubled - Math.log(doubled) / ratio) +
      Math.log(doubled) / (2 * ratio) -
      (1 + 3 * ratio) / (doubled * doubled))
  );
}

export function toNanobarns(crossSectionInInverseGevSquared: number): number {
  return crossSectionInInverseGevSquared * NANOBARN_PER_INVERSE_GEV_SQUARED;
}
