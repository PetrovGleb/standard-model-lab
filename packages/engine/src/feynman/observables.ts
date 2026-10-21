/* Observables from tree amplitudes: helicity and colour sums, centre-of-mass kinematics, 2→2 cross sections with dσ/dcosθ, 1→2 and 1→3 widths by Dalitz integration, and PDG references for comparison. */
import { particleSpec } from '@standard-model/constants';
import { textIn, type DiagramView, type ParticleName } from '@standard-model/contracts';
import { meanLifeInSecondsToWidthInGev } from '@standard-model/utils';
import { NANOBARN_PER_INVERSE_GEV_SQUARED } from '../collisions/cross-sections.js';
import { COLORS_IN_OCTET, COLORS_IN_TRIPLET } from '../lagrangian/gauge-algebra.js';
import { complexPair } from './dirac.js';
import { FeynmanModel, treeAmplitude, type ExternalLeg, type Species } from './amplitude.js';
import {
  antiparticleSpinor,
  barred,
  outgoing,
  particleSpinor,
  polarization,
  type FourMomentum,
} from './external-states.js';

export interface ProcessLeg {
  readonly particle: ParticleName;
  readonly incoming: boolean;
}

const GAUSS_LEGENDRE_NODES = 24;
const SIMPSON_TOLERANCE = 1e-7;
const SIMPSON_MAXIMUM_DEPTH = 18;
const PHASE_SPACE_TWO_BODY = 8 * Math.PI;
const CROSS_SECTION_TWO_BODY = 32 * Math.PI;
const DALITZ_NORMALIZATION = 256 * Math.PI ** 3;
const RAPIDITY_LIMIT = 19;
const FORWARD_SINGULARITY_FRACTION = 1e-6;
const RAPIDITY_PANELS = 19;
const PANEL_NODES = 12;
const DISPLAY_COSINE_LIMIT = 0.999;

function gaussLegendre(count: number): { readonly nodes: number[]; readonly weights: number[] } {
  const nodes: number[] = [];
  const weights: number[] = [];
  for (let index = 1; index <= count; index += 1) {
    let root = Math.cos((Math.PI * (index - 0.25)) / (count + 0.5));
    let derivative = 0;
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
    nodes.push(root);
    weights.push(2 / ((1 - root * root) * derivative * derivative));
  }
  return { nodes, weights };
}

const QUADRATURE = gaussLegendre(GAUSS_LEGENDRE_NODES);
const PANEL_QUADRATURE = gaussLegendre(PANEL_NODES);
const QUADRATURES = new Map([[GAUSS_LEGENDRE_NODES, QUADRATURE]]);

function quadratureWith(nodes: number): ReturnType<typeof gaussLegendre> {
  const cached = QUADRATURES.get(nodes);
  if (cached !== undefined) {
    return cached;
  }
  const rule = gaussLegendre(nodes);
  QUADRATURES.set(nodes, rule);
  return rule;
}

function integrateGauss(
  lower: number,
  upper: number,
  integrand: (value: number) => number,
  rule = QUADRATURE,
): number {
  const half = (upper - lower) / 2;
  const middle = (upper + lower) / 2;
  return (
    rule.nodes.reduce(
      (total, node, index) => total + (rule.weights[index] ?? 0) * integrand(middle + half * node),
      0,
    ) * half
  );
}

function integratePanels(
  lower: number,
  upper: number,
  panels: number,
  integrand: (value: number) => number,
): number {
  const width = (upper - lower) / panels;
  let total = 0;
  for (let panel = 0; panel < panels; panel += 1) {
    total += integrateGauss(
      lower + panel * width,
      lower + (panel + 1) * width,
      integrand,
      PANEL_QUADRATURE,
    );
  }
  return total;
}

