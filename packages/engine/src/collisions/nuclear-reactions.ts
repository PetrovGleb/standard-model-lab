/* Nuclear reactions of nucleons and light nuclei at fusion energies: charged-particle fusion from the Bosch–Hale and Solar Fusion II S-factors with the Gamow factor computed from CODATA, neutron capture by the 1/v law from NIST thermal cross sections, Coulomb (Rutherford, in the detector acceptance) and neutron elastic scattering; collisions pick a channel by cross section, every nuclear component of a hot medium reacts at its Maxwell-averaged rate n⟨σv⟩. */
import {
  BOLTZMANN_CONSTANT_IN_EV_PER_KELVIN,
  FINE_STRUCTURE_CONSTANT,
  NUCLEAR_DATA,
  SPEED_OF_LIGHT_IN_VACUUM,
  particleSpec,
} from '@standard-model/constants';
import type {
  FourMomentumInGev,
  MediumAspect,
  Particle,
  ParticleName,
  RandomSource,
  Vector3,
} from '@standard-model/contracts';
import {
  sampleExponentialTime,
  addVectors,
  boostFromRest,
  boostToRest,
  dotProduct,
  invariantMassInGev,
  sampleIndexByWeights,
  sampleIsotropicDirection,
  scaleVector,
  subtractVectors,
  totalEnergyInGev,
  twoBodyDecayMomentumInGev,
  vectorMagnitude,
} from '@standard-model/utils';
import type { ParticleFactory } from '../particles/particle-factory.js';
import { threeBodyRestFrame, twoBodyRestFrame } from '../decay/phase-space.js';
import type { CollisionEvent, CollisionMechanism, CollisionRequest } from './collisions.js';
import { NANOBARN_PER_INVERSE_GEV_SQUARED } from './cross-sections.js';
import { LocalizedError, localizedText } from '@standard-model/contracts';
import { reaclibLabel, reaclibMediumChannels } from './reaclib-rates.js';

const KEV_PER_GEV = 1e6;
const EV_PER_KEV = 1e3;
const MEV_PER_KEV = 1e-3;
const KEV_PER_MEV = 1e3;
const BARN_PER_MILLIBARN = 1e-3;
const NANOBARN_PER_BARN = 1e9;
const SQUARE_METERS_PER_BARN = 1e-28;
const DETECTOR_ACCEPTANCE_COSINE = 0.95;
const NUCLEAR_ENERGY_LIMIT_IN_KEV = 10_000;
const HALF = 0.5;
const REACTIVITY_POINTS = 600;
const REACTIVITY_LOWER_FRACTION = 1e-4;
const REACTIVITY_UPPER_FRACTION = 200;
const REACTIVITY_CACHE_DIGITS = 6;

const NUCLEON_NAMES: ReadonlySet<ParticleName> = new Set(['proton', 'neutron']);

export function isNuclearSpecies(name: ParticleName): boolean {
  return NUCLEON_NAMES.has(name) || particleSpec(name).family === 'nucleus';
}

export interface ReactionChannel {
  readonly reactants: readonly [ParticleName, ParticleName];
  readonly products: readonly ParticleName[];
  readonly label: string;
  readonly crossSectionInBarn: (energyInKev: number) => number;
}

interface ChargedReactionEntry {
  readonly reactants: readonly string[];
  readonly products: readonly string[];
  readonly model: string;
  readonly numerator?: readonly number[];
  readonly denominator?: readonly number[];
  readonly coefficients?: readonly number[];
  readonly atZeroInMevBarn?: number;
  readonly relativeSlopePerMev?: number;
  readonly firstDerivativeInBarn?: number;
  readonly secondDerivativeInBarnPerMev?: number;
  readonly validityInKev: readonly number[];
  readonly note: string;
}

function massInGev(name: ParticleName): number {
  return particleSpec(name).massInGev.value;
}

function charge(name: ParticleName): number {
  return particleSpec(name).electricChargeInElementaryUnits;
}

function reducedMassInKev(first: ParticleName, second: ParticleName): number {
  const product = massInGev(first) * massInGev(second);
  return (product / (massInGev(first) + massInGev(second))) * KEV_PER_GEV;
}

export function gamowConstantInSqrtKev(first: ParticleName, second: ParticleName): number {
  return (
    Math.PI *
    FINE_STRUCTURE_CONSTANT.value *
    charge(first) *
    charge(second) *
    Math.sqrt(2 * reducedMassInKev(first, second))
  );
}

