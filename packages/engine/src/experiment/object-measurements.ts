/* Object measurements for measureSystem: every object reports mass, charge, spin and motion; a nucleus adds its nucleon numbers, binding per nucleon, separation energies and half-life; an atom or ion adds its electrons, next ionization energy, Landé factor and kinetic temperature; a molecule adds its bonds, geometry, dipole, rotational constants, vibrational modes and internal temperature. */
import {
  BOHR_MAGNETON,
  BOLTZMANN_CONSTANT_IN_EV_PER_KELVIN,
  NEUTRON_MASS_ENERGY_EQUIVALENT_IN_MEV,
  PROTON_MASS_ENERGY_EQUIVALENT_IN_MEV,
  ionizationEnergyInEv,
  matterIdentity,
  nucleusName,
  nuclideRecord,
  restMassInGev,
} from '@standard-model/constants';
import type { Particle } from '@standard-model/contracts';
import { EV_PER_GEV, vectorMagnitude } from '@standard-model/utils';
import { meanVibrationalQuanta } from '../molecules/molecular-behaviour.js';
import { Molecule } from '../particles/molecule.js';
import { separationEnergyInMev } from '../radiation/photon-absorption.js';

const MEV_PER_GEV = 1e3;
const KINETIC_DEGREES_OF_FREEDOM = 3;

function kineticTemperatureInKelvin(particle: Particle): number {
  const { energy, momentum } = particle.kinematics.fourMomentumInGev;
  const momentumSquared = momentum.x ** 2 + momentum.y ** 2 + momentum.z ** 2;
  const kineticInEv = (momentumSquared / (energy + particle.spec.massInGev.value)) * EV_PER_GEV;
  return (
    (2 * kineticInEv) / (KINETIC_DEGREES_OF_FREEDOM * BOLTZMANN_CONSTANT_IN_EV_PER_KELVIN.value)
  );
}

function common(particle: Particle): Record<string, number> {
  const momentum = vectorMagnitude(particle.kinematics.fourMomentumInGev.momentum);
  const energy = particle.kinematics.fourMomentumInGev.energy;
  const readings: Record<string, number> = {
    massInGev: particle.spec.massInGev.value,
    chargeInElementaryUnits: particle.spec.electricChargeInElementaryUnits,
    spin: particle.spec.spinInReducedPlanckUnits,
    energyInGev: energy,
    momentumInGev: momentum,
    speedFraction: energy > 0 ? momentum / energy : 0,
  };
  const meanLife = particle.spec.meanLifeInSeconds?.value;
  if (meanLife !== undefined) {
    readings.meanLifeInSeconds = meanLife;
  }
  const moment = particle.spec.magneticMomentInJoulesPerTesla?.value;
  if (moment !== undefined) {
    readings.magneticMomentInBohrMagnetons = moment / BOHR_MAGNETON.value;
  }
  return readings;
}

function nuclear(protons: number, massNumber: number): Record<string, number> {
  const neutrons = massNumber - protons;
  const nucleusMassInMev = restMassInGev(nucleusName(protons, massNumber)) * MEV_PER_GEV;
  const readings: Record<string, number> = {
    protons,
    neutrons,
    massNumber,
    bindingEnergyPerNucleonInMev:
      (protons * PROTON_MASS_ENERGY_EQUIVALENT_IN_MEV.value +
        neutrons * NEUTRON_MASS_ENERGY_EQUIVALENT_IN_MEV.value -
        nucleusMassInMev) /
      massNumber,
  };
  const halfLife = nuclideRecord(protons, massNumber)?.halfLifeInSeconds;
  if (halfLife !== undefined && halfLife !== null) {
    readings.halfLifeInSeconds = halfLife;
  }
  const neutronSeparation = separationEnergyInMev(protons, massNumber, 'neutron');
  if (neutronSeparation !== null) {
    readings.neutronSeparationEnergyInMev = neutronSeparation;
  }
  const protonSeparation = separationEnergyInMev(protons, massNumber, 'proton');
  if (protonSeparation !== null) {
    readings.protonSeparationEnergyInMev = protonSeparation;
  }
  return readings;
}

function molecular(molecule: Molecule): Record<string, number> {
  const structure = molecule.structure;
  const wavenumbers = structure.normalModes.map((mode) => mode.wavenumberInInverseCentimeters);
  const rotational = structure.rotationalConstantsInGigahertz;
  const temperature = molecule.internalTemperatureInKelvin;
  return {
    atomCount: structure.atoms.length,
    bondCount: structure.bonds.length,
    massInDaltons: structure.massInAtomicMassUnits,
    dipoleMomentInDebye: structure.dipoleMomentInDebye,
    largestRotationalConstantInGigahertz: Math.max(0, ...rotational),
    smallestRotationalConstantInGigahertz: rotational.length === 0 ? 0 : Math.min(...rotational),
    vibrationalModeCount: wavenumbers.length,
    lowestWavenumberInInverseCentimeters: wavenumbers.length === 0 ? 0 : Math.min(...wavenumbers),
    highestWavenumberInInverseCentimeters: Math.max(0, ...wavenumbers),
    internalTemperatureInKelvin: temperature,
    vibrationalQuanta: meanVibrationalQuanta(structure, temperature).reduce(
      (sum, quanta) => sum + quanta,
      0,
    ),
    bondEnergyInEv: structure.totalBindingInEv,
    weakestBondInEv: Math.min(...structure.bonds.map((bond) => bond.dissociationEnergyInEv)),
    meanBondLengthInAngstrom:
      structure.bondLengthsInAngstrom.reduce((sum, length) => sum + length, 0) /
      Math.max(1, structure.bondLengthsInAngstrom.length),
    kineticTemperatureInKelvin: kineticTemperatureInKelvin(molecule),
  };
}

export function objectReadings(particle: Particle): Readonly<Record<string, number>> {
  const readings = common(particle);
  if (particle instanceof Molecule) {
    return { ...readings, ...molecular(particle) };
  }
  const identity = matterIdentity(particle.spec.name);
  if (identity === null) {
    return readings;
  }
  const nucleusReadings = nuclear(identity.protons, identity.massNumber);
  if (identity.kind === 'nucleus') {
    return { ...readings, ...nucleusReadings };
  }
  const electrons = identity.protons - identity.charge;
  const nextIonization = ionizationEnergyInEv(identity.protons, identity.charge);
  return {
    ...readings,
    ...nucleusReadings,
    electrons,
    ...(nextIonization === null ? {} : { ionizationEnergyInEv: nextIonization }),
    ...(particle.spec.gFactor === null ? {} : { landeFactor: particle.spec.gFactor.value }),
    kineticTemperatureInKelvin: kineticTemperatureInKelvin(particle),
  };
}
