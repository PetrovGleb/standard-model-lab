/* ParticleFactory and ParticleClassRegistry: create live particles from catalog specs, resolving the class by name first and family second. */
import { particleSpec } from '@standard-model/constants';
import type {
  IdGenerator,
  ParticleCreationOptions,
  ParticleFamily,
  ParticleName,
  ParticleSpec,
} from '@standard-model/contracts';
import { AbstractParticle, type ParticleBuildContext } from './abstract-particle.js';
import { Baryon } from './baryon.js';
import { Atom } from './atom.js';
import { ChargedLepton } from './charged-lepton.js';
import { Diquark } from './diquark.js';
import { Gluon, Photon, WBoson, ZBoson } from './gauge-bosons.js';
import { HiggsBoson } from './higgs-boson.js';
import { Meson } from './meson.js';
import { Molecule } from './molecule.js';
import { Neutrino } from './neutrino.js';
import { Nucleus } from './nucleus.js';
import { Quark } from './quark.js';

export type ParticleConstructor = new (
  spec: ParticleSpec,
  context: ParticleBuildContext,
) => AbstractParticle;

export class ParticleClassRegistry {
  private readonly byName = new Map<ParticleName, ParticleConstructor>();
  private readonly byFamily = new Map<ParticleFamily, ParticleConstructor>();

  registerFamily(family: ParticleFamily, particleClass: ParticleConstructor): this {
    this.byFamily.set(family, particleClass);
    return this;
  }

  registerName(name: ParticleName, particleClass: ParticleConstructor): this {
    this.byName.set(name, particleClass);
    return this;
  }

  resolve(spec: ParticleSpec): ParticleConstructor {
    const particleClass = this.byName.get(spec.name) ?? this.byFamily.get(spec.family);
    if (particleClass === undefined) {
      throw new Error(`No particle class registered for ${spec.name} (${spec.family})`);
    }
    return particleClass;
  }
}

export function createDefaultParticleRegistry(): ParticleClassRegistry {
  return new ParticleClassRegistry()
    .registerFamily('quark', Quark)
    .registerFamily('chargedLepton', ChargedLepton)
    .registerFamily('neutrino', Neutrino)
    .registerFamily('scalarBoson', HiggsBoson)
    .registerFamily('baryon', Baryon)
    .registerFamily('meson', Meson)
    .registerFamily('diquark', Diquark)
    .registerFamily('nucleus', Nucleus)
    .registerFamily('atom', Atom)
    .registerFamily('molecule', Molecule)
    .registerName('photon', Photon)
    .registerName('gluon', Gluon)
    .registerName('wPlus', WBoson)
    .registerName('wMinus', WBoson)
    .registerName('zBoson', ZBoson);
}

export class ParticleFactory {
  constructor(
    private readonly registry: ParticleClassRegistry,
    private readonly ids: IdGenerator,
    private readonly specOf: (name: ParticleName) => ParticleSpec = particleSpec,
  ) {}

  create(name: ParticleName, options: ParticleCreationOptions = {}): AbstractParticle {
    const spec = this.specOf(name);
    const constituents = (spec.constituents ?? []).map((constituent) => this.create(constituent));
    const particleClass = this.registry.resolve(spec);
    return new particleClass(spec, { id: this.ids.next(name), options, constituents });
  }
}