export function adaptiveSimpson(
  lower: number,
  upper: number,
  integrand: (value: number) => number,
): number {
  const simpson = (
    start: number,
    end: number,
    startValue: number,
    middleValue: number,
    endValue: number,
  ): number => ((end - start) / 6) * (startValue + 4 * middleValue + endValue);
  const recurse = (
    start: number,
    end: number,
    startValue: number,
    middleValue: number,
    endValue: number,
    whole: number,
    depth: number,
  ): number => {
    const middle = (start + end) / 2;
    const leftValue = integrand((start + middle) / 2);
    const rightValue = integrand((middle + end) / 2);
    const left = simpson(start, middle, startValue, leftValue, middleValue);
    const right = simpson(middle, end, middleValue, rightValue, endValue);
    const refined = left + right;
    if (
      depth >= SIMPSON_MAXIMUM_DEPTH ||
      Math.abs(refined - whole) <= 15 * SIMPSON_TOLERANCE * Math.abs(refined)
    ) {
      return refined + (refined - whole) / 15;
    }
    return (
      recurse(start, middle, startValue, leftValue, middleValue, left, depth + 1) +
      recurse(middle, end, middleValue, rightValue, endValue, right, depth + 1)
    );
  };
  const lowerValue = integrand(lower);
  const upperValue = integrand(upper);
  const centerValue = integrand((lower + upper) / 2);
  return recurse(
    lower,
    upper,
    lowerValue,
    centerValue,
    upperValue,
    simpson(lower, upper, lowerValue, centerValue, upperValue),
    0,
  );
}

function helicities(species: Species): readonly number[] {
  if (species.kind === 'scalar') {
    return [0];
  }
  if (species.kind === 'vector') {
    return species.massInGev > 0 ? [1, -1, 0] : [1, -1];
  }
  return [1, -1];
}

function colorCount(particle: ParticleName): number {
  if (particle === 'gluon') {
    return COLORS_IN_OCTET;
  }
  return particleSpec(particle).family === 'quark' ? COLORS_IN_TRIPLET : 1;
}

export function spinStates(particle: ParticleName): number {
  const spec = particleSpec(particle);
  if (spec.family === 'neutrino') {
    return 1;
  }
  if (spec.spinInReducedPlanckUnits === 0) {
    return 1;
  }
  if (spec.statistics === 'fermiDirac') {
    return 2;
  }
  return spec.massInGev.value > 0 ? 3 : 2;
}

export function averagingFactor(initial: readonly ParticleName[]): number {
  return initial.reduce(
    (product, particle) => product * spinStates(particle) * colorCount(particle),
    1,
  );
}

export function symmetryFactor(final: readonly ParticleName[]): number {
  const counts = new Map<ParticleName, number>();
  final.forEach((particle) => counts.set(particle, (counts.get(particle) ?? 0) + 1));
  const factorial = (value: number): number => (value <= 1 ? 1 : value * factorial(value - 1));
  return [...counts.values()].reduce((product, count) => product * factorial(count), 1);
}

function externalLeg(
  model: FeynmanModel,
  leg: ProcessLeg,
  momentum: FourMomentum,
  helicity: number,
  color: number,
): ExternalLeg {
  const own = model.species(leg.particle, color);
  const species = leg.incoming ? own : model.anti(own);
  const mass = own.massInGev;
  const recursionMomentum: FourMomentum = leg.incoming
    ? momentum
    : [-momentum[0], -momentum[1], -momentum[2], -momentum[3]];
  let wave: Float64Array;
  if (own.kind === 'column') {
    const spinor = particleSpinor(momentum, mass, helicity);
    wave = leg.incoming ? spinor : barred(spinor);
  } else if (own.kind === 'row') {
    const spinor = antiparticleSpinor(momentum, mass, helicity);
    wave = leg.incoming ? barred(spinor) : spinor;
  } else if (own.kind === 'vector') {
    const vector = polarization(momentum, mass, helicity);
    wave = leg.incoming ? vector : outgoing(vector);
  } else {
    wave = complexPair(1);
  }
  return { species, momentum: recursionMomentum, wave };
}

const colorAssignments = new WeakMap<FeynmanModel, Map<string, readonly (readonly number[])[]>>();
const RELATIVE_COLOR_NOISE = 1e-24;

function allColorAssignments(legs: readonly ProcessLeg[]): readonly (readonly number[])[] {
  return legs.reduce<number[][]>(
    (assignments, leg) =>
      assignments.flatMap((prefix) =>
        Array.from({ length: colorCount(leg.particle) }, (ignored, color) => [...prefix, color]),
      ),
    [[]],
  );
}