function polynomial(coefficients: readonly number[], variable: number): number {
  return coefficients.reduceRight((sum, coefficient) => sum * variable + coefficient, 0);
}

function sFactorInBarnKev(entry: ChargedReactionEntry, energyInKev: number): number {
  const energyInMev = energyInKev * MEV_PER_KEV;
  switch (entry.model) {
    case 'boschHale': {
      const numerator = polynomial(entry.numerator ?? [], energyInKev);
      const denominator = 1 + energyInKev * polynomial(entry.denominator ?? [], energyInKev);
      return (numerator / denominator) * BARN_PER_MILLIBARN;
    }
    case 'sFactorLinear':
      return (
        (entry.atZeroInMevBarn ?? 0) *
        (1 + (entry.relativeSlopePerMev ?? 0) * energyInMev) *
        KEV_PER_MEV
      );
    case 'sFactorPowerSeriesInEvBarn':
      return polynomial(entry.coefficients ?? [], energyInMev) / EV_PER_KEV;
    case 'sFactorTaylor':
      return (
        ((entry.atZeroInMevBarn ?? 0) +
          (entry.firstDerivativeInBarn ?? 0) * energyInMev +
          HALF * (entry.secondDerivativeInBarnPerMev ?? 0) * energyInMev * energyInMev) *
        KEV_PER_MEV
      );
    default:
      throw new Error(`Unknown S-factor model ${entry.model}`);
  }
}

function chargedChannel(entry: ChargedReactionEntry): ReactionChannel {
  const [first, second] = entry.reactants as [ParticleName, ParticleName];
  const gamow = gamowConstantInSqrtKev(first, second);
  const [lowest, highest] = entry.validityInKev as [number, number];
  return {
    reactants: [first, second],
    products: entry.products as readonly ParticleName[],
    label: entry.note,
    crossSectionInBarn: (energyInKev) =>
      energyInKev < lowest || energyInKev > highest
        ? 0
        : Math.max(
            (sFactorInBarnKev(entry, energyInKev) / energyInKev) *
              Math.exp(-gamow / Math.sqrt(energyInKev)),
            0,
          ),
  };
}

function thermalNeutronEnergyInKev(target: ParticleName): number {
  const speedFraction =
    NUCLEAR_DATA.thermalNeutronSpeedInMetersPerSecond / SPEED_OF_LIGHT_IN_VACUUM.value;
  return HALF * reducedMassInKev('neutron', target) * speedFraction * speedFraction;
}

const NEUTRON_CAPTURE_LIMIT_IN_KEV = 10;

function captureChannel(entry: (typeof NUCLEAR_DATA.neutronCaptures)[number]): ReactionChannel {
  const target = entry.target as ParticleName;
  const thermal = thermalNeutronEnergyInKev(target);
  return {
    reactants: ['neutron', target],
    products: entry.products as readonly ParticleName[],
    label: `${target}(n, ${entry.products.slice(1).join(' ')}) 1/v`,
    crossSectionInBarn: (energyInKev) =>
      energyInKev > NEUTRON_CAPTURE_LIMIT_IN_KEV
        ? 0
        : entry.thermalCrossSectionInBarn.value *
          Math.sqrt(thermal / Math.max(energyInKev, Number.MIN_VALUE)),
  };
}

const CHANNELS: readonly ReactionChannel[] = [
  ...(NUCLEAR_DATA.chargedReactions as readonly ChargedReactionEntry[]).map(chargedChannel),
  ...NUCLEAR_DATA.neutronCaptures.map(captureChannel),
];

function pairKey(first: ParticleName, second: ParticleName): string {
  return [first, second].sort().join('+');
}

export function reactionChannels(
  first: ParticleName,
  second: ParticleName,
): readonly ReactionChannel[] {
  const key = pairKey(first, second);
  return CHANNELS.filter((channel) => pairKey(channel.reactants[0], channel.reactants[1]) === key);
}

