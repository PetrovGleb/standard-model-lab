/* Test oracle for unit conversions against known CODATA and reference values. */
import {
  BOHR_MAGNETON_IN_EV_PER_TESLA,
  ELECTRON_G_FACTOR,
  ELECTRON_GYROMAGNETIC_RATIO,
  ELECTRON_MASS_IN_KILOGRAMS,
  PROTON_MASS_IN_ATOMIC_MASS_UNITS,
  RYDBERG_ENERGY_IN_EV,
  particleSpec,
} from '@standard-model/constants';
import { describe, expect, it } from 'vitest';
import {
  decayLengthInMeters,
  gevToAtomicMassUnits,
  gevToKilograms,
  meanLifeToHalfLife,
  photonWavelengthInNanometers,
  widthInGevToMeanLifeInSeconds,
} from '../src/units.js';
import { threeBodyEndpointEnergyInGev, twoBodyDecayMomentumInGev } from '../src/kinematics.js';

const RELATIVE_PRECISION = 1e-9;

function expectRelative(
  actual: number,
  expected: number,
  relativePrecision = RELATIVE_PRECISION,
): void {
  expect(Math.abs(actual - expected) / Math.abs(expected)).toBeLessThan(relativePrecision);
}

describe('units', () => {
  it('converts the electron mass in GeV back to CODATA kilograms', () => {
    expectRelative(
      gevToKilograms(particleSpec('electron').massInGev.value),
      ELECTRON_MASS_IN_KILOGRAMS.value,
    );
  });

  it('converts the proton mass in GeV back to CODATA atomic mass units', () => {
    expectRelative(
      gevToAtomicMassUnits(particleSpec('proton').massInGev.value),
      PROTON_MASS_IN_ATOMIC_MASS_UNITS.value,
    );
  });

  it('gives 1239.841984 nm for a 1 eV photon', () => {
    expect(photonWavelengthInNanometers(1)).toBeCloseTo(1239.841984, 6);
  });

  it('turns the top width into a lifetime of 4.64e-25 s', () => {
    expectRelative(widthInGevToMeanLifeInSeconds(1.42), 4.64e-25, 1e-2);
  });

  it('gives 658.638 m decay length for the muon mean life', () => {
    const muonMeanLife = particleSpec('muon').meanLifeInSeconds?.value ?? 0;
    expect(decayLengthInMeters(muonMeanLife)).toBeCloseTo(658.638, 2);
  });

  it('gives a 608.8 s neutron half-life', () => {
    const neutronMeanLife = particleSpec('neutron').meanLifeInSeconds?.value ?? 0;
    expect(meanLifeToHalfLife(neutronMeanLife)).toBeCloseTo(608.8, 1);
  });

  it('reproduces the hydrogen 1 to 2 transition', () => {
    const transitionEnergyInEv = RYDBERG_ENERGY_IN_EV.value * (1 - 1 / 4);
    expect(transitionEnergyInEv).toBeCloseTo(10.20427, 5);
    expect(photonWavelengthInNanometers(transitionEnergyInEv)).toBeCloseTo(121.502, 3);
  });

  it('reproduces the electron Larmor frequency and Zeeman splitting at 1 T', () => {
    const larmorFrequencyInHertz = ELECTRON_GYROMAGNETIC_RATIO.value / (2 * Math.PI);
    expectRelative(larmorFrequencyInHertz, 28024.9513861e6, 1e-8);
    const zeemanSplittingInEv =
      Math.abs(ELECTRON_G_FACTOR.value) * BOHR_MAGNETON_IN_EV_PER_TESLA.value;
    expectRelative(zeemanSplittingInEv, 1.15901886e-4, 1e-7);
  });
});

describe('kinematics', () => {
  it('gives half the W mass as the momentum in W to electron neutrino', () => {
    const wMass = particleSpec('wPlus').massInGev.value;
    expect(twoBodyDecayMomentumInGev(wMass, 0, 0)).toBeCloseTo(wMass / 2, 12);
    expect(twoBodyDecayMomentumInGev(wMass, 0, 0)).toBeCloseTo(40.18125, 5);
  });

  it('gives the 52.830 MeV Michel endpoint for muon decay', () => {
    const endpoint = threeBodyEndpointEnergyInGev(
      particleSpec('muon').massInGev.value,
      particleSpec('electron').massInGev.value,
    );
    expect(endpoint * 1e3).toBeCloseTo(52.83, 3);
  });

  it('rejects a kinematically forbidden decay', () => {
    expect(() => twoBodyDecayMomentumInGev(1, 2, 0)).toThrow();
  });
});
