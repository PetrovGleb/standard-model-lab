/* MolecularDynamics: during evolve a molecule exchanges heat with the environment (gas collisions at n·σ·v with a medium, an ideal heat bath otherwise), and a neutral atom or molecule in a gas breaks
   bonds thermally, makes bonds with the gas and trades atoms with its molecules (BEBO barriers, transition-state rates). One reaction per step samples the first event; all reactions in the step run
   the exact Markov chain of the species the line passes through, where a product that is a species of the gas dissolves into it, so the end state follows the chemical equilibrium of the gas. */
import { elementSymbol, hasFormalCharges } from '@standard-model/constants';
import {
  localizedText,
  type Environment,
  type LocalizedText,
  type MediumAspect,
  type Particle,
  type ParticleName,
  type RandomSource,
} from '@standard-model/contracts';
import {
  absorbingMarkovTransition,
  sampleExponentialTime,
  sampleIndexByWeights,
} from '@standard-model/utils';
import { Molecule } from '../particles/molecule.js';
import { atomTransferChannels } from './atom-transfer.js';
import { associationChannels, bondingStructureOf } from './molecular-association.js';
import {
  bondDissociationRatesPerSecond,
  heatExchangeRatePerSecond,
  fragmentsAfterBreaking,
  relaxedTemperature,
} from './molecular-behaviour.js';
import { molecularStructure } from './molecular-structure.js';

const MAXIMUM_CHEMICAL_STATES = 24;

export interface ChemicalOutcome {
  readonly products: readonly ParticleName[];
  readonly label: LocalizedText;
}

interface ChemicalExit {
  readonly from: number;
  readonly products: readonly ParticleName[];
  readonly ratePerSecond: number;
}

function dissociationLabel(): LocalizedText {
  return localizedText('тепловая диссоциация', 'thermal dissociation');
}

function elementCounts(names: readonly ParticleName[]): Map<number, number> {
  const counts = new Map<number, number>();
  names.forEach((name) =>
    (bondingStructureOf(name)?.atoms ?? []).forEach((atom) =>
      counts.set(atom.protons, (counts.get(atom.protons) ?? 0) + 1),
    ),
  );
  return counts;
}

function atomsText(counts: readonly (readonly [number, number])[]): string {
  return counts
    .map(([protons, count]) => `${count === 1 ? '' : `${String(count)} `}${elementSymbol(protons)}`)
    .join(', ');
}

function chemistryLabel(start: ParticleName, products: readonly ParticleName[]): LocalizedText {
  const before = elementCounts([start]);
  const after = elementCounts(products);
  const elements = [...new Set([...before.keys(), ...after.keys()])].sort(
    (first, second) => first - second,
  );
  const change = elements.map(
    (protons) => [protons, (after.get(protons) ?? 0) - (before.get(protons) ?? 0)] as const,
  );
  const taken = atomsText(change.filter(([, count]) => count > 0));
  const given = atomsText(
    change.filter(([, count]) => count < 0).map(([protons, count]) => [protons, -count] as const),
  );
  const russian = [taken === '' ? '' : `из газа ${taken}`, given === '' ? '' : `в газ ${given}`];
  const english = [
    taken === '' ? '' : `${taken} from the gas`,
    given === '' ? '' : `${given} to the gas`,
  ];
  const detail = (parts: readonly string[]): string =>
    parts.some((part) => part !== '') ? `: ${parts.filter((part) => part !== '').join('; ')}` : '';
  return localizedText(
    `реакции с газом${detail(russian)}`,
    `reactions with the gas${detail(english)}`,
  );
}

export function chemicalChain(start: ParticleName, medium: MediumAspect) {
  const ambient = new Set(medium.components.map((component) => component.species));
  const states: ParticleName[] = [start];
  const transitions: { from: number; target: number; ratePerSecond: number }[] = [];
  const exits: ChemicalExit[] = [];
  const indexOf = (name: ParticleName): number => {
    const known = states.indexOf(name);
    if (known >= 0 || states.length >= MAXIMUM_CHEMICAL_STATES) {
      return known;
    }
    states.push(name);
    return states.length - 1;
  };
  for (let from = 0; from < states.length; from += 1) {
    const state = states[from] ?? start;
    associationChannels(state, medium).forEach((channel) => {
      const target = indexOf(channel.product);
      if (target >= 0) {
        transitions.push({ from, target, ratePerSecond: channel.ratePerSecond });
      }
    });
    atomTransferChannels(state, medium).forEach(({ products, ratePerSecond }) => {
      const carried = products.filter((product) => !ambient.has(product));
      const target = carried.length === 1 && carried[0] !== undefined ? indexOf(carried[0]) : -1;
      if (target >= 0) {
        transitions.push({ from, target, ratePerSecond });
      } else {
        exits.push({ from, products, ratePerSecond });
      }
    });
    if (!state.startsWith('molecule:')) {
      continue;
    }
    bondDissociationRatesPerSecond(molecularStructure(state), medium.temperatureInKelvin).forEach(
      (ratePerSecond, bond) => {
        const fragments = fragmentsAfterBreaking(state, [bond]);
        const carried = fragments.filter((fragment) => !ambient.has(fragment));
        const target = carried.length === 1 && carried[0] !== undefined ? indexOf(carried[0]) : -1;
        if (target >= 0) {
          transitions.push({ from, target, ratePerSecond });
        } else {
          exits.push({ from, products: fragments, ratePerSecond });
        }
      },
    );
  }
  const generatorPerSecond = states.map(() => states.map(() => 0));
  transitions.forEach(({ from, target, ratePerSecond }) => {
    const row = generatorPerSecond[from];
    if (row !== undefined && from !== target) {
      row[target] = (row[target] ?? 0) + ratePerSecond;
      row[from] = (row[from] ?? 0) - ratePerSecond;
    }
  });
  const absorptionRatesPerSecond = states.map((unused, from) =>
    exits.map((exit) => (exit.from === from ? exit.ratePerSecond : 0)),
  );
  return { states, exits, generatorPerSecond, absorptionRatesPerSecond };
}