function elasticCrossSectionInBarn(
  first: ParticleName,
  second: ParticleName,
  energyInKev: number,
): number {
  if (charge(first) !== 0 && charge(second) !== 0) {
    const energyInGev = energyInKev / KEV_PER_GEV;
    const amplitude =
      (charge(first) * charge(second) * FINE_STRUCTURE_CONSTANT.value) / (4 * energyInGev);
    const solidAngle = 8 * Math.PI * (1 / (1 - DETECTOR_ACCEPTANCE_COSINE) - HALF);
    return (
      (amplitude * amplitude * solidAngle * NANOBARN_PER_INVERSE_GEV_SQUARED) / NANOBARN_PER_BARN
    );
  }
  const target = first === 'neutron' ? second : first;
  const bound = (
    NUCLEAR_DATA.boundScatteringCrossSectionsInBarn as Readonly<Record<string, number>>
  )[target];
  if (bound === undefined) {
    return 0;
  }
  const massNumber = particleSpec(target).baryonNumber;
  return bound * (massNumber / (massNumber + 1)) ** 2;
}

function sampleElasticCosine(coulomb: boolean, random: RandomSource): number {
  if (!coulomb) {
    return 2 * random.nextUnit() - 1;
  }
  const upper = 1 / (1 - DETECTOR_ACCEPTANCE_COSINE);
  const inverse = HALF + random.nextUnit() * (upper - HALF);
  return 1 - 1 / inverse;
}

function rotateAround(axis: Vector3, cosine: number, random: RandomSource): Vector3 {
  const helper: Vector3 = Math.abs(axis.x) < HALF ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
  const projected = subtractVectors(helper, scaleVector(axis, dotProduct(helper, axis)));
  const first = scaleVector(projected, 1 / vectorMagnitude(projected));
  const second: Vector3 = {
    x: axis.y * first.z - axis.z * first.y,
    y: axis.z * first.x - axis.x * first.z,
    z: axis.x * first.y - axis.y * first.x,
  };
  const sine = Math.sqrt(Math.max(0, 1 - cosine * cosine));
  const azimuth = 2 * Math.PI * random.nextUnit();
  return addVectors(
    scaleVector(axis, cosine),
    addVectors(
      scaleVector(first, sine * Math.cos(azimuth)),
      scaleVector(second, sine * Math.sin(azimuth)),
    ),
  );
}

export function kineticEnergyInKev(
  first: FourMomentumInGev,
  second: FourMomentumInGev,
  firstMass: number,
  secondMass: number,
): number {
  const total = {
    energy: first.energy + second.energy,
    momentum: addVectors(first.momentum, second.momentum),
  };
  return (invariantMassInGev(total) - firstMass - secondMass) * KEV_PER_GEV;
}

const reactivities = new Map<string, number>();

export function reactivityInCubicMetersPerSecond(
  channel: ReactionChannel,
  temperatureInKelvin: number,
): number {
  const key = `${channel.label}|${temperatureInKelvin.toPrecision(REACTIVITY_CACHE_DIGITS)}`;
  const cached = reactivities.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const thermalInKev =
    (BOLTZMANN_CONSTANT_IN_EV_PER_KELVIN.value * temperatureInKelvin) / EV_PER_KEV;
  const reducedMass = reducedMassInKev(channel.reactants[0], channel.reactants[1]);
  const lower = Math.log(thermalInKev * REACTIVITY_LOWER_FRACTION);
  const upper = Math.log(thermalInKev * REACTIVITY_UPPER_FRACTION);
  const step = (upper - lower) / REACTIVITY_POINTS;
  let integral = 0;
  for (let index = 0; index < REACTIVITY_POINTS; index += 1) {
    const energy = Math.exp(lower + (index + HALF) * step);
    const speedFraction = Math.sqrt((2 * energy) / reducedMass);
    const maxwell =
      2 * Math.sqrt(energy / Math.PI) * thermalInKev ** -1.5 * Math.exp(-energy / thermalInKev);
    integral += channel.crossSectionInBarn(energy) * speedFraction * maxwell * energy * step;
  }
  const value = integral * SQUARE_METERS_PER_BARN * SPEED_OF_LIGHT_IN_VACUUM.value;
  reactivities.set(key, value);
  return value;
}

function sampleThermalEnergyInKev(
  channel: ReactionChannel,
  temperatureInKelvin: number,
  random: RandomSource,
): number {
  const thermalInKev =
    (BOLTZMANN_CONSTANT_IN_EV_PER_KELVIN.value * temperatureInKelvin) / EV_PER_KEV;
  const lower = Math.log(thermalInKev * REACTIVITY_LOWER_FRACTION);
  const upper = Math.log(thermalInKev * REACTIVITY_UPPER_FRACTION);
  const step = (upper - lower) / REACTIVITY_POINTS;
  const energies = Array.from({ length: REACTIVITY_POINTS }, (ignored, index) =>
    Math.exp(lower + (index + HALF) * step),
  );
  const weights = energies.map(
    (energy) =>
      channel.crossSectionInBarn(energy) * energy * energy * Math.exp(-energy / thermalInKev),
  );
  const chosen = sampleIndexByWeights(weights, random);
  return (energies[chosen] ?? thermalInKev) * Math.exp((random.nextUnit() - HALF) * step);
}

