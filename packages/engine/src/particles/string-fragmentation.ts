/* Lund string fragmentation: a colour-singlet string between a triplet end (quark or antidiquark) and an antitriplet end (antiquark or diquark) breaks by u, d, s quark pairs and light diquark pairs with Gaussian transverse kicks, the Lund symmetric z with the Bowler factor at heavy ends and a final two-hadron step; mesons come from quark pairs, baryons from a diquark and a quark by the PYTHIA SU(6) weights; a string too light to break collapses into one hadron, and inside a decay momenta are reshuffled so energy stays exact. */
import { STRING_FRAGMENTATION, particleSpec } from '@standard-model/constants';
import {
  PARTICLE_NAMES,
  type FourMomentumInGev,
  type ParticleName,
  type ParticleSpec,
  type RandomSource,
  type Vector3,
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

export interface StringEnd {
  readonly flavor: ParticleName;
  readonly fourMomentumInGev: FourMomentumInGev;
}

export interface ColorString {
  readonly quark: StringEnd;
  readonly antiquark: StringEnd;
}

export interface FragmentHadron {
  readonly name: ParticleName;
  readonly fourMomentumInGev: FourMomentumInGev;
}

export interface ColorlessProduct {
  readonly massInGev: number;
  readonly fourMomentumInGev: FourMomentumInGev;
}

export interface HadronizedDecay {
  readonly hadrons: readonly FragmentHadron[];
  readonly colorless: readonly FourMomentumInGev[];
}

interface Candidate {
  readonly name: ParticleName;
  readonly weight: number;
}

interface Kick {
  readonly x: number;
  readonly y: number;
}

interface LightConeHadron {
  readonly name: ParticleName;
  readonly plus: number;
  readonly minus: number;
  readonly kick: Kick;
}

interface StringPiece {
  readonly total: FourMomentumInGev;
  readonly massInGev: number;
  readonly hadrons: readonly FragmentHadron[] | null;
  readonly single: ParticleName | null;
}

export type DiagonalFlavor = 'up' | 'down' | 'strange';

const HALF = 0.5;
const PSEUDOSCALAR_SPIN = 0;
const VECTOR_SPIN = 1;
const RADIANS_PER_DEGREE = Math.PI / 180;
const MAXIMUM_STRING_ATTEMPTS = 100;
const MAXIMUM_FLAVOR_TRIES = 100;
const MAXIMUM_Z_TRIES = 10_000;
const MAXIMUM_HADRONS_PER_STRING = 1000;
const BISECTION_STEPS = 100;
const MAXIMUM_SCALE_DOUBLINGS = 200;
const EQUAL_POWER_TOLERANCE = 1e-12;
const NO_KICK: Kick = { x: 0, y: 0 };

const LIGHT_FLAVORS: readonly DiagonalFlavor[] = ['up', 'down', 'strange'];
const LIGHT_FLAVOR_WEIGHTS = [1, 1, STRING_FRAGMENTATION.strangeToLightRatio];
const KICK_COMPONENT_WIDTH_IN_GEV = STRING_FRAGMENTATION.transverseMomentumWidthInGev / Math.SQRT2;
const BOWLER_FACTORS: Readonly<Partial<Record<ParticleName, number>>> = {
  charm: STRING_FRAGMENTATION.bowlerFactors.charm,
  bottom: STRING_FRAGMENTATION.bowlerFactors.bottom,
};
const VECTOR_RATIOS_BY_HEAVIEST_FLAVOR: readonly (readonly [ParticleName, number])[] = [
  ['bottom', STRING_FRAGMENTATION.vectorToPseudoscalarRatios.bottom],
  ['charm', STRING_FRAGMENTATION.vectorToPseudoscalarRatios.charm],
  ['strange', STRING_FRAGMENTATION.vectorToPseudoscalarRatios.strange],
];
const SUPPRESSION: Readonly<Partial<Record<ParticleName, number>>> = {
  etaMeson: STRING_FRAGMENTATION.etaSuppression,
  etaPrimeMeson: STRING_FRAGMENTATION.etaPrimeSuppression,
};
const ISOVECTOR_CONTENT: Readonly<Record<DiagonalFlavor, number>> = { up: 1, down: -1, strange: 0 };
const OCTET_CONTENT: Readonly<Record<DiagonalFlavor, number>> = { up: 1, down: 1, strange: -2 };
const SINGLET_CONTENT: Readonly<Record<DiagonalFlavor, number>> = { up: 1, down: 1, strange: 1 };
const DIAGONAL_STATES = [
  {
    spin: PSEUDOSCALAR_SPIN,
    isovector: 'pionZero',
    octetLike: 'etaMeson',
    singletLike: 'etaPrimeMeson',
    mixingAngleInDegrees: STRING_FRAGMENTATION.pseudoscalarMixingAngleInDegrees,
  },
  {
    spin: VECTOR_SPIN,
    isovector: 'rhoZero',
    octetLike: 'phiMeson',
    singletLike: 'omegaMeson',
    mixingAngleInDegrees: STRING_FRAGMENTATION.vectorMixingAngleInDegrees,
  },
] as const;

const SPECS: readonly ParticleSpec[] = PARTICLE_NAMES.map((name) => particleSpec(name));
const MESONS = SPECS.filter((spec) => spec.family === 'meson');
const BARYONS = SPECS.filter((spec) => spec.family === 'baryon' && spec.pdgId > 0);
const DIQUARKS = SPECS.filter((spec) => spec.family === 'diquark' && spec.pdgId > 0);
const DIQUARK_PAIR_PROBABILITY =
  STRING_FRAGMENTATION.diquarkToQuarkRatio / (1 + STRING_FRAGMENTATION.diquarkToQuarkRatio);
const SPIN_ONE_STATES = 3;
const SAME_FLAVOR_ORDERINGS = 1;
const MIXED_FLAVOR_ORDERINGS = 2;
const OCTET_SPIN = 1 / 2;
const DECUPLET_SPIN = 3 / 2;
const SU6 = STRING_FRAGMENTATION.baryonSpinFlavorWeights;
const SU6_SUMS = SU6.octet.map(
  (octet, index) => octet + STRING_FRAGMENTATION.decupletSuppression * (SU6.decuplet[index] ?? 0),
);
const PDG_DIGIT_BASE = 10;
const HUNDREDS = 100;
const TENS = 10;

function massOf(name: ParticleName): number {
  return particleSpec(name).massInGev.value;
}

function antiOf(name: ParticleName): ParticleName {
  return particleSpec(name).antiparticleName;
}

function baseFlavor(name: ParticleName): ParticleName {
  return particleSpec(name).pdgId < 0 ? antiOf(name) : name;
}

function isDiagonalFlavor(name: ParticleName): name is DiagonalFlavor {
  return (LIGHT_FLAVORS as readonly ParticleName[]).includes(name);
}

function pairKey(names: readonly ParticleName[]): string {
  return [...names].sort().join('+');
}

function contentAmplitude(
  content: Readonly<Record<DiagonalFlavor, number>>,
  flavor: DiagonalFlavor,
): number {
  return content[flavor] / Math.hypot(...Object.values(content));
}

export function diagonalMesonWeights(flavor: DiagonalFlavor, spin: number): readonly Candidate[] {
  const states = DIAGONAL_STATES.find((entry) => entry.spin === spin);
  if (states === undefined) {
    return [];
  }
  const angle = states.mixingAngleInDegrees * RADIANS_PER_DEGREE;
  const octet = contentAmplitude(OCTET_CONTENT, flavor);
  const singlet = contentAmplitude(SINGLET_CONTENT, flavor);
  return [
    { name: states.isovector, weight: contentAmplitude(ISOVECTOR_CONTENT, flavor) ** 2 },
    { name: states.octetLike, weight: (Math.cos(angle) * octet - Math.sin(angle) * singlet) ** 2 },
    {
      name: states.singletLike,
      weight: (Math.sin(angle) * octet + Math.cos(angle) * singlet) ** 2,
    },
  ];
}

const candidateCache = new Map<string, readonly Candidate[]>();

function mesonCandidates(
  quark: ParticleName,
  antiquark: ParticleName,
  spin: number,
): readonly Candidate[] {
  const key = `${quark}|${antiquark}|${String(spin)}`;
  const cached = candidateCache.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const wanted = pairKey([quark, antiquark]);
  const conjugate = pairKey([antiOf(quark), antiOf(antiquark)]);
  const candidates =
    isDiagonalFlavor(quark) && baseFlavor(antiquark) === quark
      ? diagonalMesonWeights(quark, spin)
      : MESONS.filter(
          (spec) =>
            spec.spinInReducedPlanckUnits === spin &&
            spec.constituents !== null &&
            (pairKey(spec.constituents) === wanted ||
              (spec.isSelfConjugate && pairKey(spec.constituents) === conjugate)),
        ).map((spec) => ({ name: spec.name, weight: 1 }));
  candidateCache.set(key, candidates);
  return candidates;
}

const thresholdCache = new Map<string, number>();

function isQuark(name: ParticleName): boolean {
  return particleSpec(name).family === 'quark';
}

function isDiquarkType(name: ParticleName): boolean {
  return particleSpec(name).family === 'diquark';
}

function quarkCode(name: ParticleName): number {
  return Math.abs(particleSpec(name).pdgId);
}

function quarksOf(name: ParticleName): readonly ParticleName[] {
  return particleSpec(name).constituents ?? [name];
}

function isLambdaLike(spec: ParticleSpec): boolean {
  const code = Math.abs(spec.pdgId);
  return Math.floor(code / HUNDREDS) % PDG_DIGIT_BASE < Math.floor(code / TENS) % PDG_DIGIT_BASE;
}

export function diquarkOf(
  first: ParticleName | undefined,
  second: ParticleName | undefined,
): ParticleName | null {
  if (first === undefined || second === undefined) {
    return null;
  }
  const isAnti = particleSpec(first).pdgId < 0;
  const wanted = pairKey([baseFlavor(first), baseFlavor(second)]);
  const matches = DIQUARKS.filter((spec) => pairKey(spec.constituents ?? []) === wanted).sort(
    (one, other) => one.spinInReducedPlanckUnits - other.spinInReducedPlanckUnits,
  );
  const chosen = matches[0];
  if (chosen === undefined) {
    return null;
  }
  return isAnti ? antiOf(chosen.name) : chosen.name;
}

function baryonsWithContent(quarks: readonly ParticleName[]): readonly ParticleSpec[] {
  const wanted = pairKey(quarks);
  return BARYONS.filter((spec) => pairKey(spec.constituents ?? []) === wanted);
}

function lightestHadronMass(triplet: ParticleName, antitriplet: ParticleName): number {
  if (isQuark(triplet) && isQuark(antitriplet)) {
    return Math.min(
      ...[PSEUDOSCALAR_SPIN, VECTOR_SPIN].flatMap((spin) =>
        mesonCandidates(triplet, antitriplet, spin)
          .filter((candidate) => candidate.weight > 0)
          .map((candidate) => massOf(candidate.name)),
      ),
    );
  }
  if (isDiquarkType(triplet) && isDiquarkType(antitriplet)) {
    return Number.POSITIVE_INFINITY;
  }
  const content = [...quarksOf(triplet), ...quarksOf(antitriplet)].map(baseFlavor);
  return Math.min(...baryonsWithContent(content).map((spec) => spec.massInGev.value));
}

function pairCandidates(allowDiquarks: boolean): readonly ParticleName[] {
  return allowDiquarks
    ? [...LIGHT_FLAVORS, ...DIQUARKS.map((spec) => antiOf(spec.name))]
    : LIGHT_FLAVORS;
}

function twoHadronThresholdInGev(triplet: ParticleName, antitriplet: ParticleName): number {
  const key = `${triplet}|${antitriplet}`;
  const cached = thresholdCache.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const allowDiquarks = !isDiquarkType(triplet) && !isDiquarkType(antitriplet);
  const threshold = Math.min(
    ...pairCandidates(allowDiquarks).map(
      (pair) => lightestHadronMass(triplet, antiOf(pair)) + lightestHadronMass(pair, antitriplet),
    ),
  );
  thresholdCache.set(key, threshold);
  return threshold;
}

const DIQUARK_WEIGHTS = DIQUARKS.map((spec) => {
  const [first, second] = spec.constituents ?? [];
  const flavorWeight = (name: ParticleName | undefined): number =>
    name === 'strange' ? STRING_FRAGMENTATION.strangeToLightRatio : 1;
  const containsStrange = (spec.constituents ?? []).includes('strange');
  return (
    (first === second ? SAME_FLAVOR_ORDERINGS : MIXED_FLAVOR_ORDERINGS) *
    flavorWeight(first) *
    flavorWeight(second) *
    (containsStrange ? STRING_FRAGMENTATION.strangeDiquarkSuppression : 1) *
    (spec.spinInReducedPlanckUnits > 0
      ? SPIN_ONE_STATES * STRING_FRAGMENTATION.spinOneDiquarkSuppression
      : 1)
  );
});

function vectorProbability(quark: ParticleName, antiquark: ParticleName): number {
  const flavors = [baseFlavor(quark), baseFlavor(antiquark)];
  const ratio =
    VECTOR_RATIOS_BY_HEAVIEST_FLAVOR.find(([flavor]) => flavors.includes(flavor))?.[1] ??
    STRING_FRAGMENTATION.vectorToPseudoscalarRatios.light;
  return ratio / (1 + ratio);
}

function lundPeak(power: number, lundA: number, exponent: number): number {
  const difference = power - lundA;
  if (Math.abs(difference) < EQUAL_POWER_TOLERANCE) {
    return exponent / (power + exponent);
  }
  const sum = power + exponent;
  return (sum - Math.sqrt(sum * sum - 4 * difference * exponent)) / (2 * difference);
}

function sumFourMomenta(momenta: readonly FourMomentumInGev[]): FourMomentumInGev {
  return momenta.reduce(
    (total, momentum) => ({
      energy: total.energy + momentum.energy,
      momentum: addVectors(total.momentum, momentum.momentum),
    }),
    { energy: 0, momentum: { x: 0, y: 0, z: 0 } },
  );
}

function moveBetweenFrames(
  momentum: FourMomentumInGev,
  source: FourMomentumInGev,
  target: FourMomentumInGev,
  massInGev: number,
): FourMomentumInGev {
  return boostFromRest(boostToRest(momentum, source, massInGev), target, massInGev);
}

function perpendicularBasis(axis: Vector3): readonly [Vector3, Vector3] {
  const helper: Vector3 = Math.abs(axis.x) < HALF ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
  const projected = subtractVectors(helper, scaleVector(axis, dotProduct(helper, axis)));
  const first = scaleVector(projected, 1 / vectorMagnitude(projected));
  const second: Vector3 = {
    x: axis.y * first.z - axis.z * first.y,
    y: axis.z * first.x - axis.x * first.z,
    z: axis.x * first.y - axis.y * first.x,
  };
  return [first, second];
}

function onShell(massInGev: number, momentum: Vector3): FourMomentumInGev {
  return { energy: Math.hypot(massInGev, vectorMagnitude(momentum)), momentum };
}

function momentumScale(
  clusters: readonly { readonly massInGev: number; readonly momentum: Vector3 }[],
  energyInGev: number,
): number | null {
  const energyAt = (scale: number): number =>
    clusters.reduce(
      (sum, cluster) =>
        sum + Math.hypot(cluster.massInGev, scale * vectorMagnitude(cluster.momentum)),
      0,
    );
  if (energyAt(0) > energyInGev) {
    return null;
  }
  let upper = 1;
  for (let doubling = 0; energyAt(upper) < energyInGev; doubling += 1) {
    if (doubling >= MAXIMUM_SCALE_DOUBLINGS) {
      return null;
    }
    upper *= 2;
  }
  let lower = 0;
  for (let step = 0; step < BISECTION_STEPS; step += 1) {
    const middle = (lower + upper) / 2;
    if (energyAt(middle) < energyInGev) {
      lower = middle;
    } else {
      upper = middle;
    }
  }
  return (lower + upper) / 2;
}

export class StringFragmentation {
  constructor(private readonly random: RandomSource) {}

  sampleLightFlavor(): ParticleName {
    return LIGHT_FLAVORS[sampleIndexByWeights(LIGHT_FLAVOR_WEIGHTS, this.random)] ?? 'up';
  }

  chooseMeson(quark: ParticleName, antiquark: ParticleName): ParticleName | null {
    const spin =
      this.random.nextUnit() < vectorProbability(quark, antiquark)
        ? VECTOR_SPIN
        : PSEUDOSCALAR_SPIN;
    const options = mesonCandidates(quark, antiquark, spin);
    if (options.length === 0) {
      return null;
    }
    const chosen =
      options[
        sampleIndexByWeights(
          options.map((option) => option.weight),
          this.random,
        )
      ]?.name;
    if (chosen === undefined) {
      return null;
    }
    return this.random.nextUnit() < (SUPPRESSION[chosen] ?? 1) ? chosen : null;
  }

  chooseHadron(triplet: ParticleName, antitriplet: ParticleName): ParticleName | null {
    if (isQuark(triplet) && isQuark(antitriplet)) {
      return this.chooseMeson(triplet, antitriplet);
    }
    if (isQuark(triplet) && isDiquarkType(antitriplet)) {
      return this.chooseBaryon(antitriplet, triplet);
    }
    if (isDiquarkType(triplet) && isQuark(antitriplet)) {
      const baryon = this.chooseBaryon(antiOf(triplet), antiOf(antitriplet));
      return baryon === null ? null : antiOf(baryon);
    }
    return null;
  }

  chooseBaryon(diquark: ParticleName, quark: ParticleName): ParticleName | null {
    const diquarkSpec = particleSpec(diquark);
    const [first, second] = diquarkSpec.constituents ?? [];
    if (first === undefined || second === undefined) {
      return null;
    }
    const spinZero = diquarkSpec.spinInReducedPlanckUnits === 0;
    const shared = quark === first || quark === second;
    const offset = shared ? 0 : 1;
    const group = spinZero ? 0 : first === second ? 2 : 4;
    const weight = SU6_SUMS[group + offset] ?? 0;
    const ceiling = Math.max(SU6_SUMS[group] ?? 0, SU6_SUMS[group + 1] ?? 0);
    if (!(weight > 0) || this.random.nextUnit() * ceiling > weight) {
      return null;
    }
    const octet = this.random.nextUnit() * weight < (SU6.octet[group + offset] ?? 0);
    const spin = octet ? OCTET_SPIN : DECUPLET_SPIN;
    const content = [first, second, quark];
    const distinct = new Set(content).size === content.length;
    let candidates = baryonsWithContent(content).filter(
      (spec) => spec.spinInReducedPlanckUnits === spin,
    );
    if (octet && distinct && candidates.length > 1) {
      const freeIsHeaviest = content.every((name) => quarkCode(name) <= quarkCode(quark));
      const lambdaShare = freeIsHeaviest
        ? spinZero
          ? 1
          : 0
        : spinZero
          ? STRING_FRAGMENTATION.lambdaLikeShares.spinZeroDiquarkWithLighterFreeQuark
          : STRING_FRAGMENTATION.lambdaLikeShares.spinOneDiquarkWithLighterFreeQuark;
      const lambdaLike = this.random.nextUnit() < lambdaShare;
      candidates = candidates.filter((spec) => isLambdaLike(spec) === lambdaLike);
    }
    return candidates[0]?.name ?? null;
  }

  collapse(string: ColorString): FragmentHadron | null {
    const name = this.hadronForPair(string.quark.flavor, string.antiquark.flavor);
    if (name === null) {
      return null;
    }
    const total = sumFourMomenta([
      string.quark.fourMomentumInGev,
      string.antiquark.fourMomentumInGev,
    ]);
    return { name, fourMomentumInGev: onShell(massOf(name), total.momentum) };
  }

  fragment(string: ColorString): readonly FragmentHadron[] | null {
    const total = sumFourMomenta([
      string.quark.fourMomentumInGev,
      string.antiquark.fourMomentumInGev,
    ]);
    const stringMass = invariantMassInGev(total);
    if (stringMass <= twoHadronThresholdInGev(string.quark.flavor, string.antiquark.flavor)) {
      return null;
    }
    const quarkAtRest = boostToRest(string.quark.fourMomentumInGev, total, stringMass);
    const axisLength = vectorMagnitude(quarkAtRest.momentum);
    if (!(axisLength > 0)) {
      return null;
    }
    const axis = scaleVector(quarkAtRest.momentum, 1 / axisLength);
    const [first, second] = perpendicularBasis(axis);
    for (let attempt = 0; attempt < MAXIMUM_STRING_ATTEMPTS; attempt += 1) {
      const hadrons = this.breakString(string.quark.flavor, string.antiquark.flavor, stringMass);
      if (hadrons !== null) {
        return hadrons.map((hadron) => {
          const along = (hadron.plus - hadron.minus) / 2;
          const momentum = addVectors(
            scaleVector(axis, along),
            addVectors(scaleVector(first, hadron.kick.x), scaleVector(second, hadron.kick.y)),
          );
          return {
            name: hadron.name,
            fourMomentumInGev: boostFromRest(
              { energy: (hadron.plus + hadron.minus) / 2, momentum },
              total,
              stringMass,
            ),
          };
        });
      }
    }
    return null;
  }

  hadronizeAtRest(
    strings: readonly ColorString[],
    colorless: readonly ColorlessProduct[],
  ): HadronizedDecay | null {
    const energy = sumFourMomenta([
      ...strings.flatMap((string) => [
        string.quark.fourMomentumInGev,
        string.antiquark.fourMomentumInGev,
      ]),
      ...colorless.map((product) => product.fourMomentumInGev),
    ]).energy;
    for (let attempt = 0; attempt < MAXIMUM_STRING_ATTEMPTS; attempt += 1) {
      const pieces = strings.map((string) => this.piece(string));
      if (pieces.some((piece) => piece === null)) {
        return null;
      }
      const resolved = pieces as readonly StringPiece[];
      if (resolved.every((piece) => piece.single === null)) {
        return {
          hadrons: resolved.flatMap((piece) => piece.hadrons ?? []),
          colorless: colorless.map((product) => product.fourMomentumInGev),
        };
      }
      const scale = momentumScale(
        [
          ...resolved.map((piece) => ({
            massInGev: piece.massInGev,
            momentum: piece.total.momentum,
          })),
          ...colorless.map((product) => ({
            massInGev: product.massInGev,
            momentum: product.fourMomentumInGev.momentum,
          })),
        ],
        energy,
      );
      if (scale === null) {
        continue;
      }
      return {
        hadrons: resolved.flatMap((piece) => {
          const moved = onShell(piece.massInGev, scaleVector(piece.total.momentum, scale));
          if (piece.single !== null) {
            return [{ name: piece.single, fourMomentumInGev: moved }];
          }
          return (piece.hadrons ?? []).map((hadron) => ({
            name: hadron.name,
            fourMomentumInGev: moveBetweenFrames(
              hadron.fourMomentumInGev,
              piece.total,
              moved,
              piece.massInGev,
            ),
          }));
        }),
        colorless: colorless.map((product) =>
          onShell(product.massInGev, scaleVector(product.fourMomentumInGev.momentum, scale)),
        ),
      };
    }
    return null;
  }

  private piece(string: ColorString): StringPiece | null {
    const total = sumFourMomenta([
      string.quark.fourMomentumInGev,
      string.antiquark.fourMomentumInGev,
    ]);
    const hadrons = this.fragment(string);
    if (hadrons !== null) {
      return { total, massInGev: invariantMassInGev(total), hadrons, single: null };
    }
    const single = this.hadronForPair(string.quark.flavor, string.antiquark.flavor);
    return single === null ? null : { total, massInGev: massOf(single), hadrons: null, single };
  }

  private hadronForPair(triplet: ParticleName, antitriplet: ParticleName): ParticleName | null {
    for (let attempt = 0; attempt < MAXIMUM_FLAVOR_TRIES; attempt += 1) {
      const name = this.chooseHadron(triplet, antitriplet);
      if (name !== null) {
        return name;
      }
    }
    return null;
  }

  private kick(): Kick {
    return {
      x: sampleGaussian(KICK_COMPONENT_WIDTH_IN_GEV, this.random),
      y: sampleGaussian(KICK_COMPONENT_WIDTH_IN_GEV, this.random),
    };
  }

  private pickPair(allowDiquark: boolean): ParticleName {
    if (allowDiquark && this.random.nextUnit() < DIQUARK_PAIR_PROBABILITY) {
      const diquark = DIQUARKS[sampleIndexByWeights(DIQUARK_WEIGHTS, this.random)];
      if (diquark !== undefined) {
        return antiOf(diquark.name);
      }
    }
    return this.sampleLightFlavor();
  }

  private breakAt(
    end: ParticleName,
    atQuarkEnd: boolean,
  ): { readonly flavor: ParticleName; readonly hadron: ParticleName } | null {
    for (let attempt = 0; attempt < MAXIMUM_FLAVOR_TRIES; attempt += 1) {
      const flavor = this.pickPair(!isDiquarkType(end));
      const hadron = atQuarkEnd
        ? this.chooseHadron(end, antiOf(flavor))
        : this.chooseHadron(flavor, end);
      if (hadron !== null) {
        return { flavor, hadron };
      }
    }
    return null;
  }

  private sampleZ(end: ParticleName, transverseMassSquared: number): number {
    const flavor = baseFlavor(end);
    const lundA = STRING_FRAGMENTATION.lundA;
    const lundB = STRING_FRAGMENTATION.lundBInPerGevSquared;
    const power = 1 + (BOWLER_FACTORS[flavor] ?? 0) * lundB * massOf(flavor) ** 2;
    const exponent = lundB * transverseMassSquared;
    const logDensity = (fraction: number): number =>
      -power * Math.log(fraction) + lundA * Math.log(1 - fraction) - exponent / fraction;
    const peak = lundPeak(power, lundA, exponent);
    const ceiling = logDensity(peak);
    for (let attempt = 0; attempt < MAXIMUM_Z_TRIES; attempt += 1) {
      const fraction = this.random.nextUnit();
      if (
        fraction > 0 &&
        fraction < 1 &&
        Math.log(1 - this.random.nextUnit()) <= logDensity(fraction) - ceiling
      ) {
        return fraction;
      }
    }
    return peak;
  }

  private breakString(
    quarkFlavor: ParticleName,
    antiquarkFlavor: ParticleName,
    stringMassInGev: number,
  ): readonly LightConeHadron[] | null {
    const smear = 1 + STRING_FRAGMENTATION.stopSmear * (2 * this.random.nextUnit() - 1);
    const hadrons: LightConeHadron[] = [];
    let quarkEnd = quarkFlavor;
    let antiquarkEnd = antiquarkFlavor;
    let quarkKick = NO_KICK;
    let antiquarkKick = NO_KICK;
    let plusLeft = stringMassInGev;
    let minusLeft = stringMassInGev;
    let lastPairMass = 0;
    while (hadrons.length < MAXIMUM_HADRONS_PER_STRING) {
      const leftKick = { x: quarkKick.x + antiquarkKick.x, y: quarkKick.y + antiquarkKick.y };
      const leftMassSquared = plusLeft * minusLeft - leftKick.x ** 2 - leftKick.y ** 2;
      const stopMass =
        (massOf(baseFlavor(quarkEnd)) +
          massOf(baseFlavor(antiquarkEnd)) +
          STRING_FRAGMENTATION.stopMassInGev +
          STRING_FRAGMENTATION.stopNewFlavor * lastPairMass) *
        smear;
      if (leftMassSquared < stopMass * stopMass) {
        break;
      }
      const atQuarkEnd = this.random.nextUnit() < HALF;
      const pair = this.breakAt(atQuarkEnd ? quarkEnd : antiquarkEnd, atQuarkEnd);
      if (pair === null) {
        return null;
      }
      const kick = this.kick();
      const hadronKick = atQuarkEnd
        ? { x: quarkKick.x - kick.x, y: quarkKick.y - kick.y }
        : { x: kick.x + antiquarkKick.x, y: kick.y + antiquarkKick.y };
      const transverseMassSquared =
        massOf(pair.hadron) ** 2 + hadronKick.x ** 2 + hadronKick.y ** 2;
      const fraction = this.sampleZ(atQuarkEnd ? quarkEnd : antiquarkEnd, transverseMassSquared);
      const along = fraction * (atQuarkEnd ? plusLeft : minusLeft);
      const across = transverseMassSquared / along;
      const plus = atQuarkEnd ? along : across;
      const minus = atQuarkEnd ? across : along;
      if (plus >= plusLeft || minus >= minusLeft) {
        break;
      }
      hadrons.push({ name: pair.hadron, plus, minus, kick: hadronKick });
      plusLeft -= plus;
      minusLeft -= minus;
      lastPairMass = massOf(pair.flavor);
      if (atQuarkEnd) {
        quarkEnd = pair.flavor;
        quarkKick = kick;
      } else {
        antiquarkEnd = antiOf(pair.flavor);
        antiquarkKick = { x: -kick.x, y: -kick.y };
      }
    }
    const last = this.finalPair(quarkEnd, antiquarkEnd);
    if (last === null) {
      return null;
    }
    const kick = this.kick();
    const firstKick = { x: quarkKick.x - kick.x, y: quarkKick.y - kick.y };
    const secondKick = { x: kick.x + antiquarkKick.x, y: kick.y + antiquarkKick.y };
    const firstSquared = massOf(last.first) ** 2 + firstKick.x ** 2 + firstKick.y ** 2;
    const secondSquared = massOf(last.second) ** 2 + secondKick.x ** 2 + secondKick.y ** 2;
    const lightCone = plusLeft * minusLeft;
    if (
      !(plusLeft > 0 && minusLeft > 0) ||
      lightCone < (Math.sqrt(firstSquared) + Math.sqrt(secondSquared)) ** 2
    ) {
      return null;
    }
    const shifted = lightCone + firstSquared - secondSquared;
    const share =
      (shifted + Math.sqrt(Math.max(shifted * shifted - 4 * lightCone * firstSquared, 0))) /
      (2 * lightCone);
    const firstPlus = share * plusLeft;
    const secondPlus = plusLeft - firstPlus;
    return [
      ...hadrons,
      { name: last.first, plus: firstPlus, minus: firstSquared / firstPlus, kick: firstKick },
      { name: last.second, plus: secondPlus, minus: secondSquared / secondPlus, kick: secondKick },
    ];
  }

  private finalPair(
    quarkEnd: ParticleName,
    antiquarkEnd: ParticleName,
  ): { readonly first: ParticleName; readonly second: ParticleName } | null {
    const allowDiquark = !isDiquarkType(quarkEnd) && !isDiquarkType(antiquarkEnd);
    for (let attempt = 0; attempt < MAXIMUM_FLAVOR_TRIES; attempt += 1) {
      const flavor = this.pickPair(allowDiquark);
      const first = this.chooseHadron(quarkEnd, antiOf(flavor));
      const second = first === null ? null : this.chooseHadron(flavor, antiquarkEnd);
      if (first !== null && second !== null) {
        return { first, second };
      }
    }
    return null;
  }
}
