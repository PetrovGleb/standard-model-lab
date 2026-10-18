/* Checks derived particle behaviour: interaction sets, observables, magnetic dipoles against CODATA, kinematics, confinement and decays. */
import {
  BOHR_MAGNETON,
  ELECTRON_GYROMAGNETIC_RATIO,
  NEUTRON_GYROMAGNETIC_RATIO,
  PARTICLE_CATALOG,
  PROTON_GYROMAGNETIC_RATIO,
} from '@standard-model/constants';
import type { InteractionKind, ParticleName } from '@standard-model/contracts';
import { invariantMassInGev } from '@standard-model/utils';
import { describe, expect, it } from 'vitest';
import {
  Baryon,
  ChargedLepton,
  createEngine,
  isDecayable,
  isMagneticDipole,
  Quark,
} from '../src/index.js';

const SEED = 1;
const RELATIVE_PRECISION = 1e-7;

function expectRelative(actual: number, expected: number, precision = RELATIVE_PRECISION): void {
  expect(Math.abs(actual - expected) / Math.abs(expected)).toBeLessThan(precision);
}

describe('interactions derived from quantum numbers', () => {
  const engine = createEngine({ seed: SEED });
  const cases: ReadonlyArray<readonly [ParticleName, readonly InteractionKind[]]> = [
    ['electron', ['gravitational', 'electromagnetic', 'weak', 'yukawa']],
    ['electronNeutrino', ['gravitational', 'weak']],
    ['up', ['gravitational', 'electromagnetic', 'strong', 'weak', 'yukawa']],
    ['photon', ['gravitational', 'electromagnetic']],
    ['gluon', ['gravitational', 'strong']],
    ['wPlus', ['gravitational', 'electromagnetic', 'weak', 'yukawa']],
    ['zBoson', ['gravitational', 'weak', 'yukawa']],
    ['higgsBoson', ['gravitational', 'weak', 'yukawa']],
    ['proton', ['gravitational', 'electromagnetic', 'strong', 'weak', 'yukawa']],
    ['neutron', ['gravitational', 'electromagnetic', 'strong', 'weak', 'yukawa']],
  ];

  it.each(cases)('%s takes part in exactly the expected interactions', (name, expected) => {
    expect(engine.particles.create(name).interactions).toEqual(new Set(expected));
  });
});

describe('observables', () => {
  const engine = createEngine({ seed: SEED });

  it.each([
    ['electron', [{ name: 'spin', dimension: 2 }]],
    ['photon', [{ name: 'polarization', dimension: 2 }]],
    ['gluon', [{ name: 'polarization', dimension: 2 }]],
    ['wPlus', [{ name: 'polarization', dimension: 3 }]],
    [
      'muonNeutrino',
      [
        { name: 'spin', dimension: 2 },
        { name: 'flavor', dimension: 3 },
      ],
    ],
    ['higgsBoson', []],
    ['proton', [{ name: 'spin', dimension: 2 }]],
  ] as const)('%s exposes %j', (name, expected) => {
    expect(engine.particles.create(name).observables).toEqual(expected);
  });
});

describe('magnetic dipoles', () => {
  const engine = createEngine({ seed: SEED });

  it.each([
    ['electron', ELECTRON_GYROMAGNETIC_RATIO.value],
    ['proton', PROTON_GYROMAGNETIC_RATIO.value],
    ['neutron', NEUTRON_GYROMAGNETIC_RATIO.value],
  ] as const)('%s gyromagnetic ratio matches CODATA', (name, expected) => {
    const particle = engine.particles.create(name);
    if (!isMagneticDipole(particle)) {
      throw new Error(`${name} should be a magnetic dipole`);
    }
    expectRelative(particle.gyromagneticRatioInRadiansPerSecondPerTesla, expected);
  });

  it('falls back to the Dirac moment for the tau', () => {
    const tau = engine.particles.create('tau');
    const electron = engine.particles.create('electron');
    if (!(tau instanceof ChargedLepton) || !(electron instanceof ChargedLepton)) {
      throw new Error('leptons expected');
    }
    const expectedMagnitude = BOHR_MAGNETON.value * (electron.massInGev / tau.massInGev);
    expect(tau.magneticMomentInJoulesPerTesla).toBeLessThan(0);
    expectRelative(Math.abs(tau.magneticMomentInJoulesPerTesla), expectedMagnitude, 1e-12);
  });

  it('does not treat neutrinos or photons as dipoles', () => {
    expect(isMagneticDipole(engine.particles.create('electronNeutrino'))).toBe(false);
    expect(isMagneticDipole(engine.particles.create('photon'))).toBe(false);
  });
});