export interface NuclearProduct {
  readonly name: ParticleName;
  readonly particle: Particle;
  readonly fourMomentumInGev: FourMomentumInGev;
}

export class NuclearReactions implements CollisionMechanism {
  constructor(
    private readonly particles: ParticleFactory,
    private readonly random: RandomSource,
  ) {}

  applies(first: Particle, second: Particle, energyInGev: number): boolean {
    const names = [first.spec.name, second.spec.name];
    const kinetic =
      (energyInGev - massInGev(first.spec.name) - massInGev(second.spec.name)) * KEV_PER_GEV;
    return names.every(isNuclearSpecies) && kinetic <= NUCLEAR_ENERGY_LIMIT_IN_KEV;
  }

  collide(first: Particle, second: Particle, request: CollisionRequest): CollisionEvent {
    const firstMomentum = first.kinematics.fourMomentumInGev;
    const secondMomentum = second.kinematics.fourMomentumInGev;
    const total = {
      energy: firstMomentum.energy + secondMomentum.energy,
      momentum: addVectors(firstMomentum.momentum, secondMomentum.momentum),
    };
    const energy = invariantMassInGev(total);
    const kinetic =
      (energy - massInGev(first.spec.name) - massInGev(second.spec.name)) * KEV_PER_GEV;
    const coulomb = charge(first.spec.name) !== 0 && charge(second.spec.name) !== 0;
    const reactions = reactionChannels(first.spec.name, second.spec.name).filter((channel) => {
      const productMass = channel.products.reduce((sum, name) => sum + massInGev(name), 0);
      return productMass < energy && channel.crossSectionInBarn(kinetic) > 0;
    });
    const elastic = elasticCrossSectionInBarn(first.spec.name, second.spec.name, kinetic);
    const options = [
      ...reactions.map((channel) => ({
        products: channel.products,
        barn: channel.crossSectionInBarn(kinetic),
        elastic: false,
      })),
      ...(elastic > 0
        ? [
            {
              products: [first.spec.name, second.spec.name] as readonly ParticleName[],
              barn: elastic,
              elastic: true,
            },
          ]
        : []),
    ].filter(
      (option) => request.channel === undefined || option.products.join('+') === request.channel,
    );
    if (options.length === 0) {
      throw new LocalizedError(
        localizedText(
          `${first.spec.name} + ${second.spec.name} при кинетической энергии ${kinetic.toPrecision(4)} кэВ в системе центра масс: ${request.channel === undefined ? 'нет ядерных каналов в области данных' : `канал ${request.channel} закрыт`}`,
          `${first.spec.name} + ${second.spec.name} at a center-of-mass kinetic energy of ${kinetic.toPrecision(4)} keV: ${request.channel === undefined ? 'no nuclear channels within the data range' : `channel ${request.channel} is closed`}`,
        ),
      );
    }
    const chosen =
      options[
        sampleIndexByWeights(
          options.map((option) => option.barn),
          this.random,
        )
      ];
    if (chosen === undefined) {
      throw new Error('No nuclear channel chosen');
    }
    const firstAtRest = boostToRest(firstMomentum, total, energy);
    const axis =
      vectorMagnitude(firstAtRest.momentum) > 0
        ? scaleVector(firstAtRest.momentum, 1 / vectorMagnitude(firstAtRest.momentum))
        : sampleIsotropicDirection(this.random);
    const masses = chosen.products.map(massInGev);
    let restFrame: readonly FourMomentumInGev[];
    let cosine: number;
    if (chosen.elastic) {
      cosine = sampleElasticCosine(coulomb, this.random);
      const direction = rotateAround(axis, cosine, this.random);
      const momentum = twoBodyDecayMomentumInGev(energy, masses[0] ?? 0, masses[1] ?? 0);
      restFrame = [
        {
          energy: totalEnergyInGev(masses[0] ?? 0, momentum),
          momentum: scaleVector(direction, momentum),
        },
        {
          energy: totalEnergyInGev(masses[1] ?? 0, momentum),
          momentum: scaleVector(direction, -momentum),
        },
      ];
    } else {
      restFrame =
        masses.length === 2
          ? twoBodyRestFrame(energy, [masses[0] ?? 0, masses[1] ?? 0], this.random)
          : threeBodyRestFrame(
              energy,
              [masses[0] ?? 0, masses[1] ?? 0, masses[2] ?? 0],
              this.random,
            );
      const firstProduct = restFrame[0]?.momentum ?? axis;
      cosine =
        dotProduct(firstProduct, axis) / Math.max(vectorMagnitude(firstProduct), Number.MIN_VALUE);
    }
    const position = first.kinematics.positionInFemtometers;
    const products = chosen.products.map((name, index) => {
      const fourMomentum = boostFromRest(restFrame[index] as FourMomentumInGev, total, energy);
      return {
        name,
        fourMomentumInGev: fourMomentum,
        particle: this.particles.create(name, {
          momentumInGev: fourMomentum.momentum,
          positionInFemtometers: position,
        }),
      };
    });
    const releasedInMev =
      (massInGev(first.spec.name) +
        massInGev(second.spec.name) -
        masses.reduce((sum, mass) => sum + mass, 0)) *
      KEV_PER_GEV *
      MEV_PER_KEV;
    const symbol = (name: ParticleName): string => particleSpec(name).symbol;
    const crossSections = Object.fromEntries(
      options.map((option) => [option.products.join('+'), option.barn * NANOBARN_PER_BARN]),
    );
    return {
      process: `${symbol(first.spec.name)} ${symbol(second.spec.name)} → ${chosen.products.map(symbol).join(' ')}${chosen.elastic ? '' : `, Q = ${releasedInMev.toPrecision(4)} МэВ`}`,
      centerOfMassEnergyInGev: energy,
      totalCrossSectionInNanobarns:
        options.reduce((sum, option) => sum + option.barn, 0) * NANOBARN_PER_BARN,
      channelCrossSectionsInNanobarns: crossSections,
      cosineInCenterOfMass: cosine,
      products,
      diagrams: [],
    };
  }
}

