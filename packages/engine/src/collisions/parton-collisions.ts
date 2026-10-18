/* Collisions of particles with parton structure (nucleons, antinucleons) with each other or with elementary particles: the hard 2→2 process between partons uses tree amplitudes of the Lagrangian weighted by NNPDF luminosities above a transverse-momentum threshold; QCD channels come from nine flavour-blind tables scaled with ŝ and alpha_s(μ)², triggered channels from tables on an ŝ grid; the struck hadron leaves a remnant (diquark, quark and diquark, or the hadron with a companion) that shares the rest of its momentum. */
import { STRING_FRAGMENTATION, particleSpec } from '@standard-model/constants';
import type {
  FourMomentumInGev,
  Particle,
  ParticleName,
  RandomSource,
  Vector3,
} from '@standard-model/contracts';
import {
  addVectors,
  boostFromRest,
  boostToRest,
  dotProduct,
  invariantMassInGev,
  sampleGaussian,
  sampleIndexByWeights,
  scaleVector,
  subtractVectors,
  vectorMagnitude,
} from '@standard-model/utils';
import { ProcessKinematics } from '../feynman/observables.js';
import {
  candidateChannels,
  type CollisionEvent,
  type CollisionMechanism,
  type CollisionRequest,
} from './collisions.js';
import { SHARED_PROCESS_CALCULATOR } from '../feynman/process-calculator.js';
import type { Hadronization } from '../particles/hadronization.js';
import type { ParticleFactory } from '../particles/particle-factory.js';
import { diquarkOf } from '../particles/string-fragmentation.js';
import {
  PARTON_FLAVORS,
  partonMomentumDensity,
  partonStructureOf,
  strongCouplingOfPdf,
  valenceShare,
  type PartonStructure,
} from './parton-distributions.js';
import { LocalizedError, localizedText } from '@standard-model/contracts';

interface PartonCollisionRequest {
  readonly channel?: string;
  readonly minimumTransverseMomentumInGev: number;
}

export const DEFAULT_MINIMUM_TRANSVERSE_MOMENTUM_IN_GEV = 20;

interface Side {
  readonly structure: PartonStructure | null;
  readonly partons: readonly ParticleName[];
}

interface AngularShape {
  readonly cosine: readonly number[];
  readonly differentialInNanobarns: readonly number[];
  readonly referenceEnergySquared: number;
  readonly strongPower: number;
  readonly referenceCoupling: number;
}

interface ProcessEntry {
  readonly first: ParticleName;
  readonly second: ParticleName;
  readonly final: readonly [ParticleName, ParticleName];
  readonly shapes: readonly AngularShape[];
  readonly logTauNodes: readonly number[];
  readonly weights: readonly number[];
  readonly total: number;
}

interface LuminosityTable {
  readonly entries: readonly ProcessEntry[];
  readonly totalInNanobarns: number;
  readonly byChannel: Readonly<Record<string, number>>;
}

const REFERENCE_ENERGY_IN_GEV = 500;
const ANGULAR_POINTS = 81;
const QCD_RAPIDITY_LIMIT = 8;
const MASSIVE_ANGULAR_POINTS = 21;
const TAU_NODES = 28;
const MASSIVE_TAU_NODES = 16;
const RAPIDITY_NODES = 24;
const TABLE_CACHE_LIMIT = 16;
const ENERGY_KEY_DIGITS = 6;
const SCALE_FRACTION = 0.5;
const COLORED_EXTERNALS_WITHOUT_STRONG_COUPLING = 2;
const MAXIMUM_STRONG_POWER = 2;
const MAXIMUM_VALENCE_TRIES = 1000;
const THRESHOLD_MARGIN = 1 + 1e-6;
const LIGHT_QUARKS: readonly ParticleName[] = ['down', 'up', 'strange', 'charm', 'bottom'];
const REMNANT = STRING_FRAGMENTATION.beamRemnants;
const VALENCE_POWERS: Readonly<Partial<Record<ParticleName, number>>> = {
  up: REMNANT.valencePowerUpInProton,
  down: REMNANT.valencePowerDownInProton,
  antiUp: REMNANT.valencePowerUpInProton,
  antiDown: REMNANT.valencePowerDownInProton,
};

function anti(name: ParticleName): ParticleName {
  return particleSpec(name).antiparticleName;
}

function isQuark(name: ParticleName): boolean {
  return particleSpec(name).family === 'quark' && name !== 'top' && name !== 'antiTop';
}

function isQcdParton(name: ParticleName): boolean {
  return name === 'gluon' || isQuark(name);
}

function isColored(name: ParticleName): boolean {
  return particleSpec(name).colorRepresentation !== 'singlet';
}

function canonical(first: ParticleName, second: ParticleName): string {
  return [first, second].sort().join('+');
}

