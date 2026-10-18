/* MediumReactions: an alive particle against every component of the medium over one window. Its charge states with the lepton component, the fusion channels of its nuclear states with each
   nuclear component and the decays of those states (NUBASE channels, continuum electron capture) form one absorbing Markov chain whose end over the window is sampled, so every channel competes
   by rate; in the all-reactions mode the reaction time is sampled as well and the heaviest product carries the line on in the rest of the window while it is unstable or burns without being a species of the medium: a product the medium already holds has dissolved into it and its further fate is the medium's statistics. */
import {
  localizedText,
  textIn,
  type LocalizedText,
  type MediumAspect,
  type Particle,
  type ParticleName,
  type RandomSource,
} from '@standard-model/contracts';
import {
  absorbingMarkovTransition,
  absorptionTimeInSeconds,
  sampleIndexByWeights,
} from '@standard-model/utils';
import type { ParticleFactory } from '../particles/particle-factory.js';
import { isLepton } from './atomic-processes.js';
import { decayChannelsInMedium, type DecayChannelInMedium } from './nuclear-decay-in-medium.js';
import { decayProductsOf } from './nuclear-reactions.js';
import {
  chargeChain,
  chargeChainGenerator,
  chargeChainRates,
  effectiveTemperatureInKelvin,
  type ChargeChain,
  type ChargeChainRates,
  type MediumChargeBalance,
} from './medium-charge-balance.js';
import {
  mediumFusionChannels,
  type MediumFusionChannel,
  type ThermalNuclearReactions,
} from './nuclear-reactions.js';

export interface StateFusionChannel extends MediumFusionChannel {
  readonly stateIndex: number;
}

export interface StateDecayChannel extends DecayChannelInMedium {
  readonly stateIndex: number;
}

export interface MediumTransition {
  readonly chain: ChargeChain;
  readonly lepton: ParticleName | null;
  readonly chargeTemperatureInKelvin: number;
  readonly rates: ChargeChainRates;
  readonly fusions: readonly StateFusionChannel[];
  readonly decays: readonly StateDecayChannel[];
  readonly generatorPerSecond: number[][];
  readonly absorptionRatesPerSecond: number[][];
}

export interface MediumContinuation {
  readonly particle: Particle;
  readonly remainingInSeconds: number;
  readonly visited: ReadonlySet<ParticleName>;
}

export interface MediumOutcome {
  readonly kind: 'fusion' | 'ionization' | 'recombination' | 'decay';
  readonly products: readonly Particle[];
  readonly label: LocalizedText | string;
  readonly continuation: MediumContinuation | null;
}

const NO_CHARGE_RATES: ChargeChainRates = {
  ionizationPerSecond: [],
  radiativePerSecond: [],
  threeBodyPerSecond: [],
};

export function mediumTransition(particle: Particle, medium: MediumAspect): MediumTransition {
  const lepton = medium.components.find((component) => isLepton(component.species));
  const temperature =
    lepton === undefined ? 0 : effectiveTemperatureInKelvin(particle, medium, lepton.species);
  const chain =
    lepton !== undefined && temperature > 0
      ? chargeChain(particle.spec.name, lepton.species)
      : { states: [particle.spec.name], startIndex: 0 };
  const rates =
    lepton !== undefined && chain.states.length > 1
      ? chargeChainRates(
          chain.states,
          lepton,
          temperature,
          medium.components,
          medium.radiationTemperatureInKelvin ?? 0,
        )
      : NO_CHARGE_RATES;
  const fusions = chain.states.flatMap((state, stateIndex) =>
    mediumFusionChannels(state, medium).map((fusion) => ({ ...fusion, stateIndex })),
  );
  const decays = chain.states.flatMap((state, stateIndex) =>
    decayChannelsInMedium(state, medium).map((decay) => ({ ...decay, stateIndex })),
  );
  return {
    chain,
    lepton: lepton?.species ?? null,
    chargeTemperatureInKelvin: temperature,
    rates,
    fusions,
    decays,
    generatorPerSecond: chargeChainGenerator(rates),
    absorptionRatesPerSecond: chain.states.map((unused, stateIndex) => [
      ...fusions.map((fusion) => (fusion.stateIndex === stateIndex ? fusion.ratePerSecond : 0)),
      ...decays.map((decay) => (decay.stateIndex === stateIndex ? decay.ratePerSecond : 0)),
    ]),
  };
}

export function mediumOutcomeProbabilities(
  transition: MediumTransition,
  durationInSeconds: number,
): readonly number[] {
  const start = transition.chain.startIndex;
  const { survivingProbabilities, absorbedProbabilities } = absorbingMarkovTransition(
    transition.generatorPerSecond,
    transition.absorptionRatesPerSecond,
    durationInSeconds,
  );
  return [...(survivingProbabilities[start] ?? []), ...(absorbedProbabilities[start] ?? [])];
}

function continuingProduct(
  products: readonly Particle[],
  visited: ReadonlySet<ParticleName>,
  medium: MediumAspect,
): Particle | null {
  const ambient = new Set(medium.components.map((component) => component.species));
  return products
    .filter((product) => {
      const name = product.spec.name;
      const unstable = decayChannelsInMedium(name, medium).length > 0;
      const burns = mediumFusionChannels(name, medium).length > 0;
      return !visited.has(name) && (unstable || (burns && !ambient.has(name)));
    })
    .reduce<Particle | null>(
      (best, product) =>
        best === null || product.spec.massInGev.value > best.spec.massInGev.value ? product : best,
      null,
    );
}

export class MediumReactions {
  constructor(
    private readonly fusion: ThermalNuclearReactions,
    private readonly chargeBalance: MediumChargeBalance,
    private readonly particles: ParticleFactory,
    private readonly random: RandomSource,
  ) {}

