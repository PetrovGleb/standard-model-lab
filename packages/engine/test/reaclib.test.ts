/* Checks the REACLIB library in the medium: the generated table, the seven-coefficient fit evaluated exactly, agreement with the S-factor laws for p+p, D–T and ³He+³He, the pep to pp ratio
   against Solar Fusion II, leptons restored to weak reactions, ¹²C + α → ¹⁶O and the triple-alpha channel with its identical-partner half, and photodisintegration of the deuteron. */
import { AVOGADRO_CONSTANT, nucleusName, reaclibReactions } from '@standard-model/constants';
import type { MediumAspect, MediumComponent, ParticleName } from '@standard-model/contracts';
import { describe, expect, it } from 'vitest';
import {
  decayChannelsInMedium,
  mediumFusionChannels,
  reaclibMediumChannels,
  reaclibPhotodisintegrations,
  reaclibRatePerSecond,
  reactionChannels,
  reactivityInCubicMetersPerSecond,
} from '../src/index.js';

const EXACT_DIGITS = 12;
const FEWEST_REACTIONS = 30_000;
const SOLAR_CORE_TEMPERATURE_IN_KELVIN = 1.57e7;
const TOKAMAK_TEMPERATURE_IN_KELVIN = 1.74e8;
const HELIUM_FLASH_TEMPERATURE_IN_KELVIN = 1e8;
const HELIUM_CORE_ALPHA_DENSITY_PER_CUBIC_METER = 1.5e34;
const SOLAR_ELECTRON_DENSITY_PER_CUBIC_METER = 7.72e31;
const KELVIN_PER_GIGAKELVIN = 1e9;
const CUBIC_METERS_PER_CUBIC_CENTIMETER = 1e-6;
const LAW_AGREEMENT = 0.05;
const PEP_AGREEMENT = 0.5;
const SOLAR_FUSION_II_PEP_PREFACTOR = 1.102e-4;
const SOLAR_FUSION_II_PEP_SLOPE_PER_MILLION_KELVIN = 0.02;
const SOLAR_FUSION_II_PEP_REFERENCE_IN_MILLION_KELVIN = 16;
const SOLAR_CORE_MASS_DENSITY_IN_GRAMS_PER_CUBIC_CENTIMETER = 150;
const SOLAR_CORE_MEAN_MOLECULAR_WEIGHT_PER_ELECTRON = 1.17;
const CARBON_TWELVE = nucleusName(6, 12);
const OXYGEN_SIXTEEN = nucleusName(8, 16);

function component(species: ParticleName, density: number): MediumComponent {
  return { species, numberDensityPerCubicMeter: density, crossSectionInSquareMeters: 0 };
}

function medium(components: readonly MediumComponent[], temperatureInKelvin: number): MediumAspect {
  return {
    components,
    temperatureInKelvin,
    bulkVelocityInMetersPerSecond: { x: 0, y: 0, z: 0 },
    reactionMode: 'allReactionsInStep',
  };
}

function reaction(reactants: readonly ParticleName[], label?: string) {
  const key = [...reactants].sort().join('+');
  const found = reaclibReactions().find(
    (candidate) =>
      [...candidate.reactants].sort().join('+') === key &&
      (label === undefined || candidate.label === label),
  );
  if (found === undefined) {
    throw new Error(`no REACLIB reaction for ${key}`);
  }
  return found;
}

function perPairInCubicMetersPerSecond(ratePerMole: number): number {
  return (ratePerMole * CUBIC_METERS_PER_CUBIC_CENTIMETER) / AVOGADRO_CONSTANT.value;
}

function agreement(first: number, second: number): number {
  return Math.abs(first / second - 1);
}