function strongPowerOf(names: readonly ParticleName[]): number {
  return Math.min(
    MAXIMUM_STRONG_POWER,
    Math.max(0, names.filter(isColored).length - COLORED_EXTERNALS_WITHOUT_STRONG_COUPLING),
  );
}

interface QcdClass {
  readonly initial: readonly [ParticleName, ParticleName];
  readonly final: readonly [ParticleName, ParticleName];
}

function qcdFinalStates(
  first: ParticleName,
  second: ParticleName,
): readonly {
  readonly final: readonly [ParticleName, ParticleName];
  readonly representative: QcdClass;
}[] {
  const isGluon = (name: ParticleName): boolean => name === 'gluon';
  if (isGluon(first) && isGluon(second)) {
    return [
      {
        final: ['gluon', 'gluon'],
        representative: { initial: ['gluon', 'gluon'], final: ['gluon', 'gluon'] },
      },
      ...LIGHT_QUARKS.map((quark) => ({
        final: [quark, anti(quark)] as const,
        representative: { initial: ['gluon', 'gluon'], final: ['up', 'antiUp'] } as QcdClass,
      })),
    ];
  }
  if (isGluon(first) || isGluon(second)) {
    const quark = isGluon(first) ? second : first;
    const representative: QcdClass = isGluon(first)
      ? { initial: ['gluon', 'up'], final: ['gluon', 'up'] }
      : { initial: ['up', 'gluon'], final: ['up', 'gluon'] };
    return [{ final: isGluon(first) ? ['gluon', quark] : [quark, 'gluon'], representative }];
  }
  if (first === anti(second)) {
    const quarkFirst = particleSpec(first).pdgId > 0;
    const pair = (quark: ParticleName): readonly [ParticleName, ParticleName] =>
      quarkFirst ? [quark, anti(quark)] : [anti(quark), quark];
    const sameInitial: readonly [ParticleName, ParticleName] = quarkFirst
      ? ['up', 'antiUp']
      : ['antiUp', 'up'];
    return [
      {
        final: ['gluon', 'gluon'],
        representative: { initial: sameInitial, final: ['gluon', 'gluon'] },
      },
      ...LIGHT_QUARKS.map((quark) => {
        const same = quark === (quarkFirst ? first : second);
        return {
          final: pair(quark),
          representative: {
            initial: sameInitial,
            final: same
              ? quarkFirst
                ? ['up', 'antiUp']
                : ['antiUp', 'up']
              : quarkFirst
                ? ['down', 'antiDown']
                : ['antiDown', 'down'],
          } as QcdClass,
        };
      }),
    ];
  }
  const bothQuarks = particleSpec(first).pdgId > 0 && particleSpec(second).pdgId > 0;
  const bothAnti = particleSpec(first).pdgId < 0 && particleSpec(second).pdgId < 0;
  if (bothQuarks || bothAnti) {
    const conjugate = (
      names: readonly [ParticleName, ParticleName],
    ): readonly [ParticleName, ParticleName] =>
      bothAnti ? [anti(names[0]), anti(names[1])] : names;
    const representative = first === second ? conjugate(['up', 'up']) : conjugate(['up', 'down']);
    return [
      {
        final: [first, second],
        representative: { initial: representative, final: representative },
      },
    ];
  }
  const representative: readonly [ParticleName, ParticleName] =
    particleSpec(first).pdgId > 0 ? ['up', 'antiDown'] : ['antiDown', 'up'];
  return [
    { final: [first, second], representative: { initial: representative, final: representative } },
  ];
}

const qcdShapes = new Map<string, AngularShape>();
const massiveShapes = new Map<
  string,
  readonly {
    readonly final: readonly [ParticleName, ParticleName];
    readonly shapes: readonly AngularShape[];
    readonly thresholdSquared: number;
  }[]
>();

function qcdShape(representative: QcdClass): AngularShape {
  const key = `${representative.initial.join('+')}>${representative.final.join('+')}`;
  const cached = qcdShapes.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const model = SHARED_PROCESS_CALCULATOR.model('runningAlpha', REFERENCE_ENERGY_IN_GEV);
  const kinematics = new ProcessKinematics(model);
  const symmetric =
    representative.initial[0] === representative.initial[1] ||
    representative.final[0] === representative.final[1];
  const table = kinematics.angularTable(
    representative.initial,
    representative.final,
    REFERENCE_ENERGY_IN_GEV,
    Math.tanh(QCD_RAPIDITY_LIMIT),
    ANGULAR_POINTS,
    symmetric,
  );
  const shape = {
    cosine: table.cosine,
    differentialInNanobarns: table.differentialInNanobarns,
    referenceEnergySquared: REFERENCE_ENERGY_IN_GEV ** 2,
    strongPower: MAXIMUM_STRONG_POWER,
    referenceCoupling: model.parameters.strongCoupling ** 2 / (4 * Math.PI),
  };
  qcdShapes.set(key, shape);
  return shape;
}

