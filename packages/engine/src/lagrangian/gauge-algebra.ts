/* Gauge algebra of SU(3)×SU(2)×U(1): generators T = λ/2 and σ/2, structure constants computed from commutators, and the electroweak mass-eigenstate fields written in the W¹, W², W³, B basis. */
import {
  complex,
  matrixFromRows,
  multiplyMatrices,
  subtractMatrices,
  trace,
  type ComplexMatrix,
  type ComplexNumber,
} from '../quantum/linear-algebra.js';

const HALF = 0.5;
const INVERSE_SQUARE_ROOT_THREE = 1 / Math.sqrt(3);
const STRUCTURE_CONSTANT_NOISE = 1e-12;

function halved(rows: ReadonlyArray<ReadonlyArray<ComplexNumber | number>>): ComplexMatrix {
  return matrixFromRows(
    rows.map((row) =>
      row.map((entry) =>
        typeof entry === 'number'
          ? complex(entry * HALF)
          : complex(entry.real * HALF, entry.imaginary * HALF),
      ),
    ),
  );
}

const IMAGINARY = complex(0, 1);
const MINUS_I = complex(0, -1);

export const WEAK_GENERATORS: readonly ComplexMatrix[] = [
  halved([
    [0, 1],
    [1, 0],
  ]),
  halved([
    [0, MINUS_I],
    [IMAGINARY, 0],
  ]),
  halved([
    [1, 0],
    [0, -1],
  ]),
];

export const COLOR_GENERATORS: readonly ComplexMatrix[] = [
  halved([
    [0, 1, 0],
    [1, 0, 0],
    [0, 0, 0],
  ]),
  halved([
    [0, MINUS_I, 0],
    [IMAGINARY, 0, 0],
    [0, 0, 0],
  ]),
  halved([
    [1, 0, 0],
    [0, -1, 0],
    [0, 0, 0],
  ]),
  halved([
    [0, 0, 1],
    [0, 0, 0],
    [1, 0, 0],
  ]),
  halved([
    [0, 0, MINUS_I],
    [0, 0, 0],
    [IMAGINARY, 0, 0],
  ]),
  halved([
    [0, 0, 0],
    [0, 0, 1],
    [0, 1, 0],
  ]),
  halved([
    [0, 0, 0],
    [0, 0, MINUS_I],
    [0, IMAGINARY, 0],
  ]),
  halved([
    [INVERSE_SQUARE_ROOT_THREE, 0, 0],
    [0, INVERSE_SQUARE_ROOT_THREE, 0],
    [0, 0, -2 * INVERSE_SQUARE_ROOT_THREE],
  ]),
];

export const COLORS_IN_TRIPLET = 3;
export const COLORS_IN_OCTET = 8;

function structureConstants(generators: readonly ComplexMatrix[]): number[][][] {
  const count = generators.length;
  const normalization = trace(
    multiplyMatrices(generators[0] as ComplexMatrix, generators[0] as ComplexMatrix),
  ).real;
  return generators.map((first) =>
    generators.map((second) => {
      const commutator = subtractMatrices(
        multiplyMatrices(first, second),
        multiplyMatrices(second, first),
      );
      return Array.from({ length: count }, (ignored, index) => {
        const projection = trace(multiplyMatrices(commutator, generators[index] as ComplexMatrix));
        const value = projection.imaginary / normalization;
        return Math.abs(value) < STRUCTURE_CONSTANT_NOISE ? 0 : value;
      });
    }),
  );
}

export const WEAK_STRUCTURE_CONSTANTS = structureConstants(WEAK_GENERATORS);
export const COLOR_STRUCTURE_CONSTANTS = structureConstants(COLOR_GENERATORS);

export const ELECTROWEAK_GAUGE_COMPONENTS = 4;
export const HYPERCHARGE_COMPONENT = 3;

export type ElectroweakBoson = 'wPlus' | 'wMinus' | 'zBoson' | 'photon';
export const ELECTROWEAK_BOSONS: readonly ElectroweakBoson[] = [
  'wPlus',
  'wMinus',
  'zBoson',
  'photon',
];

export function electroweakComponents(
  sineWeak: number,
  cosineWeak: number,
): Readonly<Record<ElectroweakBoson, readonly ComplexNumber[]>> {
  const root = Math.SQRT1_2;
  return {
    wPlus: [complex(root), complex(0, root), complex(0), complex(0)],
    wMinus: [complex(root), complex(0, -root), complex(0), complex(0)],
    zBoson: [complex(0), complex(0), complex(cosineWeak), complex(-sineWeak)],
    photon: [complex(0), complex(0), complex(sineWeak), complex(cosineWeak)],
  };
}
