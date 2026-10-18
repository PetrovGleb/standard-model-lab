/* Collisions: two particles meet at their total energy; the process is chosen by the pair, the channel by cross sections, angles by dσ/dΩ, and products are created in the lab frame. */
import { particleSpec } from '@standard-model/constants';
import { PARTICLE_NAMES } from '@standard-model/contracts';
import type {
  FourMomentumInGev,
  Particle,
  ParticleName,
  RandomSource,
  Vector3,
} from '@standard-model/contracts';
import {
  addVectors,
  dotProduct,
  invariantMassInGev,
  lorentzBoost,
  normalizeWeights,
  sampleIndexByWeights,
  sampleIsotropicDirection,
  scaleVector,
  totalEnergyInGev,
  twoBodyDecayMomentumInGev,
  vectorMagnitude,
} from '@standard-model/utils';
import type { ParticleFactory } from '../particles/particle-factory.js';
import type { QuantumCore } from '../quantum/quantum-core.js';
import { ProcessCalculator, SHARED_PROCESS_CALCULATOR } from '../feynman/process-calculator.js';
import type { FeynmanModel } from '../feynman/amplitude.js';
import { ProcessKinematics } from '../feynman/observables.js';
import type { DiagramView } from '@standard-model/contracts';
import { LocalizedError, localizedText, type LocalizedText } from '@standard-model/contracts';

export interface CollisionProduct {
  readonly name: ParticleName;
  readonly particle: Particle;
  readonly fourMomentumInGev: FourMomentumInGev;
}

export interface PartonicDetails {
  readonly partons: readonly [ParticleName, ParticleName];
  readonly firstMomentumFraction: number;
  readonly secondMomentumFraction: number;
  readonly hardEnergyInGev: number;
  readonly transverseMomentumInGev: number;
  readonly remnantCount: number;
}

export interface CollisionEvent {
  readonly process: string;
  readonly centerOfMassEnergyInGev: number;
  readonly totalCrossSectionInNanobarns: number;
  readonly channelCrossSectionsInNanobarns: Readonly<Record<string, number>>;
  readonly cosineInCenterOfMass: number;
  readonly products: readonly CollisionProduct[];
  readonly diagrams: readonly DiagramView[];
  readonly partonic?: PartonicDetails;
}

export interface CollisionRequest {
  readonly channel?: string;
  readonly minimumTransverseMomentumInGev?: number;
}

export interface CollisionMechanism {
  applies(first: Particle, second: Particle, energyInGev: number): boolean;
  collide(first: Particle, second: Particle, request: CollisionRequest): CollisionEvent;
}

export const SUPPORTED_COLLISIONS: readonly LocalizedText[] = [
  localizedText(
    'любые две элементарные частицы: каналы и сечения считаются по древесным диаграммам лагранжиана',
    'any two elementary particles: channels and cross sections come from the tree diagrams of the Lagrangian',
  ),
  localizedText(
    'нуклоны и антинуклоны между собой и с элементарными частицами: жесткое рассеяние партонов по NNPDF выше порога p_T',
    'nucleons and antinucleons with each other and with elementary particles: hard parton scattering from NNPDF above the p_T threshold',
  ),
];

function fourMomentumOf(particle: Particle): FourMomentumInGev {
  return particle.kinematics.fourMomentumInGev;
}

function sum(first: FourMomentumInGev, second: FourMomentumInGev): FourMomentumInGev {
  return {
    energy: first.energy + second.energy,
    momentum: addVectors(first.momentum, second.momentum),
  };
}

function unit(vector: Vector3): Vector3 {
  const length = vectorMagnitude(vector);
  return length === 0 ? { x: 0, y: 0, z: 1 } : scaleVector(vector, 1 / length);
}

function cross(first: Vector3, second: Vector3): Vector3 {
  return {
    x: first.y * second.z - first.z * second.y,
    y: first.z * second.x - first.x * second.z,
    z: first.x * second.y - first.y * second.x,
  };
}

function directionAround(axis: Vector3, cosine: number, azimuth: number): Vector3 {
  const reference = Math.abs(axis.z) < 0.9 ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 };
  const first = unit(cross(axis, reference));
  const second = cross(axis, first);
  const sine = Math.sqrt(Math.max(0, 1 - cosine * cosine));
  return addVectors(
    scaleVector(axis, cosine),
    addVectors(
      scaleVector(first, sine * Math.cos(azimuth)),
      scaleVector(second, sine * Math.sin(azimuth)),
    ),
  );
}