function maximumCosine(
  energySquared: number,
  final: readonly [ParticleName, ParticleName],
  minimumTransverse: number,
): number {
  const [firstMass, secondMass] = final.map((name) => particleSpec(name).massInGev.value) as [
    number,
    number,
  ];
  const energy = Math.sqrt(energySquared);
  if (energy <= firstMass + secondMass) {
    return 0;
  }
  const kallenValue =
    (energySquared - (firstMass + secondMass) ** 2) *
    (energySquared - (firstMass - secondMass) ** 2);
  const momentum = Math.sqrt(Math.max(kallenValue, 0)) / (2 * energy);
  return momentum <= minimumTransverse ? 0 : Math.sqrt(1 - (minimumTransverse / momentum) ** 2);
}

function couplingFactor(shape: AngularShape, energySquared: number): number {
  const scale = Math.sqrt(energySquared) * SCALE_FRACTION;
  return (strongCouplingOfPdf(scale) / shape.referenceCoupling) ** shape.strongPower;
}

function rapidityWeights(shape: AngularShape): readonly number[] {
  return shape.cosine.map(
    (cosine, index) => (shape.differentialInNanobarns[index] ?? 0) * (1 - cosine * cosine),
  );
}

function clippedSegments(
  shape: AngularShape,
  limit: number,
): readonly { readonly lower: number; readonly upper: number; readonly weight: number }[] {
  const weights = rapidityWeights(shape);
  const rapidityLimit = Math.atanh(Math.min(limit, 1 - Number.EPSILON));
  return shape.cosine.slice(1).map((upperCosine, index) => {
    const start = Math.atanh(shape.cosine[index] ?? 0);
    const end = Math.atanh(upperCosine);
    const lower = Math.max(start, -rapidityLimit);
    const upper = Math.min(end, rapidityLimit);
    if (!(upper > lower)) {
      return { lower, upper, weight: 0 };
    }
    const interpolate = (rapidity: number): number =>
      (weights[index] ?? 0) +
      (((weights[index + 1] ?? 0) - (weights[index] ?? 0)) * (rapidity - start)) / (end - start);
    return {
      lower,
      upper,
      weight: ((interpolate(lower) + interpolate(upper)) / 2) * (upper - lower),
    };
  });
}

function scaledCrossSection(shape: AngularShape, energySquared: number, limit: number): number {
  return (
    clippedSegments(shape, limit).reduce((sum, segment) => sum + segment.weight, 0) *
    (shape.referenceEnergySquared / energySquared) *
    couplingFactor(shape, energySquared)
  );
}

function sampleShape(shape: AngularShape, limit: number, random: RandomSource): number {
  const segments = clippedSegments(shape, limit);
  const segment =
    segments[
      sampleIndexByWeights(
        segments.map((item) => item.weight),
        random,
      )
    ];
  if (segment === undefined) {
    return 0;
  }
  return Math.tanh(segment.lower + random.nextUnit() * (segment.upper - segment.lower));
}

function gaussLegendreNodes(
  count: number,
): readonly { readonly node: number; readonly weight: number }[] {
  const nodes: { node: number; weight: number }[] = [];
  for (let index = 1; index <= count; index += 1) {
    let root = Math.cos((Math.PI * (index - 0.25)) / (count + 0.5));
    let derivative = 1;
    for (let iteration = 0; iteration < 100; iteration += 1) {
      let previous = 1;
      let current = root;
      for (let order = 2; order <= count; order += 1) {
        const next = ((2 * order - 1) * root * current - (order - 1) * previous) / order;
        previous = current;
        current = next;
      }
      derivative = (count * (root * current - previous)) / (root * root - 1);
      const step = current / derivative;
      root -= step;
      if (Math.abs(step) < 1e-15) {
        break;
      }
    }
    nodes.push({ node: root, weight: 2 / ((1 - root * root) * derivative * derivative) });
  }
  return nodes;
}

const RAPIDITY_RULE = gaussLegendreNodes(RAPIDITY_NODES);

function sideOf(particle: ParticleName): Side {
  const structure = partonStructureOf(particleSpec(particle));
  return structure === null
    ? { structure: null, partons: [particle] }
    : { structure, partons: PARTON_FLAVORS };
}

function density(side: Side, parton: ParticleName, fraction: number, scale: number): number {
  if (side.structure === null) {
    return 1;
  }
  return partonMomentumDensity(side.structure, parton, fraction, scale) / fraction;
}

