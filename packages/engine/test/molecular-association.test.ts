/* Checks bond formation in a gas: free ordinary valence decides the channels (O + H → OH → H₂O and no further, noble gases inert), the joining rate equals K(T) times the breaking rate of the same bond to 1e-12,
   and an oxygen atom in hot atomic hydrogen ends in the chemical equilibrium of its chain, where the two equivalent O–H bonds of water halve the H₂O share as a symmetry number would, at 5 sigma. */
import { atomName } from '@standard-model/constants';
import type { MediumAspect } from '@standard-model/contracts';
import { statisticalTolerance } from '@standard-model/utils';
import { describe, expect, it } from 'vitest';
import {
  EXPERIMENT_TEMPLATES,
  associationChannels,
  bondDissociationRatesPerSecond,
  chemicalChain,
  equilibriumConstantInCubicMeters,
  molecularStructure,
  runExperiment,
} from '../src/index.js';

const SEED = 20261017;
const SHOTS = 10_000;
const MONTE_CARLO_TIMEOUT_IN_MILLISECONDS = 300_000;
const RELATIVE_PRECISION = 1e-12;
const HYDROGEN_DENSITY_PER_CUBIC_METER = 1e24;
const MIXED_TEMPERATURE_IN_KELVIN = 4000;
const OXYGEN = atomName(8, 16, 0);
const ARGON = atomName(18, 40, 0);
const EQUIVALENT_WATER_BONDS = 2;

function hydrogenGas(
  temperatureInKelvin: number,
  extra: MediumAspect['components'] = [],
): MediumAspect {
  return {
    components: [
      {
        species: 'hydrogenAtom',
        numberDensityPerCubicMeter: HYDROGEN_DENSITY_PER_CUBIC_METER,
        crossSectionInSquareMeters: 0,
      },
      ...extra,
    ],
    temperatureInKelvin,
    bulkVelocityInMetersPerSecond: { x: 0, y: 0, z: 0 },
    reactionMode: 'allReactionsInStep',
  };
}

function onlyProduct(name: Parameters<typeof associationChannels>[0], medium: MediumAspect) {
  const channels = associationChannels(name, medium);
  expect(channels).toHaveLength(1);
  const [channel] = channels;
  if (channel === undefined) {
    throw new Error('one channel expected');
  }
  return channel;
}

describe('bond formation channels', () => {
  const gas = hydrogenGas(MIXED_TEMPERATURE_IN_KELVIN, [
    {
      species: ARGON,
      numberDensityPerCubicMeter: HYDROGEN_DENSITY_PER_CUBIC_METER,
      crossSectionInSquareMeters: 0,
    },
  ]);

  it('builds water step by step and stops when oxygen runs out of valence', () => {
    const hydroxyl = onlyProduct(OXYGEN, gas).product;
    const water = onlyProduct(hydroxyl, gas).product;
    expect(
      molecularStructure(hydroxyl)
        .atoms.map((atom) => atom.symbol)
        .sort(),
    ).toEqual(['H', 'O']);
    expect(molecularStructure(water).bonds).toHaveLength(2);
    expect(associationChannels(water, gas)).toEqual([]);
  });

  it('keeps noble gases inert and joins two hydrogen atoms', () => {
    expect(associationChannels(ARGON, gas)).toEqual([]);
    expect(molecularStructure(onlyProduct('hydrogenAtom', gas).product).bonds).toHaveLength(1);
  });

  it('joins at K(T) times the breaking rate of the new bond', () => {
    [2000, 3000, MIXED_TEMPERATURE_IN_KELVIN, 5000].forEach((temperatureInKelvin) => {
      const medium = hydrogenGas(temperatureInKelvin);
      const hydroxyl = onlyProduct(OXYGEN, medium).product;
      const channel = onlyProduct(hydroxyl, medium);
      const breaking =
        bondDissociationRatesPerSecond(molecularStructure(channel.product), temperatureInKelvin)[
          channel.bondIndex
        ] ?? 0;
      const expected =
        HYDROGEN_DENSITY_PER_CUBIC_METER *
        equilibriumConstantInCubicMeters(
          channel.product,
          hydroxyl,
          'hydrogenAtom',
          channel.bondIndex,
          temperatureInKelvin,
        ) *
        breaking;
      expect(Math.abs(channel.ratePerSecond / expected - 1)).toBeLessThan(RELATIVE_PRECISION);
    });
  });
});

describe('chemical equilibrium of an oxygen atom in hot hydrogen, Monte Carlo', () => {
  it(
    'shares oxygen between O, OH and H2O as the chain rates say, with water halved by its two equivalent bonds',
    () => {
      const medium = hydrogenGas(MIXED_TEMPERATURE_IN_KELVIN);
      const chain = chemicalChain(OXYGEN, medium);
      expect(chain.states).toHaveLength(3);
      expect(chain.exits).toEqual([]);
      const rate = (from: number, target: number): number =>
        chain.generatorPerSecond[from]?.[target] ?? 0;
      const hydroxylOverOxygen = rate(0, 1) / rate(1, 0);
      const waterOverHydroxyl = rate(1, 2) / rate(2, 1);
      const water = chain.states[2] ?? OXYGEN;
      const hydroxyl = chain.states[1] ?? OXYGEN;
      const bondIndex = associationChannels(hydroxyl, medium)[0]?.bondIndex ?? 0;
      const fromConstant =
        (HYDROGEN_DENSITY_PER_CUBIC_METER *
          equilibriumConstantInCubicMeters(
            water,
            hydroxyl,
            'hydrogenAtom',
            bondIndex,
            MIXED_TEMPERATURE_IN_KELVIN,
          )) /
        EQUIVALENT_WATER_BONDS;
      expect(Math.abs(waterOverHydroxyl / fromConstant - 1)).toBeLessThan(1e-9);
      const weights = [1, hydroxylOverOxygen, hydroxylOverOxygen * waterOverHydroxyl];
      const total = weights.reduce((sum, weight) => sum + weight, 0);
      const expected = weights.map((weight) => weight / total);
      expected.forEach((share) => expect(share).toBeGreaterThan(0.05));
      const plan = EXPERIMENT_TEMPLATES.waterFromAtoms;
      if (plan === undefined) {
        throw new Error('waterFromAtoms template expected');
      }
      const values = runExperiment(plan, {
        seed: SEED,
        shots: SHOTS,
        includeSystemReport: false,
        parameters: { temperatureInKelvin: MIXED_TEMPERATURE_IN_KELVIN },
      }).reportValues;
      const observed = ['16O', 'HO', 'H2O'].map(
        (symbol) => values[`Через микросекунду[${symbol}]`] ?? 0,
      );
      expected.forEach((share, index) => {
        expect(Math.abs((observed[index] ?? 0) - share)).toBeLessThanOrEqual(
          statisticalTolerance(share, SHOTS),
        );
      });
    },
    MONTE_CARLO_TIMEOUT_IN_MILLISECONDS,
  );
});