interface ChannelTable {
  readonly products: readonly [ParticleName, ParticleName];
  readonly fluxFreeWeight: number;
  readonly crossSectionInNanobarns: number;
  readonly cosine: readonly number[];
  readonly cumulative: readonly number[];
  readonly diagrams: readonly DiagramView[];
}

interface CollisionTable {
  readonly label: string;
  readonly channels: readonly ChannelTable[];
}

const ANGULAR_POINTS = 121;
const DETECTOR_ACCEPTANCE_COSINE = 0.95;
const LIGHT_QUARK_THRESHOLD_IN_GEV = 2;
const OPEN_CHARM_THRESHOLD_IN_GEV = 3.73;
const OPEN_BOTTOM_THRESHOLD_IN_GEV = 10.56;
const ENERGY_KEY_DIGITS = 9;
const TABLE_CACHE_LIMIT = 64;
const tables = new Map<string, CollisionTable>();

const ELEMENTARY: readonly ParticleName[] = PARTICLE_NAMES.filter(
  (name) => particleSpec(name).constituents === null,
);

function hadronicThreshold(particle: ParticleName): number {
  const spec = particleSpec(particle);
  if (spec.family !== 'quark') {
    return 0;
  }
  const flavor = spec.pdgId > 0 ? particle : spec.antiparticleName;
  switch (flavor) {
    case 'charm':
      return OPEN_CHARM_THRESHOLD_IN_GEV;
    case 'bottom':
      return OPEN_BOTTOM_THRESHOLD_IN_GEV;
    case 'top':
      return 2 * spec.massInGev.value;
    default:
      return LIGHT_QUARK_THRESHOLD_IN_GEV;
  }
}

export function quantumNumbers(names: readonly ParticleName[]): string {
  const total = names.reduce<readonly number[]>(
    (totals, name) => {
      const spec = particleSpec(name);
      const values = [
        spec.electricChargeInElementaryUnits,
        spec.baryonNumber,
        spec.leptonNumbers.electron,
        spec.leptonNumbers.muon,
        spec.leptonNumbers.tau,
      ];
      return values.map((value, index) => (totals[index] ?? 0) + value);
    },
    [0, 0, 0, 0, 0],
  );
  return total.map((value) => Math.round(value * 3)).join(',');
}

export function canonicalPair(
  first: ParticleName,
  second: ParticleName,
): readonly [ParticleName, ParticleName] {
  const order = (name: ParticleName): number =>
    (particleSpec(name).pdgId > 0 ? 0 : 1000) + (PARTICLE_NAMES as readonly string[]).indexOf(name);
  return order(first) <= order(second) ? [first, second] : [second, first];
}

function sampleCosine(table: ChannelTable, random: RandomSource): number {
  const total = table.cumulative[table.cumulative.length - 1] ?? 0;
  const target = random.nextUnit() * total;
  let index = table.cumulative.findIndex((value) => value >= target);
  if (index <= 0) {
    index = 1;
  }
  const lower = table.cosine[index - 1] ?? -1;
  const upper = table.cosine[index] ?? 1;
  return lower + random.nextUnit() * (upper - lower);
}

const candidates = new Map<string, readonly string[]>();

export function candidateChannels(first: ParticleName, second: ParticleName): readonly string[] {
  const key = [first, second].sort().join('|');
  const cached = candidates.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const model = SHARED_PROCESS_CALCULATOR.model('fermiConstant');
  const incoming = quantumNumbers([first, second]);
  const channels = ELEMENTARY.flatMap((left, leftIndex) =>
    ELEMENTARY.slice(leftIndex).flatMap((right) => {
      const products = canonicalPair(left, right);
      if (quantumNumbers(products) !== incoming) {
        return [];
      }
      return SHARED_PROCESS_CALCULATOR.diagrams(model, [first, second], products).length > 0
        ? [products.join('+')]
        : [];
    }),
  );
  candidates.set(key, channels);
  return channels;
}

export class Collisions {
  constructor(
    private readonly particles: ParticleFactory,
    private readonly quantum: QuantumCore,
    private readonly random: RandomSource,
    private readonly mechanisms: readonly CollisionMechanism[] = [],
    private readonly processes: ProcessCalculator = SHARED_PROCESS_CALCULATOR,
  ) {}

