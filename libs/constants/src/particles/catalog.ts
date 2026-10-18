/* The full particle catalog: base specs from the family files plus derived antiparticles, keyed by ParticleName. */
import {
  INCLUSIVE_PRODUCTS,
  PARTICLE_NAMES,
  type CatalogParticleName,
  type DecayProduct,
  type ParticleName,
  type ParticleSpec,
} from '@standard-model/contracts';
import { BOSON_SPECS } from './bosons.js';
import { conjugateParticleSpec } from './conjugate.js';
import { LEPTON_SPECS } from './leptons.js';
import { ATOM_SPECS } from './atoms.js';
import { DIQUARK_SPECS } from './diquarks.js';
import { BARYON_SPECS, MESON_SPECS } from './hadrons.js';
import { NUCLEON_SPECS } from './nucleons.js';
import { NUCLEUS_SPECS } from './nuclei.js';
import { QUARK_SPECS } from './quarks.js';

const ANTIPARTICLE_SYMBOLS: Readonly<Partial<Record<ParticleName, string>>> = {
  antiUp: 'anti-u',
  antiDown: 'anti-d',
  antiStrange: 'anti-s',
  antiCharm: 'anti-c',
  antiBottom: 'anti-b',
  antiTop: 'anti-t',
  positron: 'e+',
  antiMuon: 'mu+',
  antiTau: 'tau+',
  electronAntineutrino: 'anti-nu_e',
  muonAntineutrino: 'anti-nu_mu',
  tauAntineutrino: 'anti-nu_tau',
  wMinus: 'W-',
  antiProton: 'anti-p',
  antiNeutron: 'anti-n',
  pionMinus: 'pi-',
  rhoMinus: 'rho-',
  kaonMinus: 'K-',
  kaonStarMinus: 'K*-',
  antiKaonStarZero: 'anti-K*0',
  dMinus: 'D-',
  antiDZero: 'anti-D0',
  dStarMinus: 'D*-',
  antiDStarZero: 'anti-D*0',
  dSMinus: 'D_s-',
  dSStarMinus: 'D_s*-',
  bMinus: 'B-',
  antiBZero: 'anti-B0',
  bStarMinus: 'B*-',
  antiBStarZero: 'anti-B*0',
  antiBSZero: 'anti-B_s0',
  antiBSStarZero: 'anti-B_s*0',
};

const BASE_SPECS: readonly ParticleSpec[] = [
  ...QUARK_SPECS,
  ...LEPTON_SPECS,
  ...BOSON_SPECS,
  ...NUCLEON_SPECS,
  ...MESON_SPECS,
  ...BARYON_SPECS,
  ...DIQUARK_SPECS,
  ...NUCLEUS_SPECS,
  ...ATOM_SPECS,
];

const antiparticleNames = new Map<DecayProduct, DecayProduct>();
INCLUSIVE_PRODUCTS.forEach((product) => antiparticleNames.set(product, product));
BASE_SPECS.forEach((spec) => {
  antiparticleNames.set(spec.name, spec.antiparticleName);
  antiparticleNames.set(spec.antiparticleName, spec.name);
});

export function antiparticleOf(product: DecayProduct): DecayProduct {
  const antiparticle = antiparticleNames.get(product);
  if (antiparticle === undefined) {
    throw new Error(`Unknown particle ${product}`);
  }
  return antiparticle;
}

const CHARGE_SUFFIX = /(\+\+|--|\+|-)$/;
const FLIPPED_CHARGE: Readonly<Record<string, string>> = {
  '++': '--',
  '--': '++',
  '+': '-',
  '-': '+',
};

function conjugateSymbol(symbol: string): string {
  const suffix = CHARGE_SUFFIX.exec(symbol)?.[0] ?? '';
  return `anti-${symbol.slice(0, symbol.length - suffix.length)}${FLIPPED_CHARGE[suffix] ?? ''}`;
}

function buildCatalog(): Readonly<Record<CatalogParticleName, ParticleSpec>> {
  const entries = new Map<ParticleName, ParticleSpec>();
  BASE_SPECS.forEach((spec) => {
    entries.set(spec.name, spec);
    if (!spec.isSelfConjugate) {
      const symbol = ANTIPARTICLE_SYMBOLS[spec.antiparticleName] ?? conjugateSymbol(spec.symbol);
      entries.set(spec.antiparticleName, conjugateParticleSpec(spec, symbol, antiparticleOf));
    }
  });
  const missing = PARTICLE_NAMES.filter((name) => !entries.has(name));
  if (missing.length > 0) {
    throw new Error(`Catalog is missing ${missing.join(', ')}`);
  }
  return Object.fromEntries(entries) as Record<CatalogParticleName, ParticleSpec>;
}

export const PARTICLE_CATALOG = buildCatalog();
