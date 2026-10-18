/* Decays: samples decay times and channels (a particle whose width PDG does not give decays at once), resolves inclusive hadronic and invisible channels into quark or neutrino pairs by tree widths, turns quark-level spectator channels of heavy mesons into hadrons through colour strings, builds product particles with lab-frame kinematics, retires the parent, checks conservation and runs the cascade of hadron decays inside a time window. */
import { particleSpec } from '@standard-model/constants';
import {
  PARTICLE_NAMES,
  type DecayChannel,
  type DecayProduct,
  type Environment,
  type FourMomentumInGev,
  type Particle,
  type ParticleName,
  type ParticleSpec,
  type RandomSource,
  type Vector3,
} from '@standard-model/contracts';
import {
  normalizeWeights,
  sampleExponentialTime,
  sampleIndexByWeights,
  vectorMagnitude,
  velocityInMetersPerSecond,
  ZERO_VECTOR,
} from '@standard-model/utils';
import type { Dynamics } from '../environment/dynamics.js';
import { ProcessKinematics } from '../feynman/observables.js';
import { SHARED_PROCESS_CALCULATOR } from '../feynman/process-calculator.js';
import { isDecayable } from '../particles/capabilities.js';
import type { ParticleFactory } from '../particles/particle-factory.js';
import { Quark } from '../particles/quark.js';
import {
  diquarkOf,
  type ColorString,
  type StringFragmentation,
} from '../particles/string-fragmentation.js';
import type { QuantumCore } from '../quantum/quantum-core.js';
import {
  conservationViolations,
  exclusiveProductNames,
  isExclusiveChannel,
} from './conservation.js';
import type { MatrixElementRegistry } from './matrix-elements.js';
import { virtualBosonResolutions } from './virtual-boson.js';
import { boostToLab, threeBodyRestFrame, twoBodyRestFrame } from './phase-space.js';
import { LocalizedError, localizedText } from '@standard-model/contracts';

const FOUR_MOMENTUM_TOLERANCE = 1e-9;
const MAXIMUM_HADRONIZATION_ATTEMPTS = 100;
const MINIMUM_SPECTATOR_CHANNEL_LENGTH = 4;

export interface DecayProductOutcome {
  readonly name: DecayProduct;
  readonly particle: Particle | null;
  readonly fourMomentumInGev: FourMomentumInGev | null;
}

export interface DecayEvent {
  readonly parent: Particle;
  readonly channel: DecayChannel;
  readonly products: readonly DecayProductOutcome[];
  readonly properTimeInSeconds: number | null;
  readonly labTimeInSeconds: number | null;
  readonly decayLengthInMeters: number | null;
  readonly vertexInFemtometers: Vector3;
}

export interface DecayOptions {
  readonly exclusiveOnly?: boolean;
  readonly channelIndex?: number;
}

export interface CascadeDecay {
  readonly event: DecayEvent;
  readonly labTimeInSeconds: number;
}

export interface ChannelProbability {
  readonly channelIndex: number;
  readonly channel: DecayChannel;
  readonly probability: number;
}

const resolutions = new Map<
  string,
  readonly { readonly products: readonly ParticleName[]; readonly widthInGev: number }[]
>();

function inclusiveResolutions(
  parent: ParticleName,
  inclusive: 'hadrons' | 'invisible',
): readonly { readonly products: readonly ParticleName[]; readonly widthInGev: number }[] {
  const key = `${parent}:${inclusive}`;
  const cached = resolutions.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const spec = particleSpec(parent);
  const wanted = (name: ParticleName): boolean =>
    inclusive === 'hadrons'
      ? particleSpec(name).family === 'quark'
      : particleSpec(name).family === 'neutrino';
  const candidates = PARTICLE_NAMES.filter(
    (name) => particleSpec(name).constituents === null && wanted(name),
  );
  const model = SHARED_PROCESS_CALCULATOR.model('fermiConstant');
  const kinematics = new ProcessKinematics(model);
  const options = candidates.flatMap((first, index) =>
    candidates.slice(index + 1).flatMap((second) => {
      const products: readonly [ParticleName, ParticleName] = [first, second];
      const charge = products.reduce(
        (sum, name) => sum + particleSpec(name).electricChargeInElementaryUnits,
        0,
      );
      const baryons = products.reduce((sum, name) => sum + particleSpec(name).baryonNumber, 0);
      if (
        Math.abs(charge - spec.electricChargeInElementaryUnits) > 1e-9 ||
        Math.abs(baryons - spec.baryonNumber) > 1e-9
      ) {
        return [];
      }
      if (SHARED_PROCESS_CALCULATOR.diagrams(model, [parent], products).length === 0) {
        return [];
      }
      const widthInGev = kinematics.twoBodyWidth(parent, products);
      return widthInGev > 0 ? [{ products, widthInGev }] : [];
    }),
  );
  resolutions.set(key, options);
  return options;
}