function luminosity(
  first: Side,
  firstParton: ParticleName,
  second: Side,
  secondParton: ParticleName,
  tau: number,
  scale: number,
): number {
  if (first.structure === null && second.structure === null) {
    return 0;
  }
  if (first.structure === null) {
    return density(second, secondParton, tau, scale);
  }
  if (second.structure === null) {
    return density(first, firstParton, tau, scale);
  }
  const limit = -Math.log(tau) / 2;
  return RAPIDITY_RULE.reduce((sum, { node, weight }) => {
    const rapidity = node * limit;
    const root = Math.sqrt(tau);
    return (
      sum +
      weight *
        limit *
        density(first, firstParton, root * Math.exp(rapidity), scale) *
        density(second, secondParton, root * Math.exp(-rapidity), scale)
    );
  }, 0);
}

function sampleRapidity(
  first: Side,
  firstParton: ParticleName,
  second: Side,
  secondParton: ParticleName,
  tau: number,
  scale: number,
  random: RandomSource,
): number {
  if (first.structure === null) {
    return -Math.log(tau) / 2;
  }
  if (second.structure === null) {
    return Math.log(tau) / 2;
  }
  const limit = -Math.log(tau) / 2;
  const points = RAPIDITY_NODES * 2;
  const step = (2 * limit) / points;
  const weights = Array.from({ length: points }, (ignored, index) => {
    const rapidity = -limit + (index + 0.5) * step;
    const root = Math.sqrt(tau);
    return (
      density(first, firstParton, root * Math.exp(rapidity), scale) *
      density(second, secondParton, root * Math.exp(-rapidity), scale)
    );
  });
  const bin = sampleIndexByWeights(weights, random);
  return -limit + (bin + random.nextUnit()) * step;
}

function sampleValenceFraction(power: number, random: RandomSource): number {
  for (let attempt = 0; attempt < MAXIMUM_VALENCE_TRIES; attempt += 1) {
    const root = random.nextUnit();
    const fraction = root * root;
    if (random.nextUnit() < (1 - fraction) ** power) {
      return fraction;
    }
  }
  return random.nextUnit();
}

function onShell(name: ParticleName, momentum: Vector3): FourMomentumInGev {
  return {
    energy: Math.hypot(particleSpec(name).massInGev.value, vectorMagnitude(momentum)),
    momentum,
  };
}

function momentumScale(
  pieces: readonly { readonly massInGev: number; readonly momentum: Vector3 }[],
  energy: number,
): number {
  const energyAt = (scale: number): number =>
    pieces.reduce(
      (sum, piece) => sum + Math.hypot(piece.massInGev, scale * vectorMagnitude(piece.momentum)),
      0,
    );
  let lower = 0;
  let upper = 2;
  for (let step = 0; step < 100; step += 1) {
    const middle = (lower + upper) / 2;
    if (energyAt(middle) < energy) {
      lower = middle;
    } else {
      upper = middle;
    }
  }
  return (lower + upper) / 2;
}

export class PartonCollisions implements CollisionMechanism {
  private readonly tables = new Map<string, LuminosityTable>();

  constructor(
    private readonly particles: ParticleFactory,
    private readonly random: RandomSource,
    private readonly hadronization: Hadronization,
  ) {}

  applies(first: Particle, second: Particle): boolean {
    const names = [first.spec.name, second.spec.name];
    return (
      names.some((name) => partonStructureOf(particleSpec(name)) !== null) &&
      names.every(
        (name) =>
          partonStructureOf(particleSpec(name)) !== null ||
          particleSpec(name).constituents === null,
      )
    );
  }