  react(
    particle: Particle,
    medium: MediumAspect,
    durationInSeconds: number,
    visited: ReadonlySet<ParticleName> = new Set(),
  ): MediumOutcome | null {
    if (!(durationInSeconds > 0)) {
      return null;
    }
    const line = new Set([...visited, particle.spec.name]);
    const transition = mediumTransition(particle, medium);
    const start = transition.chain.startIndex;
    const size = transition.chain.states.length;
    if (size < 2 && transition.fusions.length === 0 && transition.decays.length === 0) {
      return null;
    }
    const probabilities = mediumOutcomeProbabilities(transition, durationInSeconds);
    if ((probabilities[start] ?? 1) >= 1) {
      return null;
    }
    const endIndex = sampleIndexByWeights(probabilities, this.random);
    if (endIndex === start) {
      return null;
    }
    if (endIndex < size) {
      return this.changeCharge(particle, medium, transition, endIndex);
    }
    const channelIndex = endIndex - size;
    return channelIndex < transition.fusions.length
      ? this.fuse(particle, medium, transition, channelIndex, durationInSeconds, line)
      : this.decayInMedium(particle, medium, transition, channelIndex, durationInSeconds, line);
  }

  private decayInMedium(
    particle: Particle,
    medium: MediumAspect,
    transition: MediumTransition,
    channelIndex: number,
    durationInSeconds: number,
    visited: ReadonlySet<ParticleName>,
  ): MediumOutcome | null {
    const decay = transition.decays[channelIndex - transition.fusions.length];
    if (decay === undefined) {
      return null;
    }
    const start = transition.chain.startIndex;
    const freed =
      decay.stateIndex > start && transition.lepton !== null
        ? this.chargeBalance.freeLeptons(
            particle,
            medium,
            transition.lepton,
            transition.chain,
            decay.stateIndex,
          )
        : null;
    const nuclear = decayProductsOf(
      particle,
      decay.nucleus,
      decay.products,
      this.particles,
      this.random,
      medium.temperatureInKelvin,
    );
    const heaviest = continuingProduct(nuclear, visited, medium);
    const continuation =
      medium.reactionMode === 'allReactionsInStep' && heaviest !== null
        ? {
            particle: heaviest,
            visited,
            remainingInSeconds:
              durationInSeconds -
              absorptionTimeInSeconds(
                transition.generatorPerSecond,
                transition.absorptionRatesPerSecond,
                durationInSeconds,
                start,
                channelIndex,
                this.random.nextUnit(),
              ),
          }
        : null;
    const label =
      decay.kind === 'electronCapture'
        ? localizedText('захват электрона среды', 'capture of a medium electron')
        : decay.kind === 'photodisintegration'
          ? localizedText('фотораспад тепловыми фотонами', 'photodisintegration by thermal photons')
          : localizedText('распад в среде', 'decay in the medium');
    return {
      kind: 'decay',
      products: [...nuclear, ...(freed?.products.map((product) => product.particle) ?? [])],
      label:
        freed === null
          ? label
          : localizedText(
              `${textIn(freed.label, 'ru')}; ${label.ru}`,
              `${textIn(freed.label, 'en')}; ${label.en}`,
            ),
      continuation,
    };
  }

  private changeCharge(
    particle: Particle,
    medium: MediumAspect,
    transition: MediumTransition,
    endIndex: number,
  ): MediumOutcome | null {
    const lepton = transition.lepton;
    if (lepton === null) {
      return null;
    }
    const exchange =
      endIndex > transition.chain.startIndex
        ? this.chargeBalance.ionize(particle, medium, lepton, transition.chain, endIndex)
        : this.chargeBalance.recombine(
            particle,
            lepton,
            transition.chain,
            endIndex,
            transition.rates,
            transition.chargeTemperatureInKelvin,
          );
    return {
      kind: exchange.kind,
      products: exchange.products.map((product) => product.particle),
      label: exchange.label,
      continuation: null,
    };
  }

  private fuse(
    particle: Particle,
    medium: MediumAspect,
    transition: MediumTransition,
    fusionIndex: number,
    durationInSeconds: number,
    visited: ReadonlySet<ParticleName>,
  ): MediumOutcome | null {
    const fusion = transition.fusions[fusionIndex];
    if (fusion === undefined) {
      return null;
    }
    const start = transition.chain.startIndex;
    const freed =
      fusion.stateIndex > start && transition.lepton !== null
        ? this.chargeBalance.freeLeptons(
            particle,
            medium,
            transition.lepton,
            transition.chain,
            fusion.stateIndex,
          )
        : null;
    const nuclear = this.fusion
      .fuse(particle, fusion, medium.temperatureInKelvin)
      .map((product) => product.particle);
    const heaviest = continuingProduct(nuclear, visited, medium);
    const continuation =
      medium.reactionMode === 'allReactionsInStep' && heaviest !== null
        ? {
            particle: heaviest,
            visited,
            remainingInSeconds:
              durationInSeconds -
              absorptionTimeInSeconds(
                transition.generatorPerSecond,
                transition.absorptionRatesPerSecond,
                durationInSeconds,
                start,
                fusionIndex,
                this.random.nextUnit(),
              ),
          }
        : null;
    return {
      kind: 'fusion',
      products: [...nuclear, ...(freed?.products.map((product) => product.particle) ?? [])],
      label:
        freed === null
          ? fusion.channel.label
          : localizedText(
              `${textIn(freed.label, 'ru')}; ${fusion.channel.label}`,
              `${textIn(freed.label, 'en')}; ${fusion.channel.label}`,
            ),
      continuation,
    };
  }
}
