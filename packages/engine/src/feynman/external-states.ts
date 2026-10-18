/* External wave functions and propagators: helicity spinors u and v, polarization vectors for massless and massive vector bosons, and the fermion, vector and scalar propagators; widths act only for timelike momenta, s-dependent for W and Z as in the PDG mass definition. */
import {
  addArrays,
  complexPair,
  conjugateArray,
  diracAdjoint,
  minkowskiProduct,
  pairDivide,
  realFourVector,
  realMinkowskiSquare,
  scaleArray,
  slashColumn,
  slashRow,
  SPINOR_COMPONENTS,
  type ComplexFourVector,
  type ComplexPair,
  type Spinor,
} from './dirac.js';

export type FourMomentum = readonly [number, number, number, number];

interface Direction {
  readonly polar: number;
  readonly azimuth: number;
  readonly magnitude: number;
}

function direction(momentum: FourMomentum): Direction {
  const [, x, y, z] = momentum;
  const magnitude = Math.hypot(x, y, z);
  if (magnitude === 0) {
    return { polar: 0, azimuth: 0, magnitude: 0 };
  }
  return {
    polar: Math.acos(Math.max(-1, Math.min(1, z / magnitude))),
    azimuth: Math.atan2(y, x),
    magnitude,
  };
}

function helicityTwoSpinor(target: Direction, helicitySign: number): readonly number[] {
  const half = target.polar / 2;
  const cosine = Math.cos(half);
  const sine = Math.sin(half);
  if (helicitySign > 0) {
    return [cosine, 0, Math.cos(target.azimuth) * sine, Math.sin(target.azimuth) * sine];
  }
  return [-Math.cos(target.azimuth) * sine, Math.sin(target.azimuth) * sine, cosine, 0];
}

function stack(
  upper: readonly number[],
  upperScale: number,
  lower: readonly number[],
  lowerScale: number,
): Spinor {
  const result = new Float64Array(2 * SPINOR_COMPONENTS);
  upper.forEach((value, index) => {
    result[index] = value * upperScale;
  });
  lower.forEach((value, index) => {
    result[upper.length + index] = value * lowerScale;
  });
  return result;
}

export function particleSpinor(momentum: FourMomentum, mass: number, helicitySign: number): Spinor {
  const target = direction(momentum);
  const energy = momentum[0];
  const twoSpinor = helicityTwoSpinor(target, helicitySign);
  return stack(
    twoSpinor,
    Math.sqrt(energy + mass),
    twoSpinor,
    helicitySign * Math.sqrt(Math.max(energy - mass, 0)),
  );
}

export function antiparticleSpinor(
  momentum: FourMomentum,
  mass: number,
  helicitySign: number,
): Spinor {
  const target = direction(momentum);
  const energy = momentum[0];
  const antiTwoSpinor = helicityTwoSpinor(target, -helicitySign);
  return stack(
    antiTwoSpinor,
    -helicitySign * Math.sqrt(Math.max(energy - mass, 0)),
    antiTwoSpinor,
    Math.sqrt(energy + mass),
  );
}

export function barred(spinor: Spinor): Spinor {
  return diracAdjoint(spinor);
}

export function polarization(
  momentum: FourMomentum,
  mass: number,
  helicity: number,
): ComplexFourVector {
  const target = direction(momentum);
  const cosinePolar = Math.cos(target.polar);
  const sinePolar = Math.sin(target.polar);
  const cosineAzimuth = Math.cos(target.azimuth);
  const sineAzimuth = Math.sin(target.azimuth);
  if (helicity === 0) {
    const energy = momentum[0];
    return realFourVector([
      target.magnitude / mass,
      (energy / mass) * sinePolar * cosineAzimuth,
      (energy / mass) * sinePolar * sineAzimuth,
      (energy / mass) * cosinePolar,
    ]);
  }
  const first = [0, cosinePolar * cosineAzimuth, cosinePolar * sineAzimuth, -sinePolar];
  const second = [0, -sineAzimuth, cosineAzimuth, 0];
  const result = new Float64Array(2 * SPINOR_COMPONENTS);
  for (let component = 0; component < SPINOR_COMPONENTS; component += 1) {
    result[2 * component] = (-helicity * (first[component] ?? 0)) / Math.SQRT2;
    result[2 * component + 1] = -(second[component] ?? 0) / Math.SQRT2;
  }
  return result;
}

export function outgoing(values: Float64Array): Float64Array {
  return conjugateArray(values);
}

function denominator(
  momentumSquared: number,
  mass: number,
  width: number,
  runningWidth = false,
): ComplexPair {
  if (momentumSquared <= 0 || width === 0) {
    return complexPair(momentumSquared - mass * mass);
  }
  const effectiveWidth = runningWidth ? (width * momentumSquared) / (mass * mass) : width;
  return complexPair(momentumSquared - mass * mass, mass * effectiveWidth);
}

export function vectorPropagate(
  current: ComplexFourVector,
  momentum: FourMomentum,
  mass: number,
  width: number,
): ComplexFourVector {
  const square = realMinkowskiSquare(momentum);
  const minusI = complexPair(0, -1);
  if (mass === 0) {
    return scaleArray(current, pairDivide(minusI, complexPair(square)));
  }
  const momentumVector = realFourVector(momentum);
  const longitudinal = scaleArray(
    momentumVector,
    pairDivide(minkowskiProduct(momentumVector, current), complexPair(-(mass * mass))),
  );
  return scaleArray(
    addArrays(current, longitudinal),
    pairDivide(minusI, denominator(square, mass, width, true)),
  );
}

export function columnPropagate(
  current: Spinor,
  momentum: FourMomentum,
  mass: number,
  width: number,
): Spinor {
  const numerator = addArrays(
    slashColumn(realFourVector(momentum), current),
    scaleArray(current, complexPair(mass)),
  );
  return scaleArray(
    numerator,
    pairDivide(complexPair(0, 1), denominator(realMinkowskiSquare(momentum), mass, width)),
  );
}

export function rowPropagate(
  current: Spinor,
  momentum: FourMomentum,
  mass: number,
  width: number,
): Spinor {
  const numerator = addArrays(
    scaleArray(slashRow(current, realFourVector(momentum)), complexPair(-1)),
    scaleArray(current, complexPair(mass)),
  );
  return scaleArray(
    numerator,
    pairDivide(complexPair(0, 1), denominator(realMinkowskiSquare(momentum), mass, width)),
  );
}

export function scalarPropagate(
  current: ComplexPair,
  momentum: FourMomentum,
  mass: number,
  width: number,
): ComplexPair {
  return scaleArray(
    current,
    pairDivide(complexPair(0, 1), denominator(realMinkowskiSquare(momentum), mass, width)),
  );
}
