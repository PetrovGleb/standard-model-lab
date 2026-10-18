/* Catalog entries for the light diquarks that end colour strings and carry the remnant of a struck proton: flavour, spin and PYTHIA masses from data/string-fragmentation.json; a colour antitriplet that is never free. */
import type { ParticleName, ParticleSpec } from '@standard-model/contracts';
import { STRING_FRAGMENTATION } from '../string-fragmentation.js';
import { flavorOfQuarks, sumOverQuarks } from './hadrons.js';
import { NO_LEPTON_NUMBERS, sameForBothChiralities } from './shared.js';

const QUARK_LETTERS: Readonly<Record<string, string>> = { up: 'u', down: 'd', strange: 's' };

function antiName(name: string): ParticleName {
  return `anti${name.slice(0, 1).toUpperCase()}${name.slice(1)}` as ParticleName;
}

export const DIQUARK_SPECS: readonly ParticleSpec[] = STRING_FRAGMENTATION.diquarks.map(
  (diquark): ParticleSpec => {
    const charge = sumOverQuarks(diquark.quarks, (spec) => spec.electricChargeInElementaryUnits);
    return {
      name: diquark.name as ParticleName,
      symbol: `${diquark.quarks.map((quark) => QUARK_LETTERS[quark] ?? quark).join('')}_${String(diquark.spin)}`,
      pdgId: diquark.pdgId,
      family: 'diquark',
      generation: null,
      statistics: 'boseEinstein',
      massInGev: {
        value: diquark.massInGev,
        uncertainty: null,
        exact: false,
        unit: 'GeV',
        source: 'PYTHIA8',
        sourceName: `${diquark.name} mass, PYTHIA 8.312 ParticleData`,
      },
      massScheme: 'unknown',
      widthInGev: null,
      meanLifeInSeconds: null,
      electricChargeInElementaryUnits: charge,
      spinInReducedPlanckUnits: diquark.spin,
      parity: 1,
      colorRepresentation: 'antitriplet',
      baryonNumber: sumOverQuarks(diquark.quarks, (spec) => spec.baryonNumber),
      leptonNumbers: NO_LEPTON_NUMBERS,
      isospin: null,
      flavorNumbers: flavorOfQuarks(diquark.quarks),
      weakIsospinThirdComponent: sameForBothChiralities(0),
      weakHypercharge: sameForBothChiralities(0),
      gFactor: null,
      magneticMomentInJoulesPerTesla: null,
      decays: [],
      antiparticleName: antiName(diquark.name),
      isSelfConjugate: false,
      constituents: diquark.quarks as readonly ParticleName[],
    };
  },
);