  collide(first: Particle, second: Particle, options: CollisionRequest): CollisionEvent {
    const request: PartonCollisionRequest = {
      ...(options.channel === undefined ? {} : { channel: options.channel }),
      minimumTransverseMomentumInGev:
        options.minimumTransverseMomentumInGev ?? DEFAULT_MINIMUM_TRANSVERSE_MOMENTUM_IN_GEV,
    };
    const total = {
      energy:
        first.kinematics.fourMomentumInGev.energy + second.kinematics.fourMomentumInGev.energy,
      momentum: addVectors(
        first.kinematics.fourMomentumInGev.momentum,
        second.kinematics.fourMomentumInGev.momentum,
      ),
    };
    const energy = invariantMassInGev(total);
    const firstAtRest = boostToRest(first.kinematics.fourMomentumInGev, total, energy);
    const beamMomentum = vectorMagnitude(firstAtRest.momentum);
    const axis =
      beamMomentum > 0 ? scaleVector(firstAtRest.momentum, 1 / beamMomentum) : { x: 0, y: 0, z: 1 };
    const effectiveEnergySquared = 4 * beamMomentum * beamMomentum;
    const table = this.table(first.spec.name, second.spec.name, effectiveEnergySquared, request);
    if (table.entries.length === 0 || !(table.totalInNanobarns > 0)) {
      throw new LocalizedError(
        localizedText(
          `При √s = ${energy.toPrecision(4)} ГэВ у пары ${first.spec.name} + ${second.spec.name} нет жестких партонных процессов выше p_T = ${String(request.minimumTransverseMomentumInGev)} ГэВ${request.channel === undefined ? '' : ` в канале ${request.channel}`}`,
          `At √s = ${energy.toPrecision(4)} GeV the pair ${first.spec.name} + ${second.spec.name} has no hard parton processes above p_T = ${String(request.minimumTransverseMomentumInGev)} GeV${request.channel === undefined ? '' : ` in channel ${request.channel}`}`,
        ),
      );
    }
    const entry =
      table.entries[
        sampleIndexByWeights(
          table.entries.map((item) => item.total),
          this.random,
        )
      ];
    if (entry === undefined) {
      throw new Error('No partonic process chosen');
    }
    const firstSide = sideOf(first.spec.name);
    const secondSide = sideOf(second.spec.name);
    const sampled = this.sampleHardKinematics(
      entry,
      firstSide,
      secondSide,
      effectiveEnergySquared,
      request,
    );
    const { tau, shape, limit, firstFraction, secondFraction } = sampled;
    const hardEnergySquared = tau * effectiveEnergySquared;
    const scale = Math.sqrt(hardEnergySquared) * SCALE_FRACTION;
    const cosine = sampleShape(shape, limit, this.random);
    const azimuth = 2 * Math.PI * this.random.nextUnit();
    const hardEnergy = Math.sqrt(hardEnergySquared);
    const [leftName, rightName] = entry.final;
    const [leftMass, rightMass] = entry.final.map((name) => particleSpec(name).massInGev.value) as [
      number,
      number,
    ];
    const kallenValue =
      (hardEnergySquared - (leftMass + rightMass) ** 2) *
      (hardEnergySquared - (leftMass - rightMass) ** 2);
    const outgoing = Math.sqrt(Math.max(kallenValue, 0)) / (2 * hardEnergy);
    const helper: Vector3 = Math.abs(axis.x) < 0.5 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
    const firstPerpendicular = (() => {
      const projected = subtractVectors(helper, scaleVector(axis, dotProduct(helper, axis)));
      return scaleVector(projected, 1 / vectorMagnitude(projected));
    })();
    const secondPerpendicular: Vector3 = {
      x: axis.y * firstPerpendicular.z - axis.z * firstPerpendicular.y,
      y: axis.z * firstPerpendicular.x - axis.x * firstPerpendicular.z,
      z: axis.x * firstPerpendicular.y - axis.y * firstPerpendicular.x,
    };
    const sine = Math.sqrt(Math.max(0, 1 - cosine * cosine));
    const direction = addVectors(
      scaleVector(axis, cosine),
      addVectors(
        scaleVector(firstPerpendicular, sine * Math.cos(azimuth)),
        scaleVector(secondPerpendicular, sine * Math.sin(azimuth)),
      ),
    );
    const hardRest: readonly FourMomentumInGev[] = [
      onShell(leftName, scaleVector(direction, outgoing)),
      onShell(rightName, scaleVector(direction, -outgoing)),
    ];
    const longitudinal = beamMomentum * (firstFraction - secondFraction);
    const kicks = [firstSide, secondSide].map((side) =>
      side.structure === null
        ? { x: 0, y: 0, z: 0 }
        : addVectors(
            scaleVector(
              firstPerpendicular,
              sampleGaussian(
                REMNANT.primordialTransverseMomentumWidthInGev / Math.SQRT2,
                this.random,
              ),
            ),
            scaleVector(
              secondPerpendicular,
              sampleGaussian(
                REMNANT.primordialTransverseMomentumWidthInGev / Math.SQRT2,
                this.random,
              ),
            ),
          ),
    ) as [Vector3, Vector3];
    const hardTransverse = addVectors(kicks[0], kicks[1]);
    const hardMomentum = addVectors(scaleVector(axis, longitudinal), hardTransverse);
    const hardSystem: FourMomentumInGev = {
      energy: Math.hypot(hardEnergy, vectorMagnitude(hardMomentum)),
      momentum: hardMomentum,
    };
    const hardCenter = hardRest.map((momentum) => boostFromRest(momentum, hardSystem, hardEnergy));
    const remnantPieces = [
      ...this.remnant(
        firstSide,
        first.spec.name,
        entry.first,
        firstFraction,
        scale,
        axis,
        beamMomentum,
        scaleVector(kicks[0], -1),
      ),
      ...this.remnant(
        secondSide,
        second.spec.name,
        entry.second,
        secondFraction,
        scale,
        scaleVector(axis, -1),
        beamMomentum,
        scaleVector(kicks[1], -1),
      ),
    ];
    const pieces = [
      ...[leftName, rightName].map((name, index) => ({
        name,
        momentum: (hardCenter[index] as FourMomentumInGev).momentum,
        group: null as string | null,
      })),
      ...remnantPieces,
    ];
    const factor = momentumScale(
      pieces.map((piece) => ({
        massInGev: particleSpec(piece.name).massInGev.value,
        momentum: piece.momentum,
      })),
      energy,
    );
    const position = first.kinematics.positionInFemtometers;
    const created = pieces.map((piece) => {
      const fourMomentum = boostFromRest(
        onShell(piece.name, scaleVector(piece.momentum, factor)),
        total,
        energy,
      );
      return {
        name: piece.name,
        group: piece.group,
        fourMomentumInGev: fourMomentum,
        particle: this.particles.create(piece.name, {
          momentumInGev: fourMomentum.momentum,
          positionInFemtometers: position,
        }),
      };
    });
    created.forEach((piece) => {
      if (piece.group !== null) {
        this.hadronization.joinRemnant(piece.particle, piece.group);
      }
    });
    const symbol = (name: ParticleName): string => particleSpec(name).symbol;
    return {
      process: `${symbol(first.spec.name)} ${symbol(second.spec.name)} → ${symbol(entry.first)} ${symbol(entry.second)} → ${symbol(leftName)} ${symbol(rightName)} + остатки`,
      centerOfMassEnergyInGev: energy,
      totalCrossSectionInNanobarns: table.totalInNanobarns,
      channelCrossSectionsInNanobarns: table.byChannel,
      cosineInCenterOfMass: cosine,
      products: created.map(({ name, particle, fourMomentumInGev }) => ({
        name,
        particle,
        fourMomentumInGev,
      })),
      diagrams: SHARED_PROCESS_CALCULATOR.diagrams(
        SHARED_PROCESS_CALCULATOR.model('fermiConstant'),
        [entry.first, entry.second],
        entry.final,
      ),
      partonic: {
        partons: [entry.first, entry.second],
        firstMomentumFraction: firstFraction,
        secondMomentumFraction: secondFraction,
        hardEnergyInGev: hardEnergy,
        transverseMomentumInGev: outgoing * sine,
        remnantCount: created.length - 2,
      },
    };
  }

