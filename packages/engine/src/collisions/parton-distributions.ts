/* Parton distributions of nucleons from the NNPDF2.3 LO QED grid: log-cubic Hermite interpolation in ln x and ln Q² like LHAPDF, frozen outside the grid, mapped to the neutron by isospin and to antinucleons by charge conjugation, with the set's own alpha_s table. */
import { PROTON_PARTON_DISTRIBUTIONS, particleSpec } from '@standard-model/constants';
import type { ParticleName, ParticleSpec } from '@standard-model/contracts';

const GRID = PROTON_PARTON_DISTRIBUTIONS;
const LOG_X = Float64Array.from(GRID.xs, Math.log);
const LOG_Q_SQUARED = Float64Array.from(GRID.qsInGev, (scale) => Math.log(scale * scale));
const VALUES = Float64Array.from(GRID.values);
const FLAVOR_COUNT = GRID.flavors.length;
const Q_COUNT = GRID.qsInGev.length;
const LOG_ALPHA_Q_SQUARED = Float64Array.from(GRID.alphaS.qsInGev, (scale) =>
  Math.log(scale * scale),
);
const ALPHA_VALUES = Float64Array.from(GRID.alphaS.values);
const GLUON_CODE = 21;
const PHOTON_CODE = 22;
const PROTON_VALENCE: readonly ParticleName[] = ['up', 'up', 'down'];

const QUARK_CODES: Readonly<Partial<Record<ParticleName, number>>> = {
  down: 1,
  up: 2,
  strange: 3,
  charm: 4,
  bottom: 5,
  top: 6,
};

export const PARTON_FLAVORS: readonly ParticleName[] = [
  'down',
  'up',
  'strange',
  'charm',
  'bottom',
  'antiDown',
  'antiUp',
  'antiStrange',
  'antiCharm',
  'antiBottom',
  'gluon',
  'photon',
];

function codeOf(parton: ParticleName): number | null {
  if (parton === 'gluon') {
    return GLUON_CODE;
  }
  if (parton === 'photon') {
    return PHOTON_CODE;
  }
  const spec = particleSpec(parton);
  const base = spec.pdgId < 0 ? spec.antiparticleName : parton;
  const code = QUARK_CODES[base];
  return code === undefined ? null : spec.pdgId < 0 ? -code : code;
}

function flavorColumn(code: number): number {
  return GRID.flavors.indexOf(code);
}

function interval(knots: Float64Array, value: number): number {
  let low = 0;
  let high = knots.length - 1;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if ((knots[middle] ?? 0) <= value) {
      low = middle;
    } else {
      high = middle;
    }
  }
  return low;
}

function slope(knots: Float64Array, values: (index: number) => number, index: number): number {
  const last = knots.length - 1;
  if (index === 0) {
    return (values(1) - values(0)) / ((knots[1] ?? 0) - (knots[0] ?? 0));
  }
  if (index === last) {
    return (values(last) - values(last - 1)) / ((knots[last] ?? 0) - (knots[last - 1] ?? 0));
  }
  return (
    (values(index + 1) - values(index - 1)) / ((knots[index + 1] ?? 0) - (knots[index - 1] ?? 0))
  );
}

function hermite(knots: Float64Array, values: (index: number) => number, point: number): number {
  const clamped = Math.min(Math.max(point, knots[0] ?? 0), knots[knots.length - 1] ?? 0);
  const index = Math.min(interval(knots, clamped), knots.length - 2);
  const left = knots[index] ?? 0;
  const width = (knots[index + 1] ?? 0) - left;
  const fraction = (clamped - left) / width;
  const square = fraction * fraction;
  const cube = square * fraction;
  return (
    (2 * cube - 3 * square + 1) * values(index) +
    (cube - 2 * square + fraction) * width * slope(knots, values, index) +
    (-2 * cube + 3 * square) * values(index + 1) +
    (cube - square) * width * slope(knots, values, index + 1)
  );
}

function protonDensity(code: number, x: number, scaleInGev: number): number {
  const column = flavorColumn(code);
  if (column < 0) {
    return 0;
  }
  const logX = Math.log(x);
  const logQSquared = Math.log(scaleInGev * scaleInGev);
  const atQ = (qIndex: number): number =>
    hermite(
      LOG_X,
      (xIndex) => VALUES[(xIndex * Q_COUNT + qIndex) * FLAVOR_COUNT + column] ?? 0,
      logX,
    );
  return Math.max(hermite(LOG_Q_SQUARED, atQ, logQSquared), 0);
}

function sortedKey(names: readonly ParticleName[]): string {
  return [...names].sort().join('+');
}

function anti(name: ParticleName): ParticleName {
  return particleSpec(name).antiparticleName;
}

function isospinPartner(name: ParticleName): ParticleName {
  const swaps: Readonly<Partial<Record<ParticleName, ParticleName>>> = {
    up: 'down',
    down: 'up',
    antiUp: 'antiDown',
    antiDown: 'antiUp',
  };
  return swaps[name] ?? name;
}

export interface PartonStructure {
  readonly toProtonParton: (parton: ParticleName) => ParticleName;
  readonly valence: readonly ParticleName[];
}

export function partonStructureOf(spec: ParticleSpec): PartonStructure | null {
  if (spec.family !== 'baryon' || spec.constituents === null) {
    return null;
  }
  const content = sortedKey(spec.constituents);
  const conjugate = spec.constituents.map(anti);
  const protonKey = sortedKey(PROTON_VALENCE);
  const neutronKey = sortedKey(PROTON_VALENCE.map(isospinPartner));
  if (content === protonKey) {
    return { toProtonParton: (parton) => parton, valence: spec.constituents };
  }
  if (content === neutronKey) {
    return { toProtonParton: isospinPartner, valence: spec.constituents };
  }
  if (sortedKey(conjugate) === protonKey) {
    return { toProtonParton: anti, valence: spec.constituents };
  }
  if (sortedKey(conjugate) === neutronKey) {
    return { toProtonParton: (parton) => isospinPartner(anti(parton)), valence: spec.constituents };
  }
  return null;
}

export function partonMomentumDensity(
  structure: PartonStructure,
  parton: ParticleName,
  x: number,
  scaleInGev: number,
): number {
  if (!(x > 0 && x < 1)) {
    return 0;
  }
  const code = codeOf(structure.toProtonParton(parton));
  return code === null ? 0 : protonDensity(code, x, scaleInGev);
}

export function valenceShare(
  structure: PartonStructure,
  parton: ParticleName,
  x: number,
  scaleInGev: number,
): number {
  if (!structure.valence.includes(parton)) {
    return 0;
  }
  const total = partonMomentumDensity(structure, parton, x, scaleInGev);
  const sea = partonMomentumDensity(structure, anti(parton), x, scaleInGev);
  return total > 0 ? Math.max(total - sea, 0) / total : 0;
}

export function strongCouplingOfPdf(scaleInGev: number): number {
  return hermite(
    LOG_ALPHA_Q_SQUARED,
    (index) => ALPHA_VALUES[index] ?? 0,
    Math.log(scaleInGev * scaleInGev),
  );
}

export const PDF_GRID_LIMITS = {
  minimumX: GRID.xs[0] ?? 0,
  minimumScaleInGev: GRID.qsInGev[0] ?? 0,
  maximumScaleInGev: GRID.qsInGev[GRID.qsInGev.length - 1] ?? 0,
};
