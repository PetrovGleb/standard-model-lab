/* Checks that the factory builds every catalog particle with the right class, deterministic ids, live constituents and an open registry. */
import { particleSpec } from '@standard-model/constants';
import { PARTICLE_NAMES, type ParticleName } from '@standard-model/contracts';
import { createSequentialIdGenerator } from '@standard-model/utils';
import { describe, expect, it } from 'vitest';
import {
  Atom,
  Baryon,
  ChargedLepton,
  createDefaultParticleRegistry,
  createEngine,
  Diquark,
  Gluon,
  HiggsBoson,
  isComposite,
  isElectricallyCharged,
  Meson,
  Neutrino,
  Nucleus,
  ParticleClassRegistry,
  ParticleFactory,
  Photon,
  Quark,
  WBoson,
  ZBoson,
  type ParticleConstructor,
} from '../src/index.js';

const SEED = 1;
const CLASS_BY_FAMILY_OR_NAME: Readonly<Record<string, ParticleConstructor>> = {
  quark: Quark,
  chargedLepton: ChargedLepton,
  neutrino: Neutrino,
  scalarBoson: HiggsBoson,
  baryon: Baryon,
  meson: Meson,
  diquark: Diquark,
  nucleus: Nucleus,
  atom: Atom,
  photon: Photon,
  gluon: Gluon,
  wPlus: WBoson,
  wMinus: WBoson,
  zBoson: ZBoson,
};

function expectedClassFor(name: ParticleName): ParticleConstructor {
  const spec = particleSpec(name);
  const particleClass = CLASS_BY_FAMILY_OR_NAME[name] ?? CLASS_BY_FAMILY_OR_NAME[spec.family];
  if (particleClass === undefined) {
    throw new Error(`No expected class for ${name}`);
  }
  return particleClass;
}

describe('ParticleFactory', () => {
  it('creates every catalog particle with the class of its family or name', () => {
    const engine = createEngine({ seed: SEED });
    PARTICLE_NAMES.forEach((name) => {
      const particle = engine.particles.create(name);
      expect(particle).toBeInstanceOf(expectedClassFor(name));
      expect(particle.spec.name).toBe(name);
    });
  });

  it('issues sequential ids per particle name, including constituents', () => {
    const engine = createEngine({ seed: SEED });
    expect(engine.particles.create('electron').id).toBe('electron-1');
    expect(engine.particles.create('electron').id).toBe('electron-2');
    const proton = engine.particles.create('proton');
    expect(proton.id).toBe('proton-1');
    if (!isComposite(proton)) {
      throw new Error('proton should be composite');
    }
    expect(proton.constituents.map((constituent) => constituent.id)).toEqual([
      'up-1',
      'up-2',
      'down-1',
    ]);
  });

  it('gives antiparticles the same class with flipped additive numbers', () => {
    const engine = createEngine({ seed: SEED });
    const positron = engine.particles.create('positron');
    const electron = engine.particles.create('electron');
    expect(positron).toBeInstanceOf(ChargedLepton);
    expect(positron.isAntiparticle).toBe(true);
    expect(electron.isAntiparticle).toBe(false);
    if (!isElectricallyCharged(positron)) {
      throw new Error('positron should be charged');
    }
    expect(positron.electricChargeInElementaryUnits).toBe(1);
    expect(positron.massInGev).toBe(electron.massInGev);
  });

  it('builds baryons from live quarks whose charges add up', () => {
    const engine = createEngine({ seed: SEED });
    const antiProton = engine.particles.create('antiProton');
    if (!isComposite(antiProton)) {
      throw new Error('antiproton should be composite');
    }
    expect(antiProton.constituents).toHaveLength(3);
    antiProton.constituents.forEach((constituent) => expect(constituent).toBeInstanceOf(Quark));
    const constituentCharge = antiProton.constituents.reduce(
      (sum, constituent) => sum + constituent.spec.electricChargeInElementaryUnits,
      0,
    );
    expect(constituentCharge).toBeCloseTo(-1, 12);
    expect(new Set(antiProton.constituents.map((constituent) => constituent.id)).size).toBe(3);
  });

  it('lets a registry override the class for one particle name without touching the factory', () => {
    class TaggedElectron extends ChargedLepton {
      readonly tag = 'custom';
    }
    const registry = createDefaultParticleRegistry().registerName('electron', TaggedElectron);
    const factory = new ParticleFactory(registry, createSequentialIdGenerator());
    expect(factory.create('electron')).toBeInstanceOf(TaggedElectron);
    expect(factory.create('muon')).not.toBeInstanceOf(TaggedElectron);
  });

  it('fails clearly when no class is registered', () => {
    const factory = new ParticleFactory(new ParticleClassRegistry(), createSequentialIdGenerator());
    expect(() => factory.create('photon')).toThrow(/No particle class registered/);
  });
});