  collide(
    first: Particle,
    second: Particle,
    selectedChannel?: string,
    options: { readonly minimumTransverseMomentumInGev?: number } = {},
  ): CollisionEvent {
    [first, second].forEach((particle) => {
      if (particle.status !== 'alive') {
        throw new LocalizedError(
          localizedText(
            `${particle.id} в состоянии ${particle.status} и не может столкнуться`,
            `${particle.id} is ${particle.status} and cannot collide`,
          ),
        );
      }
    });
    const total = sum(fourMomentumOf(first), fourMomentumOf(second));
    const energy = invariantMassInGev(total);
    if (first.spec.constituents !== null || second.spec.constituents !== null) {
      const mechanism = this.mechanisms.find((candidate) =>
        candidate.applies(first, second, energy),
      );
      if (mechanism === undefined) {
        throw new LocalizedError(
          localizedText(
            `Для пары ${first.spec.name} + ${second.spec.name} при √s = ${energy.toPrecision(5)} ГэВ нет механизма столкновения: элементарные частицы рассеиваются по лагранжиану, нуклоны при высокой энергии через партоны, легкие ядра при энергиях термоядерного синтеза, атомы и ионы при энергиях порядка их связи`,
            `The pair ${first.spec.name} + ${second.spec.name} at √s = ${energy.toPrecision(5)} GeV has no collision mechanism: elementary particles scatter by the Lagrangian, nucleons at high energy through partons, light nuclei at fusion energies, atoms and ions at energies of the order of their binding`,
          ),
        );
      }
      const event = mechanism.collide(first, second, {
        ...(selectedChannel === undefined ? {} : { channel: selectedChannel }),
        ...options,
      });
      this.retire([first, second]);
      return event;
    }
    const table = this.table(first.spec.name, second.spec.name, energy);
    if (table.channels.length === 0) {
      throw new LocalizedError(
        localizedText(
          `При √s = ${energy.toPrecision(4)} ГэВ у пары ${first.spec.name} + ${second.spec.name} нет открытых каналов; увеличьте энергию`,
          `At √s = ${energy.toPrecision(4)} GeV the pair ${first.spec.name} + ${second.spec.name} has no open channels; raise the energy`,
        ),
      );
    }
    const open =
      selectedChannel === undefined
        ? table.channels
        : table.channels.filter((channel) => channel.products.join('+') === selectedChannel);
    if (open.length === 0) {
      throw new LocalizedError(
        localizedText(
          `Канал ${selectedChannel ?? ''} закрыт при √s = ${energy.toPrecision(4)} ГэВ; открыты: ${table.channels.map((channel) => channel.products.join('+')).join(', ')}`,
          `Channel ${selectedChannel ?? ''} is closed at √s = ${energy.toPrecision(4)} GeV; open: ${table.channels.map((channel) => channel.products.join('+')).join(', ')}`,
        ),
      );
    }
    const chosen =
      open[
        sampleIndexByWeights(
          normalizeWeights(open.map((channel) => channel.fluxFreeWeight)),
          this.random,
        )
      ];
    if (chosen === undefined) {
      throw new Error('No channel chosen');
    }
    const boostToCenter = scaleVector(total.momentum, -1 / total.energy);
    const beam = lorentzBoost(fourMomentumOf(first), boostToCenter);
    const axis =
      vectorMagnitude(beam.momentum) > 0
        ? unit(beam.momentum)
        : sampleIsotropicDirection(this.random);
    const cosine = sampleCosine(chosen, this.random);
    const direction = directionAround(axis, cosine, 2 * Math.PI * this.random.nextUnit());
    const [leftName, rightName] = chosen.products;
    const leftMass = particleSpec(leftName).massInGev.value;
    const rightMass = particleSpec(rightName).massInGev.value;
    const momentum = twoBodyDecayMomentumInGev(energy, leftMass, rightMass);
    const backToLab = scaleVector(boostToCenter, -1);
    const centerMomenta: readonly FourMomentumInGev[] = [
      { energy: totalEnergyInGev(leftMass, momentum), momentum: scaleVector(direction, momentum) },
      {
        energy: totalEnergyInGev(rightMass, momentum),
        momentum: scaleVector(direction, -momentum),
      },
    ];
    const position = first.kinematics.positionInFemtometers;
    this.retire([first, second]);
    const crossSections: Record<string, number> = Object.fromEntries(
      table.channels.map((channel) => [
        channel.products.join('+'),
        channel.crossSectionInNanobarns,
      ]),
    );
    const products = [leftName, rightName].map((name, index) => {
      const fourMomentum = lorentzBoost(centerMomenta[index] as FourMomentumInGev, backToLab);
      return {
        name,
        fourMomentumInGev: fourMomentum,
        particle: this.particles.create(name, {
          momentumInGev: fourMomentum.momentum,
          positionInFemtometers: position,
        }),
      };
    });
    if (
      [first.spec.name, second.spec.name].sort().join('+') === 'electron+positron' &&
      products.every((product) => product.name === 'photon')
    ) {
      const [left, right] = products;
      if (left !== undefined && right !== undefined) {
        this.quantum.entangle([left.particle, right.particle], 'polarization', 'bellPsiMinus');
      }
    }
    return {
      process: table.label,
      centerOfMassEnergyInGev: energy,
      totalCrossSectionInNanobarns:
        selectedChannel === undefined
          ? table.channels.reduce(
              (accumulated, channel) => accumulated + channel.crossSectionInNanobarns,
              0,
            )
          : (crossSections[selectedChannel] ?? 0),
      channelCrossSectionsInNanobarns: crossSections,
      cosineInCenterOfMass: dotProduct(direction, axis),
      products,
      diagrams: chosen.diagrams,
    };
  }