  private sampleHardKinematics(
    entry: ProcessEntry,
    firstSide: Side,
    secondSide: Side,
    effectiveEnergySquared: number,
    request: PartonCollisionRequest,
  ): {
    readonly tau: number;
    readonly shape: AngularShape;
    readonly limit: number;
    readonly rapidity: number;
    readonly firstFraction: number;
    readonly secondFraction: number;
  } {
    const step =
      entry.logTauNodes.length > 1
        ? Math.abs((entry.logTauNodes[1] ?? 0) - (entry.logTauNodes[0] ?? 0))
        : 0;
    for (let attempt = 0; attempt < MAXIMUM_VALENCE_TRIES; attempt += 1) {
      const node = sampleIndexByWeights(entry.weights, this.random);
      const logTau = Math.min(
        (entry.logTauNodes[node] ?? 0) + (this.random.nextUnit() - 0.5) * step,
        0,
      );
      const tau = Math.exp(logTau);
      const hardEnergySquared = tau * effectiveEnergySquared;
      const shape = entry.shapes.length === 1 ? entry.shapes[0] : entry.shapes[node];
      const limit = maximumCosine(
        hardEnergySquared,
        entry.final,
        request.minimumTransverseMomentumInGev,
      );
      if (shape === undefined || !(limit > 0)) {
        continue;
      }
      const scale = Math.sqrt(hardEnergySquared) * SCALE_FRACTION;
      const rapidity = sampleRapidity(
        firstSide,
        entry.first,
        secondSide,
        entry.second,
        tau,
        scale,
        this.random,
      );
      const firstFraction = firstSide.structure === null ? 1 : Math.sqrt(tau) * Math.exp(rapidity);
      const secondFraction =
        secondSide.structure === null ? 1 : Math.sqrt(tau) * Math.exp(-rapidity);
      if (
        (firstSide.structure !== null && firstFraction >= 1) ||
        (secondSide.structure !== null && secondFraction >= 1)
      ) {
        continue;
      }
      return { tau, shape, limit, rapidity, firstFraction, secondFraction };
    }
    throw new Error('Partonic kinematics could not be sampled');
  }