function helicitySum(
  model: FeynmanModel,
  legs: readonly ProcessLeg[],
  momenta: readonly FourMomentum[],
  colors: readonly number[],
): number {
  let total = 0;
  const assign = (index: number, built: ExternalLeg[]): void => {
    const leg = legs[index];
    if (leg === undefined) {
      const amplitude = treeAmplitude(model, built);
      total += (amplitude[0] ?? 0) ** 2 + (amplitude[1] ?? 0) ** 2;
      return;
    }
    const color = colors[index] ?? 0;
    const species = model.species(leg.particle, 0);
    helicities(species).forEach((helicity) =>
      assign(index + 1, [
        ...built,
        externalLeg(model, leg, momenta[index] ?? [0, 0, 0, 0], helicity, color),
      ]),
    );
  };
  assign(0, []);
  return total;
}

export function summedSquaredAmplitude(
  model: FeynmanModel,
  legs: readonly ProcessLeg[],
  momenta: readonly FourMomentum[],
): number {
  const key = legs.map((leg) => `${leg.incoming ? 'in' : 'out'}:${leg.particle}`).join(',');
  const cache = colorAssignments.get(model) ?? new Map<string, readonly (readonly number[])[]>();
  colorAssignments.set(model, cache);
  const known = cache.get(key);
  if (known !== undefined) {
    return known.reduce((total, colors) => total + helicitySum(model, legs, momenta, colors), 0);
  }
  const contributions = allColorAssignments(legs).map((colors) => ({
    colors,
    value: helicitySum(model, legs, momenta, colors),
  }));
  const largest = contributions.reduce((maximum, item) => Math.max(maximum, item.value), 0);
  if (largest > 0) {
    cache.set(
      key,
      contributions
        .filter((item) => item.value > largest * RELATIVE_COLOR_NOISE)
        .map((item) => item.colors),
    );
  }
  return contributions.reduce((total, item) => total + item.value, 0);
}

export function kallen(first: number, second: number, third: number): number {
  return (
    first * first +
    second * second +
    third * third -
    2 * (first * second + second * third + third * first)
  );
}

export function twoBodyMomentum(total: number, first: number, second: number): number {
  return (
    Math.sqrt(Math.max(kallen(total * total, first * first, second * second), 0)) / (2 * total)
  );
}

export interface CrossSectionResult {
  readonly crossSectionInNanobarns: number;
  readonly fluxFreeWeight: number;
  readonly cosine: readonly number[];
  readonly differentialInNanobarns: readonly number[];
  readonly fluxFreeDifferential: readonly number[];
}

export class ProcessKinematics {
  constructor(private readonly model: FeynmanModel) {}

  centerOfMassMomenta(
    masses: readonly [number, number, number, number],
    energy: number,
    cosine: number,
  ): readonly FourMomentum[] {
    const [first, second, third, fourth] = masses;
    const incoming = twoBodyMomentum(energy, first, second);
    const outgoingMomentum = twoBodyMomentum(energy, third, fourth);
    const sine = Math.sqrt(Math.max(1 - cosine * cosine, 0));
    const energyOf = (mass: number, momentum: number): number =>
      Math.sqrt(mass * mass + momentum * momentum);
    return [
      [energyOf(first, incoming), 0, 0, incoming],
      [energyOf(second, incoming), 0, 0, -incoming],
      [energyOf(third, outgoingMomentum), outgoingMomentum * sine, 0, outgoingMomentum * cosine],
      [energyOf(fourth, outgoingMomentum), -outgoingMomentum * sine, 0, -outgoingMomentum * cosine],
    ];
  }