interface ChainOutcomes {
  readonly chain: ReturnType<typeof chemicalChain>;
  readonly endWeights: readonly number[] | null;
}

const CHAIN_CACHE_LIMIT = 4096;
const chainCache = new Map<string, ChainOutcomes>();

function chainOutcomes(
  start: ParticleName,
  medium: MediumAspect,
  durationInSeconds: number,
): ChainOutcomes {
  const key = `${start}|${String(durationInSeconds)}|${JSON.stringify(medium)}`;
  const cached = chainCache.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const chain = chemicalChain(start, medium);
  const quiet = chain.states.length < 2 && chain.exits.length === 0;
  const transition = quiet
    ? null
    : absorbingMarkovTransition(
        chain.generatorPerSecond,
        chain.absorptionRatesPerSecond,
        durationInSeconds,
      );
  const outcomes = {
    chain,
    endWeights:
      transition === null
        ? null
        : [
            ...(transition.survivingProbabilities[0] ?? []),
            ...(transition.absorbedProbabilities[0] ?? []),
          ],
  };
  if (chainCache.size >= CHAIN_CACHE_LIMIT) {
    chainCache.clear();
  }
  chainCache.set(key, outcomes);
  return outcomes;
}

export class MolecularDynamics {
  constructor(private readonly random: RandomSource) {}

  evolve(
    particle: Particle,
    environment: Environment,
    durationInSeconds: number,
  ): ChemicalOutcome | null {
    const medium = environment.get('medium');
    const bath = environment.get('temperature')?.temperatureInKelvin ?? medium?.temperatureInKelvin;
    if (particle instanceof Molecule && bath !== undefined) {
      particle.internalTemperatureInKelvin =
        medium === undefined
          ? bath
          : relaxedTemperature(
              particle.internalTemperatureInKelvin,
              bath,
              heatExchangeRatePerSecond(particle.structure, medium, bath),
              durationInSeconds,
            );
    }
    if (hasFormalCharges(particle.spec.name)) {
      return null;
    }
    if (medium !== undefined && medium.reactionMode === 'allReactionsInStep') {
      return this.reactInChain(particle.spec.name, medium, durationInSeconds);
    }
    const dissociation =
      particle instanceof Molecule
        ? bondDissociationRatesPerSecond(particle.structure, particle.internalTemperatureInKelvin)
        : [];
    const association = medium === undefined ? [] : associationChannels(particle.spec.name, medium);
    const transfers = medium === undefined ? [] : atomTransferChannels(particle.spec.name, medium);
    const rates = [
      ...dissociation,
      ...association.map((channel) => channel.ratePerSecond),
      ...transfers.map((channel) => channel.ratePerSecond),
    ];
    const total = rates.reduce((sum, rate) => sum + rate, 0);
    if (total <= 0 || sampleExponentialTime(1 / total, this.random) > durationInSeconds) {
      return null;
    }
    let pick = this.random.nextUnit() * total;
    const chosen = Math.max(
      rates.findIndex((rate) => {
        pick -= rate;
        return pick <= 0;
      }),
      0,
    );
    const transfer = transfers[chosen - dissociation.length - association.length];
    if (transfer !== undefined) {
      return {
        products: transfer.products,
        label: chemistryLabel(particle.spec.name, transfer.products),
      };
    }
    const joined = association[chosen - dissociation.length];
    if (joined === undefined) {
      return {
        products: fragmentsAfterBreaking(particle.spec.name, [chosen]),
        label: dissociationLabel(),
      };
    }
    return {
      products: [joined.product],
      label: chemistryLabel(particle.spec.name, [joined.product]),
    };
  }

  private reactInChain(
    start: ParticleName,
    medium: MediumAspect,
    durationInSeconds: number,
  ): ChemicalOutcome | null {
    const { chain, endWeights } = chainOutcomes(start, medium, durationInSeconds);
    if (endWeights === null) {
      return null;
    }
    const end = sampleIndexByWeights(endWeights, this.random);
    if (end === 0) {
      return null;
    }
    const products =
      end < chain.states.length
        ? [chain.states[end] ?? start]
        : (chain.exits[end - chain.states.length]?.products ?? []);
    return { products, label: chemistryLabel(start, products) };
  }
}