  openChannels(first: ParticleName, second: ParticleName, energy: number): readonly string[] {
    return this.table(first, second, energy).channels.map((channel) => channel.products.join('+'));
  }

  private table(first: ParticleName, second: ParticleName, energy: number): CollisionTable {
    const key = `${first}|${second}|${energy.toPrecision(ENERGY_KEY_DIGITS)}`;
    const cached = tables.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const model = this.processes.model('runningAlpha', energy);
    const kinematics = new ProcessKinematics(model);
    const incoming = quantumNumbers([first, second]);
    const channels: ChannelTable[] = [];
    ELEMENTARY.forEach((left, leftIndex) =>
      ELEMENTARY.slice(leftIndex).forEach((right) => {
        const products = canonicalPair(left, right);
        const channel = this.channel(
          model,
          kinematics,
          [first, second],
          products,
          energy,
          incoming,
        );
        if (channel !== null) {
          channels.push(channel);
        }
      }),
    );
    const symbol = (name: ParticleName): string => particleSpec(name).symbol;
    const table = { label: `${symbol(first)} ${symbol(second)} → X`, channels };
    if (tables.size >= TABLE_CACHE_LIMIT) {
      const oldest = tables.keys().next().value;
      if (oldest !== undefined) {
        tables.delete(oldest);
      }
    }
    tables.set(key, table);
    return table;
  }

  private channel(
    model: FeynmanModel,
    kinematics: ProcessKinematics,
    initial: readonly [ParticleName, ParticleName],
    products: readonly [ParticleName, ParticleName],
    energy: number,
    incoming: string,
  ): ChannelTable | null {
    if (quantumNumbers(products) !== incoming) {
      return null;
    }
    const threshold = Math.max(
      model.massOf(products[0]) + model.massOf(products[1]),
      hadronicThreshold(products[0]),
      hadronicThreshold(products[1]),
    );
    if (energy <= threshold) {
      return null;
    }
    const diagrams = this.processes.diagrams(model, initial, products);
    if (diagrams.length === 0) {
      return null;
    }
    const masslessExchange = kinematics.forwardSingular(initial, products, energy, diagrams);
    const cut = masslessExchange ? DETECTOR_ACCEPTANCE_COSINE : 1;
    const result = kinematics.crossSection(
      initial,
      products,
      energy,
      cut,
      ANGULAR_POINTS,
      'rapidity',
    );
    if (!(result.fluxFreeWeight > 0)) {
      return null;
    }
    const cumulative: number[] = [0];
    result.fluxFreeDifferential.slice(1).forEach((value, index) => {
      const previous = result.fluxFreeDifferential[index] ?? 0;
      const width = (result.cosine[index + 1] ?? 0) - (result.cosine[index] ?? 0);
      cumulative.push((cumulative[index] ?? 0) + ((previous + value) / 2) * width);
    });
    return {
      products,
      fluxFreeWeight: result.fluxFreeWeight,
      crossSectionInNanobarns: result.crossSectionInNanobarns,
      cosine: result.cosine,
      cumulative,
      diagrams,
    };
  }

  private retire(incoming: readonly Particle[]): void {
    const incomingIds = new Set(incoming.map((particle) => particle.id));
    const registerIds = new Set(
      incoming.flatMap((particle) =>
        [...particle.quantumSlots.values()].map((slot) => slot.registerId),
      ),
    );
    registerIds.forEach((registerId) => {
      const register = this.quantum.registers.byId(registerId);
      if (register.slots.some((slot) => !incomingIds.has(slot.particleId))) {
        throw new LocalizedError(
          localizedText(
            'одна из сталкивающихся частиц запутана с третьей; такое столкновение пока не поддерживается',
            'one of the colliding particles is entangled with a third particle; colliding it is not supported yet',
          ),
        );
      }
    });
    registerIds.forEach((registerId) =>
      this.quantum.registers.dispose(this.quantum.registers.byId(registerId)),
    );
    incoming.forEach((particle) => particle.markCollided());
  }
}