  crossSection(
    initial: readonly [ParticleName, ParticleName],
    final: readonly [ParticleName, ParticleName],
    energy: number,
    maximumAbsoluteCosine = 1,
    distributionPoints = 41,
    grid: 'cosine' | 'rapidity' = 'cosine',
  ): CrossSectionResult {
    const legs: ProcessLeg[] = [
      { particle: initial[0], incoming: true },
      { particle: initial[1], incoming: true },
      { particle: final[0], incoming: false },
      { particle: final[1], incoming: false },
    ];
    const masses = [...initial, ...final].map((particle) => this.model.massOf(particle)) as [
      number,
      number,
      number,
      number,
    ];
    const empty = {
      crossSectionInNanobarns: 0,
      fluxFreeWeight: 0,
      cosine: [],
      differentialInNanobarns: [],
      fluxFreeDifferential: [],
    };
    if (energy <= masses[2] + masses[3] || energy < masses[0] + masses[1]) {
      return empty;
    }
    const incoming = twoBodyMomentum(energy, masses[0], masses[1]);
    const outgoingMomentum = twoBodyMomentum(energy, masses[2], masses[3]);
    const averaging = averagingFactor(initial);
    const symmetry = symmetryFactor(final);
    const squared = (cosine: number): number =>
      summedSquaredAmplitude(this.model, legs, this.centerOfMassMomenta(masses, energy, cosine)) /
      (averaging * symmetry);
    const fluxFree = (cosine: number): number =>
      (outgoingMomentum * squared(cosine)) / (CROSS_SECTION_TWO_BODY * energy * energy);
    const rapidityLimit =
      maximumAbsoluteCosine >= 1 ? RAPIDITY_LIMIT : Math.atanh(maximumAbsoluteCosine);
    const weight = integratePanels(-rapidityLimit, rapidityLimit, RAPIDITY_PANELS, (rapidity) => {
      const cosine = Math.tanh(rapidity);
      return fluxFree(cosine) * (1 - cosine * cosine);
    });
    const toNanobarns = NANOBARN_PER_INVERSE_GEV_SQUARED / incoming;
    const cosine = Array.from({ length: distributionPoints }, (ignored, index) => {
      const fraction = -1 + (2 * index) / (distributionPoints - 1);
      return grid === 'rapidity'
        ? Math.tanh(fraction * rapidityLimit)
        : fraction * Math.min(maximumAbsoluteCosine, DISPLAY_COSINE_LIMIT);
    });
    const fluxFreeDifferential = cosine.map(fluxFree);
    return {
      crossSectionInNanobarns: weight * toNanobarns,
      fluxFreeWeight: weight,
      cosine,
      differentialInNanobarns: fluxFreeDifferential.map((value) => value * toNanobarns),
      fluxFreeDifferential,
    };
  }

  angularTable(
    initial: readonly [ParticleName, ParticleName],
    final: readonly [ParticleName, ParticleName],
    energy: number,
    maximumAbsoluteCosine: number,
    points: number,
    mirrorSymmetric = false,
  ): { readonly cosine: readonly number[]; readonly differentialInNanobarns: readonly number[] } {
    const legs: ProcessLeg[] = [
      { particle: initial[0], incoming: true },
      { particle: initial[1], incoming: true },
      { particle: final[0], incoming: false },
      { particle: final[1], incoming: false },
    ];
    const masses = [...initial, ...final].map((particle) => this.model.massOf(particle)) as [
      number,
      number,
      number,
      number,
    ];
    if (energy <= masses[2] + masses[3] || energy < masses[0] + masses[1]) {
      return { cosine: [], differentialInNanobarns: [] };
    }
    const incoming = twoBodyMomentum(energy, masses[0], masses[1]);
    const outgoingMomentum = twoBodyMomentum(energy, masses[2], masses[3]);
    const normalization =
      (averagingFactor(initial) *
        symmetryFactor(final) *
        CROSS_SECTION_TWO_BODY *
        energy *
        energy) /
      (outgoingMomentum * (NANOBARN_PER_INVERSE_GEV_SQUARED / incoming));
    const rapidityLimit = Math.atanh(Math.min(maximumAbsoluteCosine, Math.tanh(RAPIDITY_LIMIT)));
    const cosine = Array.from({ length: points }, (ignored, index) =>
      Math.tanh(rapidityLimit * (-1 + (2 * index) / (points - 1))),
    );
    const evaluate = (value: number): number =>
      summedSquaredAmplitude(this.model, legs, this.centerOfMassMomenta(masses, energy, value)) /
      normalization;
    const half = Math.floor(points / 2);
    const differentialInNanobarns = mirrorSymmetric
      ? (() => {
          const upper = cosine.slice(half).map(evaluate);
          return [...upper.slice(points % 2 === 1 ? 1 : 0).reverse(), ...upper];
        })()
      : cosine.map(evaluate);
    return { cosine, differentialInNanobarns };
  }