export interface MediumFusionChannel {
  readonly nucleus: ParticleName;
  readonly partner: ParticleName;
  readonly partners: readonly ParticleName[];
  readonly channel: ReactionChannel;
  readonly ratePerSecond: number;
}

function thermalShapeChannel(
  nucleus: ParticleName,
  partners: readonly ParticleName[],
  products: readonly ParticleName[],
  label: string,
): ReactionChannel {
  const [first = 'neutron'] = partners;
  const gamow = gamowConstantInSqrtKev(nucleus, first);
  return {
    reactants: [nucleus, first],
    products,
    label,
    crossSectionInBarn: (energyInKev) =>
      gamow > 0
        ? Math.exp(-gamow / Math.sqrt(energyInKev)) / energyInKev
        : 1 / Math.sqrt(energyInKev),
  };
}

function reactantKey(names: readonly ParticleName[]): string {
  return [...names].sort().join('+');
}

export function mediumFusionChannels(
  nucleus: ParticleName,
  medium: MediumAspect,
): readonly MediumFusionChannel[] {
  if (!isNuclearSpecies(nucleus)) {
    return [];
  }
  const nuclear = medium.components.filter((component) => isNuclearSpecies(component.species));
  const fromLibrary = reaclibMediumChannels(
    nucleus,
    medium.components,
    medium.temperatureInKelvin,
  ).map((entry) => ({
    nucleus,
    partner: entry.partners[0] ?? nucleus,
    partners: entry.partners,
    channel: thermalShapeChannel(
      nucleus,
      entry.partners,
      entry.products,
      reaclibLabel(entry.reaction),
    ),
    ratePerSecond: entry.ratePerSecond,
  }));
  const covered = new Set(fromLibrary.map((fusion) => reactantKey([nucleus, ...fusion.partners])));
  const fromTables = nuclear
    .filter((component) => !covered.has(reactantKey([nucleus, component.species])))
    .flatMap((component) =>
      reactionChannels(nucleus, component.species).map((channel) => ({
        nucleus,
        partner: component.species,
        partners: [component.species],
        channel,
        ratePerSecond:
          component.numberDensityPerCubicMeter *
          reactivityInCubicMetersPerSecond(channel, medium.temperatureInKelvin),
      })),
    );
  return [...fromLibrary, ...fromTables].filter((fusion) => fusion.ratePerSecond > 0);
}

