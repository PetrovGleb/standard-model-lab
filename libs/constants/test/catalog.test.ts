/* Checks that every particle exists with consistent quantum numbers, antiparticles flip correctly and decay tables are sane. */
import { PARTICLE_NAMES } from '@standard-model/contracts';
import { describe, expect, it } from 'vitest';
import { PDG_2026 } from '../src/pdg.js';
import { particleSpec } from '../src/particles/matter.js';

const BRANCHING_SUM_LOWER_BOUND = 0.85;
const BRANCHING_SUM_UPPER_BOUND = 1.01;
const EXACT_DIGITS = 12;

describe('particle catalog', () => {
  it('has a spec for every particle name with matching name', () => {
    PARTICLE_NAMES.forEach((name) => {
      expect(particleSpec(name).name).toBe(name);
    });
  });

  it('builds nucleon charge from constituent quark charges', () => {
    (['proton', 'neutron', 'antiProton'] as const).forEach((name) => {
      const spec = particleSpec(name);
      const constituentCharge = (spec.constituents ?? []).reduce(
        (sum, constituent) => sum + particleSpec(constituent).electricChargeInElementaryUnits,
        0,
      );
      expect(constituentCharge).toBeCloseTo(spec.electricChargeInElementaryUnits, 12);
    });
  });

  it('flips additive quantum numbers for antiparticles and keeps mass', () => {
    const electron = particleSpec('electron');
    const positron = particleSpec('positron');
    expect(positron.electricChargeInElementaryUnits).toBe(1);
    expect(positron.pdgId).toBe(-11);
    expect(positron.leptonNumbers.electron).toBe(-1);
    expect(positron.massInGev).toEqual(electron.massInGev);
    expect(positron.magneticMomentInJoulesPerTesla?.value).toBeCloseTo(
      -(electron.magneticMomentInJoulesPerTesla?.value ?? 0),
      40,
    );
    expect(positron.antiparticleName).toBe('electron');
    expect(particleSpec('antiProton').baryonNumber).toBe(-1);
    expect(particleSpec('antiUp').colorRepresentation).toBe('antitriplet');
  });

  it('conjugates decay products', () => {
    const wMinusProducts = particleSpec('wMinus').decays.map((channel) => channel.products);
    expect(wMinusProducts).toContainEqual(['electron', 'electronAntineutrino']);
    expect(particleSpec('antiMuon').decays[0]?.products).toEqual([
      'positron',
      'electronNeutrino',
      'muonAntineutrino',
    ]);
  });

  it('marks self-conjugate bosons as their own antiparticle', () => {
    (['photon', 'gluon', 'zBoson', 'higgsBoson'] as const).forEach((name) => {
      expect(particleSpec(name).antiparticleName).toBe(name);
      expect(particleSpec(name).isSelfConjugate).toBe(true);
    });
  });

  it('has branching fractions that sum close to one', () => {
    PARTICLE_NAMES.forEach((name) => {
      const spec = particleSpec(name);
      if (spec.decays.length === 0) {
        return;
      }
      const sum = spec.decays.reduce(
        (total, channel) => total + channel.branchingFraction.value,
        0,
      );
      expect(sum).toBeGreaterThanOrEqual(BRANCHING_SUM_LOWER_BOUND);
      expect(sum).toBeLessThanOrEqual(BRANCHING_SUM_UPPER_BOUND);
    });
  });

  it('keeps masses in GeV with provenance', () => {
    expect(particleSpec('electron').massInGev.value).toBeCloseTo(0.000511, 6);
    expect(particleSpec('electron').massInGev.source).toBe('CODATA2022');
    expect(particleSpec('wPlus').massInGev.value).toBeCloseTo(80.36, 2);
    expect(particleSpec('wPlus').massInGev.source).toBe('PDG2026');
    expect(particleSpec('top').massScheme).toBe('directReconstruction');
  });

  it('derives meson charge and flavour from the quark content and flips them for antimesons', () => {
    expect(particleSpec('kaonPlus').flavorNumbers.strangeness).toBe(1);
    expect(particleSpec('kaonMinus').flavorNumbers.strangeness).toBe(-1);
    expect(particleSpec('dSPlus').flavorNumbers).toMatchObject({ charm: 1, strangeness: 1 });
    expect(particleSpec('bPlus').flavorNumbers.bottomness).toBe(1);
    expect(particleSpec('antiBZero').flavorNumbers.bottomness).toBe(-1);
    expect(particleSpec('antiBZero').constituents).toEqual(['antiDown', 'bottom']);
    expect(particleSpec('kaonShort').flavorNumbers.strangeness).toBe(0);
    expect(particleSpec('pionMinus').electricChargeInElementaryUnits).toBe(-1);
    expect(particleSpec('pionMinus').massInGev.value).toBe(
      PDG_2026.mesons.pionPlus.massInGev.value,
    );
  });

  it('splits K* → Kπ by isospin and K_L semileptonic modes by charge conjugation', () => {
    const shares = (name: 'kaonStarPlus' | 'kaonStarZero'): Record<string, number> =>
      Object.fromEntries(
        particleSpec(name).decays.map((channel) => [
          channel.products.join('+'),
          channel.branchingFraction.value,
        ]),
      );
    expect(shares('kaonStarPlus')['kaonPlus+pionZero']).toBeCloseTo(1 / 3, EXACT_DIGITS);
    expect(shares('kaonStarPlus')['kaonShort+pionPlus']).toBeCloseTo(1 / 3, EXACT_DIGITS);
    expect(shares('kaonStarZero')['kaonPlus+pionMinus']).toBeCloseTo(2 / 3, EXACT_DIGITS);
    expect(shares('kaonStarZero')['kaonLong+pionZero']).toBeCloseTo(1 / 6, EXACT_DIGITS);
    const semileptonic = particleSpec('kaonLong').decays.filter((channel) =>
      channel.products.includes('positron'),
    );
    expect(semileptonic[0]?.branchingFraction.value).toBeCloseTo(
      (PDG_2026.mesonBranchingFractions.kaonLong[0]?.value ?? 0) / 2,
      EXACT_DIGITS,
    );
  });
});