  forwardSingular(
    initial: readonly [ParticleName, ParticleName],
    final: readonly [ParticleName, ParticleName],
    energy: number,
    diagrams: readonly DiagramView[],
  ): boolean {
    const masses = [...initial, ...final].map((particle) => this.model.massOf(particle)) as [
      number,
      number,
      number,
      number,
    ];
    if (energy <= masses[2] + masses[3] || energy < masses[0] + masses[1]) {
      return false;
    }
    const transfers = [1, -1].flatMap((cosine) => {
      const [first, , third, fourth] = this.centerOfMassMomenta(masses, energy, cosine);
      const difference = (left: FourMomentum, right: FourMomentum): number =>
        (left[0] - right[0]) ** 2 -
        (left[1] - right[1]) ** 2 -
        (left[2] - right[2]) ** 2 -
        (left[3] - right[3]) ** 2;
      return [
        {
          channel: 't-channel',
          value: Math.abs(difference(first as FourMomentum, third as FourMomentum)),
        },
        {
          channel: 'u-channel',
          value: Math.abs(difference(first as FourMomentum, fourth as FourMomentum)),
        },
      ];
    });
    return diagrams.some(
      (diagram) =>
        textIn(diagram.channel, 'en') !== 's-channel' &&
        diagram.propagators.some((line) => this.model.massOf(line.particle) === 0) &&
        transfers.some(
          (transfer) =>
            transfer.channel === textIn(diagram.channel, 'en') &&
            transfer.value < FORWARD_SINGULARITY_FRACTION * energy * energy,
        ),
    );
  }

  twoBodyWidth(parent: ParticleName, products: readonly [ParticleName, ParticleName]): number {
    const mass = this.model.massOf(parent);
    const [firstMass, secondMass] = products.map((particle) => this.model.massOf(particle)) as [
      number,
      number,
    ];
    if (mass <= firstMass + secondMass) {
      return 0;
    }
    const momentum = twoBodyMomentum(mass, firstMass, secondMass);
    const firstEnergy = Math.sqrt(firstMass ** 2 + momentum ** 2);
    const secondEnergy = Math.sqrt(secondMass ** 2 + momentum ** 2);
    const legs: ProcessLeg[] = [
      { particle: parent, incoming: true },
      { particle: products[0], incoming: false },
      { particle: products[1], incoming: false },
    ];
    const squared =
      summedSquaredAmplitude(this.model, legs, [
        [mass, 0, 0, 0],
        [firstEnergy, 0, 0, momentum],
        [secondEnergy, 0, 0, -momentum],
      ]) /
      (averagingFactor([parent]) * symmetryFactor(products));
    return (momentum * squared) / (PHASE_SPACE_TWO_BODY * mass * mass);
  }

  dalitzMomenta(
    mass: number,
    masses: readonly [number, number, number],
    firstPairSquared: number,
    secondPairSquared: number,
  ): readonly FourMomentum[] | null {
    const [first, second, third] = masses;
    const thirdEnergy = (mass * mass + third * third - firstPairSquared) / (2 * mass);
    const firstEnergy = (mass * mass + first * first - secondPairSquared) / (2 * mass);
    const firstMomentum = Math.sqrt(Math.max(firstEnergy ** 2 - first ** 2, 0));
    const thirdMomentum = Math.sqrt(Math.max(thirdEnergy ** 2 - third ** 2, 0));
    const firstThirdSquared =
      mass * mass +
      first * first +
      second * second +
      third * third -
      firstPairSquared -
      secondPairSquared;
    if (firstMomentum === 0 || thirdMomentum === 0) {
      return null;
    }
    const cosine =
      (first * first + third * third + 2 * firstEnergy * thirdEnergy - firstThirdSquared) /
      (2 * firstMomentum * thirdMomentum);
    if (Math.abs(cosine) > 1 + 1e-9) {
      return null;
    }
    const bounded = Math.max(-1, Math.min(1, cosine));
    const sine = Math.sqrt(1 - bounded * bounded);
    const firstVector: FourMomentum = [
      firstEnergy,
      firstMomentum * sine,
      0,
      firstMomentum * bounded,
    ];
    const thirdVector: FourMomentum = [thirdEnergy, 0, 0, thirdMomentum];
    const secondVector: FourMomentum = [
      mass - firstEnergy - thirdEnergy,
      -firstVector[1],
      0,
      -firstVector[3] - thirdMomentum,
    ];
    return [firstVector, secondVector, thirdVector];
  }