  private remnant(
    side: Side,
    hadron: ParticleName,
    parton: ParticleName,
    fraction: number,
    scale: number,
    direction: Vector3,
    beamMomentum: number,
    transverse: Vector3,
  ): readonly {
    readonly name: ParticleName;
    readonly momentum: Vector3;
    readonly group: string | null;
  }[] {
    if (side.structure === null) {
      return [];
    }
    const valence = side.structure.valence;
    const group = `${hadron}:${String(this.random.nextUnit())}`;
    let names: readonly ParticleName[];
    let shares: readonly number[];
    if (parton === 'photon') {
      names = [hadron];
      shares = [1];
    } else if (parton === 'gluon') {
      const index = Math.floor(this.random.nextUnit() * valence.length);
      const quark = valence[index] as ParticleName;
      const rest = valence.filter((name, position) => position !== index);
      const diquark = diquarkOf(rest[0], rest[1]);
      const quarkShare = sampleValenceFraction(
        VALENCE_POWERS[quark] ?? REMNANT.valencePowerDownInProton,
        this.random,
      );
      const diquarkShare =
        REMNANT.valenceDiquarkEnhancement *
        rest.reduce(
          (sum, name) =>
            sum +
            sampleValenceFraction(
              VALENCE_POWERS[name] ?? REMNANT.valencePowerDownInProton,
              this.random,
            ),
          0,
        );
      names = diquark === null ? [hadron] : [quark, diquark];
      shares = diquark === null ? [1] : [quarkShare, diquarkShare];
    } else if (
      valence.includes(parton) &&
      this.random.nextUnit() < valenceShare(side.structure, parton, fraction, scale)
    ) {
      const position = valence.indexOf(parton);
      const rest = valence.filter((name, index) => index !== position);
      const diquark = diquarkOf(rest[0], rest[1]);
      names = diquark === null ? [hadron] : [diquark];
      shares = [1];
    } else {
      const companion = anti(parton);
      const companionShare = 1 - Math.pow(this.random.nextUnit(), 1 / (REMNANT.companionPower + 1));
      names = [hadron, companion];
      shares = [1 - companionShare, companionShare];
    }
    const totalShare = shares.reduce((sum, share) => sum + share, 0);
    const available = (1 - fraction) * beamMomentum;
    return names.map((name, index) => ({
      name,
      momentum: addVectors(
        scaleVector(direction, (available * (shares[index] ?? 0)) / totalShare),
        scaleVector(transverse, 1 / names.length),
      ),
      group: isColored(name) && names.length > 1 ? group : null,
    }));
  }

  private table(
    firstHadron: ParticleName,
    secondHadron: ParticleName,
    energySquared: number,
    request: PartonCollisionRequest,
  ): LuminosityTable {
    const key = `${firstHadron}|${secondHadron}|${Math.sqrt(energySquared).toPrecision(ENERGY_KEY_DIGITS)}|${String(request.minimumTransverseMomentumInGev)}|${request.channel ?? ''}`;
    const cached = this.tables.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const firstSide = sideOf(firstHadron);
    const secondSide = sideOf(secondHadron);
    const entries: ProcessEntry[] = [];
    firstSide.partons.forEach((firstParton) =>
      secondSide.partons.forEach((secondParton) => {
        this.processes(firstParton, secondParton, energySquared, request).forEach((process) => {
          const minimumTau = process.thresholdSquared / energySquared;
          if (!(minimumTau < 1)) {
            return;
          }
          const nodes = process.shapes.length > 1 ? process.shapes.length : TAU_NODES;
          const logTauNodes = Array.from(
            { length: nodes },
            (ignored, index) => Math.log(minimumTau) * (1 - (index + 0.5) / nodes),
          );
          const step = -Math.log(minimumTau) / nodes;
          const weights = logTauNodes.map((logTau, index) => {
            const tau = Math.exp(logTau);
            const hardEnergySquared = tau * energySquared;
            const shape = process.shapes.length === 1 ? process.shapes[0] : process.shapes[index];
            if (shape === undefined) {
              return 0;
            }
            const limit = maximumCosine(
              hardEnergySquared,
              process.final,
              request.minimumTransverseMomentumInGev,
            );
            const partonic = limit > 0 ? scaledCrossSection(shape, hardEnergySquared, limit) : 0;
            return (
              step *
              tau *
              luminosity(
                firstSide,
                firstParton,
                secondSide,
                secondParton,
                tau,
                Math.sqrt(hardEnergySquared) * SCALE_FRACTION,
              ) *
              partonic
            );
          });
          const total = weights.reduce((sum, weight) => sum + weight, 0);
          if (total > 0) {
            entries.push({
              first: firstParton,
              second: secondParton,
              final: process.final,
              shapes: process.shapes,
              logTauNodes,
              weights,
              total,
            });
          }
        });
      }),
    );
    const byChannel: Record<string, number> = {};
    entries.forEach((entry) => {
      const channel = entry.final.join('+');
      byChannel[channel] = (byChannel[channel] ?? 0) + entry.total;
    });
    const table = {
      entries,
      totalInNanobarns: entries.reduce((sum, entry) => sum + entry.total, 0),
      byChannel,
    };
    if (this.tables.size >= TABLE_CACHE_LIMIT) {
      const oldest = this.tables.keys().next().value;
      if (oldest !== undefined) {
        this.tables.delete(oldest);
      }
    }
    this.tables.set(key, table);
    return table;
  }