export class Decays {
  constructor(
    private readonly particles: ParticleFactory,
    private readonly quantum: QuantumCore,
    private readonly dynamics: Dynamics,
    private readonly random: RandomSource,
    private readonly matrixElements: MatrixElementRegistry,
    private readonly fragmentation: StringFragmentation,
  ) {}

  cascade(
    roots: readonly Particle[],
    windowInSeconds: number,
    cascades: (particle: Particle) => boolean,
  ): readonly CascadeDecay[] {
    const decays: CascadeDecay[] = [];
    const pending = roots.map((particle) => ({ particle, startInSeconds: 0 }));
    for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
      const { particle, startInSeconds } = next;
      if (particle.status !== 'alive' || !cascades(particle) || !this.canDecay(particle)) {
        continue;
      }
      const meanLife = isDecayable(particle) ? particle.meanLifeInSeconds : null;
      const lorentzFactor =
        particle.kinematics.fourMomentumInGev.energy / particle.spec.massInGev.value;
      const labTime =
        meanLife === null ? 0 : sampleExponentialTime(meanLife, this.random) * lorentzFactor;
      const decayTime = startInSeconds + labTime;
      if (decayTime > windowInSeconds) {
        continue;
      }
      particle.advanceProperTime(labTime / lorentzFactor);
      const event = this.decay(particle);
      decays.push({ event, labTimeInSeconds: decayTime });
      event.products.forEach((product) => {
        if (product.particle !== null) {
          pending.push({ particle: product.particle, startInSeconds: decayTime });
        }
      });
    }
    return decays;
  }

  canDecay(particle: Particle): boolean {
    try {
      this.assertCanDecay(particle);
      return true;
    } catch {
      return false;
    }
  }

  channelProbabilities(
    particle: Particle,
    options: DecayOptions = {},
  ): readonly ChannelProbability[] {
    const channels = this.decayChannelsOf(particle).filter(
      (entry) => options.exclusiveOnly !== true || isExclusiveChannel(entry.channel),
    );
    if (channels.length === 0) {
      throw new LocalizedError(
        localizedText(
          `у ${particle.spec.name} нет пригодного канала распада`,
          `${particle.spec.name} has no usable decay channel`,
        ),
      );
    }
    const probabilities = normalizeWeights(
      channels.map((entry) => entry.channel.branchingFraction.value),
    );
    return channels.map((entry, position) => ({
      ...entry,
      probability: probabilities[position] ?? 0,
    }));
  }

  sampleProperDecayTime(particle: Particle): number {
    const meanLife = this.meanLifeOf(particle);
    return sampleExponentialTime(meanLife, this.random);
  }

  decay(particle: Particle, options: DecayOptions = {}): DecayEvent {
    const chosen = this.chooseChannel(particle, options);
    this.retire(particle);
    return {
      parent: particle,
      channel: chosen.channel,
      products: this.produce(particle, chosen.channel),
      properTimeInSeconds: null,
      labTimeInSeconds: null,
      decayLengthInMeters: null,
      vertexInFemtometers: particle.kinematics.positionInFemtometers,
    };
  }

  decayAfterSampledTime(
    particle: Particle,
    environment: Environment,
    options: DecayOptions = {},
  ): DecayEvent {
    this.assertCanDecay(particle);
    const meanLife = isDecayable(particle) ? particle.meanLifeInSeconds : null;
    const properTime = meanLife === null ? 0 : sampleExponentialTime(meanLife, this.random);
    const lorentzFactor =
      particle.kinematics.fourMomentumInGev.energy / particle.spec.massInGev.value;
    const labTime = properTime * lorentzFactor;
    const speed = vectorMagnitude(
      velocityInMetersPerSecond(
        particle.spec.massInGev.value,
        particle.kinematics.fourMomentumInGev.momentum,
      ),
    );
    this.dynamics.evolve(particle, environment, labTime);
    return {
      ...this.decay(particle, options),
      properTimeInSeconds: properTime,
      labTimeInSeconds: labTime,
      decayLengthInMeters: speed * labTime,
    };
  }

  private decayChannelsOf(
    particle: Particle,
  ): readonly { channelIndex: number; channel: DecayChannel }[] {
    this.assertCanDecay(particle);
    if (!isDecayable(particle)) {
      throw new LocalizedError(
        localizedText(
          `${particle.spec.name} не может распасться`,
          `${particle.spec.name} cannot decay`,
        ),
      );
    }
    return particle.decayChannels.map((channel, channelIndex) => ({ channelIndex, channel }));
  }

  private meanLifeOf(particle: Particle): number {
    this.assertCanDecay(particle);
    const meanLife = isDecayable(particle) ? particle.meanLifeInSeconds : null;
    if (meanLife === null) {
      throw new LocalizedError(
        localizedText(
          `у ${particle.spec.name} нет среднего времени жизни`,
          `${particle.spec.name} has no mean life`,
        ),
      );
    }
    return meanLife;
  }

  private assertCanDecay(particle: Particle): void {
    if (particle.status === 'decayed') {
      throw new LocalizedError(
        localizedText(`${particle.id} уже распалась`, `${particle.id} has already decayed`),
      );
    }
    if (particle instanceof Quark && particle.isConfined) {
      throw new LocalizedError(
        localizedText(
          `${particle.spec.name} заперт конфайнментом и свободно не распадается`,
          `${particle.spec.name} is confined and does not decay freely`,
        ),
      );
    }
    if (!isDecayable(particle) || particle.decayChannels.length === 0) {
      throw new LocalizedError(
        localizedText(`${particle.spec.name} стабилен`, `${particle.spec.name} is stable`),
      );
    }
  }

  private chooseChannel(particle: Particle, options: DecayOptions): ChannelProbability {
    const probabilities = this.channelProbabilities(particle, options);
    if (options.channelIndex !== undefined) {
      const forced = probabilities.find((entry) => entry.channelIndex === options.channelIndex);
      if (forced === undefined) {
        throw new Error(`${particle.spec.name} has no channel ${String(options.channelIndex)}`);
      }
      return forced;
    }
    const chosen =
      probabilities[
        sampleIndexByWeights(
          probabilities.map((entry) => entry.probability),
          this.random,
        )
      ];
    if (chosen === undefined) {
      throw new Error('No channel chosen');
    }
    return chosen;
  }

  private retire(particle: Particle): void {
    particle.quantumSlots.forEach((slot) => {
      const register = this.quantum.registers.byId(slot.registerId);
      if (register.slots.length > 1) {
        throw new LocalizedError(
          localizedText(
            `${particle.id} запутана; распад запутанных частиц пока не поддерживается`,
            `${particle.id} is entangled; decaying entangled particles is not supported yet`,
          ),
        );
      }
      this.quantum.registers.dispose(register);
    });
    particle.markDecayed();
  }

  private produce(parent: Particle, channel: DecayChannel): readonly DecayProductOutcome[] {
    const resolved = isExclusiveChannel(channel)
      ? null
      : this.resolveInclusive(parent.spec.name, channel);
    if (!isExclusiveChannel(channel) && resolved === null) {
      return channel.products.map((name) => ({ name, particle: null, fourMomentumInGev: null }));
    }
    const names = this.realizable(parent.spec, resolved ?? exclusiveProductNames(channel));
    const specs = names.map((name) => particleSpec(name));
    const violations = conservationViolations(parent.spec, specs);
    if (violations.length > 0) {
      throw new Error(
        `${parent.spec.name} -> ${names.join(' ')} violates ${violations.join(', ')}`,
      );
    }
    if (
      (parent.spec.family === 'meson' || parent.spec.family === 'baryon') &&
      specs.some((spec) => spec.family === 'quark')
    ) {
      return this.produceThroughStrings(parent, names);
    }
    const masses = specs.map((spec) => spec.massInGev.value);
    const productMassSum = masses.reduce((sum, mass) => sum + mass, 0);
    if (productMassSum >= parent.spec.massInGev.value) {
      return names.map((name) => ({ name, particle: null, fourMomentumInGev: null }));
    }
    const parentMass = parent.spec.massInGev.value;
    const restFrame = this.sampleRestFrame(parent, names, parentMass, masses);
    const labFrame = boostToLab(restFrame, parent.kinematics.fourMomentumInGev, parentMass);
    this.assertFourMomentumConserved(parent.kinematics.fourMomentumInGev, labFrame);
    return names.map((name, index) => {
      const fourMomentum = labFrame[index];
      if (fourMomentum === undefined) {
        throw new Error('Missing product momentum');
      }
      return {
        name,
        fourMomentumInGev: fourMomentum,
        particle: this.particles.create(name, {
          momentumInGev: fourMomentum.momentum,
          positionInFemtometers: parent.kinematics.positionInFemtometers,
        }),
      };
    });
  }

  private realizable(
    parent: ParticleSpec,
    names: readonly ParticleName[],
  ): readonly ParticleName[] {
    const massSum = names.reduce((sum, name) => sum + particleSpec(name).massInGev.value, 0);
    if (massSum < parent.massInGev.value) {
      return names;
    }
    const options = virtualBosonResolutions(parent.name, names);
    if (options.length === 0) {
      return names;
    }
    const chosen =
      options[
        sampleIndexByWeights(
          options.map((option) => option.widthInGev),
          this.random,
        )
      ];
    return chosen?.products ?? names;
  }

  private produceThroughStrings(
    parent: Particle,
    names: readonly ParticleName[],
  ): readonly DecayProductOutcome[] {
    const [daughter, first, second, ...spectators] = names;
    const spectator =
      spectators.length === 1 ? spectators[0] : diquarkOf(spectators[0], spectators[1]);
    if (
      names.length < MINIMUM_SPECTATOR_CHANNEL_LENGTH ||
      daughter === undefined ||
      first === undefined ||
      second === undefined ||
      spectator === undefined ||
      spectator === null
    ) {
      throw new Error(`${parent.spec.name} -> ${names.join(' ')} is not a spectator channel`);
    }
    const massOf = (name: ParticleName): number => particleSpec(name).massInGev.value;
    const isQuark = (name: ParticleName): boolean => particleSpec(name).family === 'quark';
    const parentMass = parent.spec.massInGev.value;
    const spectatorMass = massOf(spectator);
    for (let attempt = 0; attempt < MAXIMUM_HADRONIZATION_ATTEMPTS; attempt += 1) {
      const [daughterMomentum, firstMomentum, secondMomentum] = threeBodyRestFrame(
        parentMass - spectatorMass,
        [massOf(daughter), massOf(first), massOf(second)],
        this.random,
      ) as [FourMomentumInGev, FourMomentumInGev, FourMomentumInGev];
      const ends = [
        { flavor: daughter, fourMomentumInGev: daughterMomentum },
        { flavor: spectator, fourMomentumInGev: { energy: spectatorMass, momentum: ZERO_VECTOR } },
        { flavor: first, fourMomentumInGev: firstMomentum },
        { flavor: second, fourMomentumInGev: secondMomentum },
      ];
      const asString = (one: (typeof ends)[number], other: (typeof ends)[number]): ColorString =>
        particleSpec(one.flavor).colorRepresentation === 'triplet'
          ? { quark: one, antiquark: other }
          : { quark: other, antiquark: one };
      const [daughterEnd, spectatorEnd, firstEnd, secondEnd] = ends as [
        (typeof ends)[number],
        (typeof ends)[number],
        (typeof ends)[number],
        (typeof ends)[number],
      ];
      const virtualIsHadronic = isQuark(first) && isQuark(second);
      const strings = [
        asString(daughterEnd, spectatorEnd),
        ...(virtualIsHadronic ? [asString(firstEnd, secondEnd)] : []),
      ];
      const colorless = virtualIsHadronic
        ? []
        : [firstEnd, secondEnd].map((end) => ({
            name: end.flavor,
            massInGev: massOf(end.flavor),
            fourMomentumInGev: end.fourMomentumInGev,
          }));
      const result = this.fragmentation.hadronizeAtRest(strings, colorless);
      if (result === null) {
        continue;
      }
      const restFrame = [
        ...result.hadrons,
        ...colorless.map((product, index) => ({
          name: product.name,
          fourMomentumInGev: result.colorless[index] ?? product.fourMomentumInGev,
        })),
      ];
      const labFrame = boostToLab(
        restFrame.map((product) => product.fourMomentumInGev),
        parent.kinematics.fourMomentumInGev,
        parentMass,
      );
      this.assertFourMomentumConserved(parent.kinematics.fourMomentumInGev, labFrame);
      return restFrame.map((product, index) => {
        const fourMomentum = labFrame[index] ?? product.fourMomentumInGev;
        return {
          name: product.name,
          fourMomentumInGev: fourMomentum,
          particle: this.particles.create(product.name, {
            momentumInGev: fourMomentum.momentum,
            positionInFemtometers: parent.kinematics.positionInFemtometers,
          }),
        };
      });
    }
    throw new Error(`${parent.spec.name} -> ${names.join(' ')} could not form hadrons`);
  }

  private resolveInclusive(
    parent: ParticleName,
    channel: DecayChannel,
  ): readonly ParticleName[] | null {
    const [inclusive, ...others] = channel.products;
    if (others.length > 0 || (inclusive !== 'hadrons' && inclusive !== 'invisible')) {
      return null;
    }
    const options = inclusiveResolutions(parent, inclusive);
    if (options.length === 0) {
      return null;
    }
    const chosen =
      options[
        sampleIndexByWeights(
          normalizeWeights(options.map((option) => option.widthInGev)),
          this.random,
        )
      ];
    return chosen?.products ?? null;
  }

  private sampleRestFrame(
    parent: Particle,
    names: readonly DecayProduct[],
    parentMass: number,
    masses: readonly number[],
  ): readonly FourMomentumInGev[] {
    const [first, second, third, ...rest] = masses;
    if (first === undefined || second === undefined || rest.length > 0) {
      throw new Error(
        `${parent.spec.name} decay with ${String(masses.length)} bodies is not supported`,
      );
    }
    if (third === undefined) {
      return twoBodyRestFrame(parentMass, [first, second], this.random);
    }
    const weight = this.matrixElements.lookup(parent.spec.name, names);
    return threeBodyRestFrame(parentMass, [first, second, third], this.random, weight);
  }

  private assertFourMomentumConserved(
    parent: FourMomentumInGev,
    products: readonly FourMomentumInGev[],
  ): void {
    const total = products.reduce(
      (sum, momentum) => ({
        energy: sum.energy + momentum.energy,
        momentum: {
          x: sum.momentum.x + momentum.momentum.x,
          y: sum.momentum.y + momentum.momentum.y,
          z: sum.momentum.z + momentum.momentum.z,
        },
      }),
      { energy: 0, momentum: { x: 0, y: 0, z: 0 } },
    );
    const scale = Math.max(parent.energy, 1e-300);
    const mismatch = Math.max(
      Math.abs(total.energy - parent.energy),
      Math.abs(total.momentum.x - parent.momentum.x),
      Math.abs(total.momentum.y - parent.momentum.y),
      Math.abs(total.momentum.z - parent.momentum.z),
    );
    if (mismatch > FOUR_MOMENTUM_TOLERANCE * scale) {
      throw new Error('Decay products do not conserve four-momentum');
    }
  }
}