  threeBodySquared(
    parent: ParticleName,
    products: readonly [ParticleName, ParticleName, ParticleName],
  ) {
    const mass = this.model.massOf(parent);
    const masses = products.map((particle) => this.model.massOf(particle)) as [
      number,
      number,
      number,
    ];
    const legs: ProcessLeg[] = [
      { particle: parent, incoming: true },
      ...products.map((particle) => ({ particle, incoming: false })),
    ];
    const normalization = averagingFactor([parent]) * symmetryFactor(products);
    return (firstPairSquared: number, secondPairSquared: number): number => {
      const momenta = this.dalitzMomenta(mass, masses, firstPairSquared, secondPairSquared);
      return momenta === null
        ? 0
        : summedSquaredAmplitude(this.model, legs, [[mass, 0, 0, 0], ...momenta]) / normalization;
    };
  }

  threeBodyWidth(
    parent: ParticleName,
    products: readonly [ParticleName, ParticleName, ParticleName],
    quadratureNodes = GAUSS_LEGENDRE_NODES,
  ): number {
    const rule = quadratureWith(quadratureNodes);
    const mass = this.model.massOf(parent);
    const [first, second, third] = products.map((particle) => this.model.massOf(particle)) as [
      number,
      number,
      number,
    ];
    if (mass <= first + second + third) {
      return 0;
    }
    const squared = this.threeBodySquared(parent, products);
    const lower = (first + second) ** 2;
    const upper = (mass - third) ** 2;
    const integral = integrateGauss(
      lower,
      upper,
      (firstPairSquared) => {
        const pairMass = Math.sqrt(firstPairSquared);
        const secondStar = (firstPairSquared - first * first + second * second) / (2 * pairMass);
        const thirdStar = (mass * mass - firstPairSquared - third * third) / (2 * pairMass);
        const secondMomentum = Math.sqrt(Math.max(secondStar ** 2 - second ** 2, 0));
        const thirdMomentum = Math.sqrt(Math.max(thirdStar ** 2 - third ** 2, 0));
        const sum = (secondStar + thirdStar) ** 2;
        return integrateGauss(
          sum - (secondMomentum + thirdMomentum) ** 2,
          sum - (secondMomentum - thirdMomentum) ** 2,
          (secondPairSquared) => squared(firstPairSquared, secondPairSquared),
          rule,
        );
      },
      rule,
    );
    return integral / (DALITZ_NORMALIZATION * mass ** 3);
  }
}

export function measuredPartialWidth(
  parent: ParticleName,
  products: readonly ParticleName[],
): { readonly value: number; readonly uncertainty: number | null } | null {
  const spec = particleSpec(parent);
  const total =
    spec.widthInGev?.value ??
    (spec.meanLifeInSeconds === null
      ? null
      : meanLifeInSecondsToWidthInGev(spec.meanLifeInSeconds.value));
  if (total === null || total === undefined) {
    return null;
  }
  const key = [...products].sort().join('+');
  const channel = spec.decays.find((decay) => [...decay.products].sort().join('+') === key);
  if (channel === undefined) {
    return null;
  }
  const fraction = channel.branchingFraction;
  const totalUncertainty =
    spec.widthInGev?.value === undefined ? 0 : (spec.widthInGev.uncertainty ?? 0);
  return {
    value: total * fraction.value,
    uncertainty:
      fraction.uncertainty === null
        ? null
        : Math.hypot(total * fraction.uncertainty, fraction.value * totalUncertainty),
  };
}