function restFrameMomenta(
  parentMassInGev: number,
  masses: readonly number[],
  random: RandomSource,
): readonly FourMomentumInGev[] {
  if (masses.length === 2) {
    return twoBodyRestFrame(parentMassInGev, [masses[0] ?? 0, masses[1] ?? 0], random);
  }
  if (masses.length === 3) {
    return threeBodyRestFrame(
      parentMassInGev,
      [masses[0] ?? 0, masses[1] ?? 0, masses[2] ?? 0],
      random,
    );
  }
  const [head, ...rest] = masses;
  const restSum = rest.reduce((sum, mass) => sum + mass, 0);
  const clusterMass = restSum + HALF * Math.max(0, parentMassInGev - (head ?? 0) - restSum);
  const [first, cluster] = twoBodyRestFrame(parentMassInGev, [head ?? 0, clusterMass], random);
  const clusterMomenta = restFrameMomenta(clusterMass, rest, random);
  return [
    first as FourMomentumInGev,
    ...clusterMomenta.map((momentum) =>
      boostFromRest(momentum, cluster as FourMomentumInGev, clusterMass),
    ),
  ];
}

function thermalExcessInGev(temperatureInKelvin: number, random: RandomSource): number {
  const thermalInKev =
    (BOLTZMANN_CONSTANT_IN_EV_PER_KELVIN.value * Math.max(temperatureInKelvin, 0)) / EV_PER_KEV;
  return (sampleExponentialTime(1, random) * thermalInKev) / KEV_PER_GEV;
}

function availableEnergyInGev(
  reactantsInGev: number,
  productMassesInGev: readonly number[],
  temperatureInKelvin: number,
  random: RandomSource,
): number {
  const threshold = productMassesInGev.reduce((sum, mass) => sum + mass, 0);
  return reactantsInGev >= threshold
    ? reactantsInGev
    : threshold + thermalExcessInGev(temperatureInKelvin, random);
}

export function decayProductsOf(
  parent: Particle,
  decaying: ParticleName,
  products: readonly ParticleName[],
  particles: ParticleFactory,
  random: RandomSource,
  temperatureInKelvin = 0,
): readonly Particle[] {
  const parentMass = availableEnergyInGev(
    massInGev(decaying),
    products.map(massInGev),
    temperatureInKelvin,
    random,
  );
  const rest = restFrameMomenta(parentMass, products.map(massInGev), random);
  const parentMomentum = parent.kinematics.fourMomentumInGev;
  const frame: FourMomentumInGev = {
    energy: parentMass * (parentMomentum.energy / massInGev(parent.spec.name)),
    momentum: scaleVector(parentMomentum.momentum, parentMass / massInGev(parent.spec.name)),
  };
  return products.map((name, index) =>
    particles.create(name, {
      momentumInGev: boostFromRest(rest[index] as FourMomentumInGev, frame, parentMass).momentum,
      positionInFemtometers: parent.kinematics.positionInFemtometers,
    }),
  );
}

export class ThermalNuclearReactions {
  constructor(
    private readonly particles: ParticleFactory,
    private readonly random: RandomSource,
  ) {}

  fuse(
    particle: Particle,
    fusion: MediumFusionChannel,
    temperatureInKelvin: number,
  ): readonly NuclearProduct[] {
    const relative = sampleThermalEnergyInKev(fusion.channel, temperatureInKelvin, this.random);
    const productMasses = fusion.channel.products.map(massInGev);
    const energy = availableEnergyInGev(
      massInGev(fusion.nucleus) +
        fusion.partners.reduce((sum, partner) => sum + massInGev(partner), 0) +
        relative / KEV_PER_GEV,
      productMasses,
      temperatureInKelvin,
      this.random,
    );
    const restFrame = restFrameMomenta(energy, productMasses, this.random);
    const parentMomentum = particle.kinematics.fourMomentumInGev;
    const parentMass = massInGev(particle.spec.name);
    const frame: FourMomentumInGev = {
      energy: energy * (parentMomentum.energy / parentMass),
      momentum: scaleVector(parentMomentum.momentum, energy / parentMass),
    };
    return fusion.channel.products.map((name, index) => {
      const fourMomentum = boostFromRest(restFrame[index] as FourMomentumInGev, frame, energy);
      return {
        name,
        fourMomentumInGev: fourMomentum,
        particle: this.particles.create(name, {
          momentumInGev: fourMomentum.momentum,
          positionInFemtometers: particle.kinematics.positionInFemtometers,
        }),
      };
    });
  }
}