  private processes(
    firstParton: ParticleName,
    secondParton: ParticleName,
    energySquared: number,
    request: PartonCollisionRequest,
  ): readonly {
    readonly final: readonly [ParticleName, ParticleName];
    readonly shapes: readonly AngularShape[];
    readonly thresholdSquared: number;
  }[] {
    const minimumTransverseSquared = 4 * request.minimumTransverseMomentumInGev ** 2;
    const bothQcd = isQcdParton(firstParton) && isQcdParton(secondParton);
    if (request.channel === undefined) {
      if (bothQcd) {
        return qcdFinalStates(firstParton, secondParton).map(({ final, representative }) => ({
          final,
          shapes: [qcdShape(representative)],
          thresholdSquared: minimumTransverseSquared,
        }));
      }
      if (firstParton === 'photon' || secondParton === 'photon') {
        return [];
      }
      return candidateChannels(firstParton, secondParton).flatMap((channel) =>
        this.massiveProcess(firstParton, secondParton, channel, energySquared, request),
      );
    }
    if (bothQcd && request.channel.split('+').every((name) => isQcdParton(name as ParticleName))) {
      const wanted = canonical(...(request.channel.split('+') as [ParticleName, ParticleName]));
      const qcd = qcdFinalStates(firstParton, secondParton).find(
        (item) => canonical(item.final[0], item.final[1]) === wanted,
      );
      return qcd === undefined
        ? []
        : [
            {
              final: qcd.final,
              shapes: [qcdShape(qcd.representative)],
              thresholdSquared: minimumTransverseSquared,
            },
          ];
    }
    return this.massiveProcess(firstParton, secondParton, request.channel, energySquared, request);
  }

  private massiveProcess(
    firstParton: ParticleName,
    secondParton: ParticleName,
    channel: string,
    energySquared: number,
    request: PartonCollisionRequest,
  ): readonly {
    readonly final: readonly [ParticleName, ParticleName];
    readonly shapes: readonly AngularShape[];
    readonly thresholdSquared: number;
  }[] {
    const [left, right] = channel.split('+') as [
      ParticleName | undefined,
      ParticleName | undefined,
    ];
    if (left === undefined || right === undefined) {
      return [];
    }
    const model = SHARED_PROCESS_CALCULATOR.model('fermiConstant');
    const orientations: readonly (readonly [ParticleName, ParticleName])[] = [
      [left, right],
      [right, left],
    ];
    const final = orientations.find(
      (pair) =>
        SHARED_PROCESS_CALCULATOR.diagrams(model, [firstParton, secondParton], pair).length > 0,
    );
    if (final === undefined) {
      return [];
    }
    const key = `${firstParton}+${secondParton}>${final.join('+')}|${Math.sqrt(energySquared).toPrecision(ENERGY_KEY_DIGITS)}|${String(request.minimumTransverseMomentumInGev)}`;
    const cached = massiveShapes.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const masses = final.map((name) => particleSpec(name).massInGev.value);
    const thresholdSquared = Math.max(
      4 * request.minimumTransverseMomentumInGev ** 2,
      ((masses[0] ?? 0) + (masses[1] ?? 0)) ** 2 * THRESHOLD_MARGIN,
    );
    const minimumTau = thresholdSquared / energySquared;
    if (!(minimumTau < 1)) {
      massiveShapes.set(key, []);
      return [];
    }
    const shapes = Array.from({ length: MASSIVE_TAU_NODES }, (ignored, index) => {
      const logTau = Math.log(minimumTau) * (1 - (index + 0.5) / MASSIVE_TAU_NODES);
      const nodeEnergy = Math.sqrt(Math.exp(logTau) * energySquared);
      const nodeModel = SHARED_PROCESS_CALCULATOR.model('runningAlpha', nodeEnergy);
      const kinematics = new ProcessKinematics(nodeModel);
      const limit = maximumCosine(
        nodeEnergy * nodeEnergy,
        final,
        request.minimumTransverseMomentumInGev,
      );
      const tableAtNode = kinematics.angularTable(
        [firstParton, secondParton],
        final,
        nodeEnergy,
        Math.max(limit, 0),
        MASSIVE_ANGULAR_POINTS,
      );
      return {
        cosine: tableAtNode.cosine,
        differentialInNanobarns: tableAtNode.differentialInNanobarns,
        referenceEnergySquared: nodeEnergy * nodeEnergy,
        strongPower: strongPowerOf([firstParton, secondParton, ...final]),
        referenceCoupling: nodeModel.parameters.strongCoupling ** 2 / (4 * Math.PI),
      };
    });
    const result = [{ final, shapes, thresholdSquared }];
    massiveShapes.set(key, result);
    return result;
  }
}