describe('kinematics', () => {
  const engine = createEngine({ seed: SEED });

  it('has energy equal to mass at rest and the relativistic energy with momentum', () => {
    const electron = engine.particles.create('electron');
    expect(electron.isAtRest).toBe(true);
    expect(electron.energyInGev).toBe(electron.massInGev);
    electron.setMomentum({ x: 0, y: 0, z: 1 });
    const expectedEnergy = Math.sqrt(1 + electron.massInGev * electron.massInGev);
    expect(electron.energyInGev).toBeCloseTo(expectedEnergy, 15);
    expect(electron.lorentzFactor).toBeCloseTo(expectedEnergy / electron.massInGev, 6);
  });

  it('boosts a particle at rest to gamma m v and keeps its invariant mass', () => {
    const muon = engine.particles.create('muon', { positionInFemtometers: { x: 1, y: 2, z: 3 } });
    const speedFraction = 0.6;
    const boostFactor = 1.25;
    muon.boost({ x: 0, y: 0, z: speedFraction });
    const fourMomentum = muon.kinematics.fourMomentumInGev;
    expect(fourMomentum.momentum.z).toBeCloseTo(boostFactor * muon.massInGev * speedFraction, 12);
    expect(fourMomentum.energy).toBeCloseTo(boostFactor * muon.massInGev, 12);
    expect(invariantMassInGev(fourMomentum)).toBeCloseTo(muon.massInGev, 12);
    expect(muon.kinematics.positionInFemtometers).toEqual({ x: 1, y: 2, z: 3 });
  });

  it('keeps a boosted photon massless', () => {
    const photon = engine.particles.create('photon', { momentumInGev: { x: 0, y: 0, z: 1 } });
    photon.boost({ x: 0, y: 0, z: 0.5 });
    const fourMomentum = photon.kinematics.fourMomentumInGev;
    expect(fourMomentum.energy).toBeCloseTo(fourMomentum.momentum.z, 12);
    expect(fourMomentum.energy).toBeCloseTo(Math.sqrt(3), 12);
    expect(photon.lorentzFactor).toBe(Number.POSITIVE_INFINITY);
  });

  it('refuses negative proper time and double register binding', () => {
    const electron = engine.particles.create('electron');
    expect(() => electron.advanceProperTime(-1)).toThrow();
    electron.advanceProperTime(2e-6);
    expect(electron.kinematics.properTimeInSeconds).toBe(2e-6);
    const slot = {
      registerId: 'register-1',
      slotIndex: 0,
      dimension: 2,
      observable: 'spin',
    } as const;
    electron.bindQuantumSlot(slot);
    expect(() => electron.bindQuantumSlot(slot)).toThrow(/already bound/);
    expect(electron.quantumSlot('spin')).toEqual(slot);
    electron.releaseQuantumSlot('spin');
    expect(electron.quantumSlot('spin')).toBeNull();
  });
});

describe('confinement and decays', () => {
  const engine = createEngine({ seed: SEED });

  it('confines every quark except the top', () => {
    (['up', 'down', 'strange', 'charm', 'bottom', 'antiBottom'] as const).forEach((name) => {
      const quark = engine.particles.create(name);
      expect(quark).toBeInstanceOf(Quark);
      expect((quark as Quark).isConfined).toBe(true);
    });
    expect((engine.particles.create('top') as Quark).isConfined).toBe(false);
    expect((engine.particles.create('antiTop') as Quark).isConfined).toBe(false);
  });

  it('exposes decay channels and lifetimes from mean life or width', () => {
    const muon = engine.particles.create('muon');
    const electron = engine.particles.create('electron');
    const wPlus = engine.particles.create('wPlus');
    const top = engine.particles.create('top');
    if (!isDecayable(muon) || !isDecayable(electron) || !isDecayable(wPlus) || !isDecayable(top)) {
      throw new Error('decayable particles expected');
    }
    expect(muon.decayChannels).toHaveLength(1);
    expect(muon.meanLifeInSeconds).toBe(PARTICLE_CATALOG.muon.meanLifeInSeconds?.value);
    expect(electron.decayChannels).toHaveLength(0);
    expect(electron.isStable).toBe(true);
    expect(electron.meanLifeInSeconds).toBeNull();
    expectRelative(wPlus.meanLifeInSeconds ?? 0, 3.08e-25, 1e-2);
    expectRelative(top.meanLifeInSeconds ?? 0, 4.64e-25, 1e-2);
    expect(isDecayable(engine.particles.create('photon'))).toBe(false);
  });

  it('rejects a composite whose constituents do not match its spec', () => {
    const protonSpec = PARTICLE_CATALOG.proton;
    expect(() => new Baryon(protonSpec, { id: 'proton-x', options: {}, constituents: [] })).toThrow(
      /expects 3 constituents/,
    );
    const wrongCharge = [
      engine.particles.create('down'),
      engine.particles.create('down'),
      engine.particles.create('down'),
    ];
    expect(
      () => new Baryon(protonSpec, { id: 'proton-y', options: {}, constituents: wrongCharge }),
    ).toThrow(/do not add up/);
  });
});