describe('REACLIB table and fit', () => {
  it('holds tens of thousands of reactions between NUBASE nuclei', () => {
    expect(reaclibReactions().length).toBeGreaterThan(FEWEST_REACTIONS);
    expect(reaction(['alphaParticle', 'alphaParticle', 'alphaParticle']).chapter).toBe(8);
  });

  it('evaluates the seven-coefficient fit exactly', () => {
    const triple = reaction(['alphaParticle', 'alphaParticle', 'alphaParticle']);
    const gigakelvin = HELIUM_FLASH_TEMPERATURE_IN_KELVIN / KELVIN_PER_GIGAKELVIN;
    const expected = triple.sets.reduce((sum, set) => {
      const [
        constant = 0,
        inverse = 0,
        inverseCubeRoot = 0,
        cubeRoot = 0,
        linear = 0,
        fiveThirds = 0,
        logarithmic = 0,
      ] = set;
      return (
        sum +
        Math.exp(
          constant +
            inverse / gigakelvin +
            inverseCubeRoot / Math.cbrt(gigakelvin) +
            cubeRoot * Math.cbrt(gigakelvin) +
            linear * gigakelvin +
            fiveThirds * gigakelvin ** (5 / 3) +
            logarithmic * Math.log(gigakelvin),
        )
      );
    }, 0);
    expect(reaclibRatePerSecond(triple, HELIUM_FLASH_TEMPERATURE_IN_KELVIN) / expected).toBeCloseTo(
      1,
      EXACT_DIGITS,
    );
  });

  it.each([
    ['proton', 'proton', SOLAR_CORE_TEMPERATURE_IN_KELVIN, 'bet+'],
    ['deuteron', 'triton', TOKAMAK_TEMPERATURE_IN_KELVIN, undefined],
    ['helion', 'helion', SOLAR_CORE_TEMPERATURE_IN_KELVIN, undefined],
  ] as const)(
    'agrees with the S-factor law for %s + %s within a few percent',
    (first, second, temperatureInKelvin, label) => {
      const [channel] = reactionChannels(first, second);
      if (channel === undefined) {
        throw new Error('tabulated channel expected');
      }
      const library = perPairInCubicMetersPerSecond(
        reaclibRatePerSecond(reaction([first, second], label), temperatureInKelvin),
      );
      expect(
        agreement(library, reactivityInCubicMetersPerSecond(channel, temperatureInKelvin)),
      ).toBeLessThan(LAW_AGREEMENT);
    },
  );

  it('puts pep near the Solar Fusion II fraction of pp at the solar centre', () => {
    const protonProton = reaclibRatePerSecond(
      reaction(['proton', 'proton'], 'bet+'),
      SOLAR_CORE_TEMPERATURE_IN_KELVIN,
    );
    const pep =
      reaclibRatePerSecond(reaction(['proton', 'proton'], 'ec'), SOLAR_CORE_TEMPERATURE_IN_KELVIN) *
      ((SOLAR_ELECTRON_DENSITY_PER_CUBIC_METER * CUBIC_METERS_PER_CUBIC_CENTIMETER) /
        AVOGADRO_CONSTANT.value);
    const millionKelvin = SOLAR_CORE_TEMPERATURE_IN_KELVIN / 1e6;
    const expected =
      SOLAR_FUSION_II_PEP_PREFACTOR *
      (SOLAR_CORE_MASS_DENSITY_IN_GRAMS_PER_CUBIC_CENTIMETER /
        SOLAR_CORE_MEAN_MOLECULAR_WEIGHT_PER_ELECTRON) *
      millionKelvin ** -0.5 *
      (1 +
        SOLAR_FUSION_II_PEP_SLOPE_PER_MILLION_KELVIN *
          (millionKelvin - SOLAR_FUSION_II_PEP_REFERENCE_IN_MILLION_KELVIN));
    expect(agreement(pep / protonProton, expected)).toBeLessThan(PEP_AGREEMENT);
  });
});

describe('REACLIB channels of a medium', () => {
  const heliumCore = [component('alphaParticle', HELIUM_CORE_ALPHA_DENSITY_PER_CUBIC_METER)];

  it('restores the leptons of weak reactions and skips pep without electrons', () => {
    const protons = [component('proton', 1e31)];
    const channels = reaclibMediumChannels('proton', protons, SOLAR_CORE_TEMPERATURE_IN_KELVIN);
    expect(channels.map((channel) => channel.products)).toEqual([
      ['deuteron', 'positron', 'electronNeutrino'],
    ]);
    const withElectrons = reaclibMediumChannels(
      'proton',
      [...protons, component('electron', 1e31)],
      SOLAR_CORE_TEMPERATURE_IN_KELVIN,
    );
    expect(withElectrons.map((channel) => channel.products)).toEqual([
      ['deuteron', 'positron', 'electronNeutrino'],
      ['deuteron', 'electronNeutrino'],
    ]);
  });

  it('burns carbon into oxygen in a helium core and ignores leptons as partners', () => {
    const channels = mediumFusionChannels(CARBON_TWELVE, medium(heliumCore, 2e8));
    const strongest = channels.reduce((best, channel) =>
      channel.ratePerSecond > best.ratePerSecond ? channel : best,
    );
    expect(strongest.channel.products).toEqual([OXYGEN_SIXTEEN, 'photon']);
    expect(strongest.partners).toEqual(['alphaParticle']);
    expect(mediumFusionChannels(CARBON_TWELVE, medium([component('electron', 1e31)], 2e8))).toEqual(
      [],
    );
  });

  it('runs the triple-alpha reaction at half the squared density times the rate', () => {
    const [triple, ...others] = mediumFusionChannels(
      'alphaParticle',
      medium(heliumCore, HELIUM_FLASH_TEMPERATURE_IN_KELVIN),
    );
    expect(others).toEqual([]);
    expect(triple?.partners).toEqual(['alphaParticle', 'alphaParticle']);
    expect(triple?.channel.products).toEqual([CARBON_TWELVE, 'photon']);
    const perMole =
      (HELIUM_CORE_ALPHA_DENSITY_PER_CUBIC_METER * CUBIC_METERS_PER_CUBIC_CENTIMETER) /
      AVOGADRO_CONSTANT.value;
    const expected =
      (reaclibRatePerSecond(
        reaction(['alphaParticle', 'alphaParticle', 'alphaParticle']),
        HELIUM_FLASH_TEMPERATURE_IN_KELVIN,
      ) *
        perMole ** 2) /
      2;
    expect((triple?.ratePerSecond ?? 0) / expected).toBeCloseTo(1, EXACT_DIGITS);
  });

  it('photodisintegrates the deuteron in a hot medium and not in a cool one', () => {
    const [breakup] = reaclibPhotodisintegrations('deuteron', 1e9);
    expect(breakup?.products).toEqual(['neutron', 'proton']);
    const inMedium = decayChannelsInMedium('deuteron', medium([component('proton', 1e30)], 1e9));
    expect(inMedium.map((channel) => channel.kind)).toEqual(['photodisintegration']);
    expect(inMedium[0]?.ratePerSecond).toBe(breakup?.ratePerSecond);
    expect(reaclibPhotodisintegrations('deuteron', 1e6)).toEqual([]);
  });
});
