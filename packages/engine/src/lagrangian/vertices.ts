/* Feynman-rule vertices derived from the Standard Model Lagrangian: fermion currents from the covariant derivative, gauge self-couplings from structure constants, hVV and hhVV from |DΦ|², Higgs self-couplings from V(Φ), Yukawa vertices from the masses. */
import { particleSpec } from '@standard-model/constants';
import type { ParticleName, VertexStructure } from '@standard-model/contracts';
import {
  complex,
  complexAdd,
  complexConjugate,
  complexMultiply,
  entryAt,
  identityMatrix,
  multiplyMatrices,
  scaleMatrix,
  type ComplexMatrix,
  type ComplexNumber,
} from '../quantum/linear-algebra.js';
import {
  COLOR_GENERATORS,
  COLOR_STRUCTURE_CONSTANTS,
  COLORS_IN_OCTET,
  COLORS_IN_TRIPLET,
  ELECTROWEAK_BOSONS,
  ELECTROWEAK_GAUGE_COMPONENTS,
  electroweakComponents,
  HYPERCHARGE_COMPONENT,
  WEAK_GENERATORS,
  WEAK_STRUCTURE_CONSTANTS,
  type ElectroweakBoson,
} from './gauge-algebra.js';
import {
  DIRAC_FERMIONS,
  FERMION_MULTIPLETS,
  type StandardModelParameters,
} from './standard-model.js';

export interface VertexLeg {
  readonly particle: ParticleName;
  readonly color: number;
}

export interface Vertex {
  readonly structure: VertexStructure;
  readonly legs: readonly VertexLeg[];
  readonly factors: readonly ComplexNumber[];
}

export interface DerivedMasses {
  readonly wMassInGev: number;
  readonly zMassInGev: number;
  readonly photonMassInGev: number;
  readonly higgsMassInGev: number;
  readonly higgsTadpole: number;
}

export interface DerivedLagrangian {
  readonly vertices: readonly Vertex[];
  readonly masses: DerivedMasses;
}

const NEGLIGIBLE_COUPLING = 1e-14;
const UPPER = 0;
const LOWER = 1;
const HIGGS: ParticleName = 'higgsBoson';
const GLUON: ParticleName = 'gluon';
const IMAGINARY = complex(0, 1);

function scaled(value: ComplexNumber, factor: number): ComplexNumber {
  return complex(value.real * factor, value.imaginary * factor);
}

function times(...values: readonly ComplexNumber[]): ComplexNumber {
  return values.reduce((product, value) => complexMultiply(product, value), complex(1));
}

function sum(values: readonly ComplexNumber[]): ComplexNumber {
  return values.reduce((total, value) => complexAdd(total, value), complex(0));
}

function negligible(value: ComplexNumber): boolean {
  return Math.hypot(value.real, value.imaginary) < NEGLIGIBLE_COUPLING;
}

function leg(particle: ParticleName, color = 0): VertexLeg {
  return { particle, color };
}

function anti(particle: ParticleName): ParticleName {
  return particleSpec(particle).antiparticleName;
}

function isQuark(particle: ParticleName): boolean {
  return particleSpec(particle).family === 'quark';
}

function colorsOf(particle: ParticleName): number {
  return isQuark(particle) ? COLORS_IN_TRIPLET : 1;
}

function combinationsWithRepetition<T>(items: readonly T[], size: number): T[][] {
  if (size === 0) {
    return [[]];
  }
  return items.flatMap((item, index) =>
    combinationsWithRepetition(items.slice(index), size - 1).map((rest) => [item, ...rest]),
  );
}

class Derivation {
  private readonly components: Readonly<Record<ElectroweakBoson, readonly ComplexNumber[]>>;
  private readonly couplings: readonly number[];

  constructor(private readonly parameters: StandardModelParameters) {
    this.components = electroweakComponents(parameters.sineWeak, parameters.cosineWeak);
    this.couplings = [
      parameters.weakCoupling,
      parameters.weakCoupling,
      parameters.weakCoupling,
      parameters.hyperchargeCoupling,
    ];
  }

  vertices(): readonly Vertex[] {
    return [
      ...this.neutralCurrents(),
      ...this.chargedCurrents(),
      ...this.colorCurrents(),
      ...this.yukawa(),
      ...this.electroweakTriple(),
      ...this.electroweakQuartic(),
      ...this.gluonTriple(),
      ...this.gluonQuartic(),
      ...this.higgsGauge(),
      ...this.higgsSelf(),
    ];
  }

  masses(): DerivedMasses {
    const quadratic = this.higgsQuadraticForm();
    const vacuum = this.parameters.vacuumExpectationValueInGev;
    const plusMinus = complexAdd(quadratic('wPlus', 'wMinus'), quadratic('wMinus', 'wPlus')).real;
    const potential = this.potentialCoefficients();
    return {
      wMassInGev: Math.sqrt(0.5 * vacuum * vacuum * plusMinus),
      zMassInGev: Math.sqrt(vacuum * vacuum * quadratic('zBoson', 'zBoson').real),
      photonMassInGev: negligible(quadratic('photon', 'photon'))
        ? 0
        : Math.sqrt(Math.max(vacuum * vacuum * quadratic('photon', 'photon').real, 0)),
      higgsMassInGev: Math.sqrt(-2 * (potential[2] ?? 0)),
      higgsTadpole: potential[1] ?? 0,
    };
  }

  private gaugeMatrix(component: number): ComplexMatrix {
    if (component === HYPERCHARGE_COMPONENT) {
      return scaleMatrix(
        identityMatrix(2),
        this.parameters.hyperchargeCoupling * (this.parameters.higgsDoubletHypercharge / 2),
      );
    }
    return scaleMatrix(WEAK_GENERATORS[component] as ComplexMatrix, this.parameters.weakCoupling);
  }

  private component(boson: ElectroweakBoson, index: number): ComplexNumber {
    return this.components[boson][index] ?? complex(0);
  }

  private leftCoupling(
    upperOrLower: number,
    target: number,
    hypercharge: number,
    boson: ElectroweakBoson,
  ): ComplexNumber {
    const weak = [0, 1, 2].map((index) =>
      scaled(
        times(
          entryAt(WEAK_GENERATORS[index] as ComplexMatrix, upperOrLower, target),
          this.component(boson, index),
        ),
        this.parameters.weakCoupling,
      ),
    );
    const hyperchargePart =
      upperOrLower === target
        ? scaled(
            this.component(boson, HYPERCHARGE_COMPONENT),
            this.parameters.hyperchargeCoupling * (hypercharge / 2),
          )
        : complex(0);
    return times(IMAGINARY, sum([...weak, hyperchargePart]));
  }

  private neutralCurrents(): Vertex[] {
    const neutral: readonly ElectroweakBoson[] = ['photon', 'zBoson'];
    return DIRAC_FERMIONS.flatMap((fermion) => {
      const spec = particleSpec(fermion);
      const position = spec.weakIsospinThirdComponent.leftHanded > 0 ? UPPER : LOWER;
      const rightHypercharge = spec.weakHypercharge.rightHanded;
      return neutral.flatMap((boson) => {
        const left = this.leftCoupling(position, position, spec.weakHypercharge.leftHanded, boson);
        const right =
          rightHypercharge === null
            ? complex(0)
            : times(
                IMAGINARY,
                scaled(
                  this.component(boson, HYPERCHARGE_COMPONENT),
                  this.parameters.hyperchargeCoupling * (rightHypercharge / 2),
                ),
              );
        if (negligible(left) && negligible(right)) {
          return [];
        }
        return Array.from({ length: colorsOf(fermion) }, (ignored, color) => ({
          structure: 'fermionFermionVector' as const,
          legs: [leg(anti(fermion), color), leg(fermion, color), leg(boson)],
          factors: [left, right],
        }));
      });
    });
  }

  private chargedCurrents(): Vertex[] {
    const charged: readonly ElectroweakBoson[] = ['wPlus', 'wMinus'];
    return FERMION_MULTIPLETS.filter(
      (multiplet) => multiplet.weakRepresentation === 'doublet',
    ).flatMap((multiplet) =>
      multiplet.generations.flatMap((upperGeneration, upperIndex) =>
        multiplet.generations.flatMap((lowerGeneration, lowerIndex) => {
          const upper = upperGeneration[UPPER] as ParticleName;
          const lower = lowerGeneration[LOWER] as ParticleName;
          const mixing =
            multiplet.mixing === 'ckm'
              ? (this.parameters.ckm[upperIndex]?.[lowerIndex] ?? complex(0))
              : complex(upperIndex === lowerIndex ? 1 : 0);
          if (negligible(mixing)) {
            return [];
          }
          return charged.flatMap((boson) => {
            const raising = times(this.leftCoupling(UPPER, LOWER, 0, boson), mixing);
            const lowering = times(
              this.leftCoupling(LOWER, UPPER, 0, boson),
              complexConjugate(mixing),
            );
            return Array.from({ length: colorsOf(upper) }, (ignored, color) => [
              ...(negligible(raising)
                ? []
                : [
                    {
                      structure: 'fermionFermionVector' as const,
                      legs: [leg(anti(upper), color), leg(lower, color), leg(boson)],
                      factors: [raising, complex(0)],
                    },
                  ]),
              ...(negligible(lowering)
                ? []
                : [
                    {
                      structure: 'fermionFermionVector' as const,
                      legs: [leg(anti(lower), color), leg(upper, color), leg(boson)],
                      factors: [lowering, complex(0)],
                    },
                  ]),
            ]).flat();
          });
        }),
      ),
    );
  }

  private colorCurrents(): Vertex[] {
    return DIRAC_FERMIONS.filter(isQuark).flatMap((quark) =>
      COLOR_GENERATORS.flatMap((generator, gluonColor) =>
        Array.from({ length: COLORS_IN_TRIPLET }, (ignored, row) =>
          Array.from({ length: COLORS_IN_TRIPLET }, (unused, column) => {
            const factor = times(
              IMAGINARY,
              scaled(entryAt(generator, row, column), this.parameters.strongCoupling),
            );
            return negligible(factor)
              ? []
              : [
                  {
                    structure: 'fermionFermionVector' as const,
                    legs: [leg(anti(quark), row), leg(quark, column), leg(GLUON, gluonColor)],
                    factors: [factor, factor],
                  },
                ];
          }).flat(),
        ).flat(),
      ),
    );
  }

  private yukawa(): Vertex[] {
    return DIRAC_FERMIONS.flatMap((fermion) => {
      const mass = this.parameters.massesInGev[fermion] ?? 0;
      if (mass === 0) {
        return [];
      }
      const yukawa = (Math.SQRT2 * mass) / this.parameters.vacuumExpectationValueInGev;
      const factor = times(IMAGINARY, complex(-yukawa / Math.SQRT2));
      return Array.from({ length: colorsOf(fermion) }, (ignored, color) => ({
        structure: 'fermionFermionScalar' as const,
        legs: [leg(anti(fermion), color), leg(fermion, color), leg(HIGGS)],
        factors: [factor],
      }));
    });
  }

  private structureContraction(first: ElectroweakBoson, second: ElectroweakBoson): ComplexNumber[] {
    return [0, 1, 2].map((gaugeIndex) =>
      sum(
        [0, 1, 2].flatMap((firstIndex) =>
          [0, 1, 2].map((secondIndex) =>
            scaled(
              times(this.component(first, firstIndex), this.component(second, secondIndex)),
              WEAK_STRUCTURE_CONSTANTS[firstIndex]?.[secondIndex]?.[gaugeIndex] ?? 0,
            ),
          ),
        ),
      ),
    );
  }

  private electroweakTriple(): Vertex[] {
    return combinationsWithRepetition(ELECTROWEAK_BOSONS, 3).flatMap(([first, second, third]) => {
      if (first === undefined || second === undefined || third === undefined) {
        return [];
      }
      const contraction = this.structureContraction(first, second);
      const factor = scaled(
        sum(contraction.map((value, index) => times(value, this.component(third, index)))),
        this.parameters.weakCoupling,
      );
      return negligible(factor)
        ? []
        : [
            {
              structure: 'tripleGauge' as const,
              legs: [leg(first), leg(second), leg(third)],
              factors: [factor],
            },
          ];
    });
  }

  private quarticFactors(
    pair: (first: number, second: number) => readonly ComplexNumber[],
    coupling: number,
  ): readonly ComplexNumber[] {
    const product = (
      firstLeg: number,
      secondLeg: number,
      thirdLeg: number,
      fourthLeg: number,
    ): ComplexNumber =>
      sum(
        pair(firstLeg, secondLeg).map((value, index) =>
          times(value, pair(thirdLeg, fourthLeg)[index] ?? complex(0)),
        ),
      );
    const s1234 = product(0, 1, 2, 3);
    const s1324 = product(0, 2, 1, 3);
    const s1423 = product(0, 3, 1, 2);
    const prefactor = complex(0, -coupling * coupling);
    return [
      times(prefactor, complexAdd(s1324, s1423)),
      times(prefactor, complexAdd(s1234, scaled(s1423, -1))),
      times(prefactor, scaled(complexAdd(s1234, s1324), -1)),
    ];
  }

  private electroweakQuartic(): Vertex[] {
    return combinationsWithRepetition(ELECTROWEAK_BOSONS, 4).flatMap((bosons) => {
      const factors = this.quarticFactors(
        (first, second) =>
          this.structureContraction(
            bosons[first] as ElectroweakBoson,
            bosons[second] as ElectroweakBoson,
          ),
        this.parameters.weakCoupling,
      );
      return factors.every(negligible)
        ? []
        : [
            {
              structure: 'quarticGauge' as const,
              legs: bosons.map((boson) => leg(boson)),
              factors,
            },
          ];
    });
  }

  private gluonTriple(): Vertex[] {
    const colors = Array.from({ length: COLORS_IN_OCTET }, (ignored, index) => index);
    return combinationsWithRepetition(colors, 3).flatMap(([first, second, third]) => {
      const constant = COLOR_STRUCTURE_CONSTANTS[first ?? 0]?.[second ?? 0]?.[third ?? 0] ?? 0;
      return constant === 0
        ? []
        : [
            {
              structure: 'tripleGauge' as const,
              legs: [leg(GLUON, first), leg(GLUON, second), leg(GLUON, third)],
              factors: [complex(this.parameters.strongCoupling * constant)],
            },
          ];
    });
  }

  private gluonQuartic(): Vertex[] {
    const colors = Array.from({ length: COLORS_IN_OCTET }, (ignored, index) => index);
    return combinationsWithRepetition(colors, 4).flatMap((quartet) => {
      const factors = this.quarticFactors(
        (first, second) =>
          colors.map((gaugeIndex) =>
            complex(
              COLOR_STRUCTURE_CONSTANTS[quartet[first] ?? 0]?.[quartet[second] ?? 0]?.[
                gaugeIndex
              ] ?? 0,
            ),
          ),
        this.parameters.strongCoupling,
      );
      return factors.every(negligible)
        ? []
        : [
            {
              structure: 'quarticGauge' as const,
              legs: quartet.map((color) => leg(GLUON, color)),
              factors,
            },
          ];
    });
  }

  private higgsQuadraticForm(): (
    first: ElectroweakBoson,
    second: ElectroweakBoson,
  ) => ComplexNumber {
    const matrices = Array.from({ length: ELECTROWEAK_GAUGE_COMPONENTS }, (ignored, index) =>
      this.gaugeMatrix(index),
    );
    return (first, second) =>
      sum(
        matrices.flatMap((firstMatrix, firstIndex) =>
          matrices.map((secondMatrix, secondIndex) =>
            times(
              entryAt(multiplyMatrices(firstMatrix, secondMatrix), LOWER, LOWER),
              this.component(first, firstIndex),
              this.component(second, secondIndex),
            ),
          ),
        ),
      );
  }

  private higgsGauge(): Vertex[] {
    const quadratic = this.higgsQuadraticForm();
    const vacuum = this.parameters.vacuumExpectationValueInGev;
    return combinationsWithRepetition(ELECTROWEAK_BOSONS, 2).flatMap(([first, second]) => {
      if (first === undefined || second === undefined) {
        return [];
      }
      const symmetric = complexAdd(quadratic(first, second), quadratic(second, first));
      if (negligible(symmetric)) {
        return [];
      }
      return [
        {
          structure: 'vectorVectorScalar' as const,
          legs: [leg(first), leg(second), leg(HIGGS)],
          factors: [times(IMAGINARY, scaled(symmetric, vacuum))],
        },
        {
          structure: 'vectorVectorScalarScalar' as const,
          legs: [leg(first), leg(second), leg(HIGGS), leg(HIGGS)],
          factors: [times(IMAGINARY, symmetric)],
        },
      ];
    });
  }

  private potentialCoefficients(): readonly number[] {
    const vacuum = this.parameters.vacuumExpectationValueInGev;
    const quartic = this.parameters.higgsQuartic;
    const quadratic = quartic * vacuum * vacuum;
    const binomial = (total: number, chosen: number): number =>
      chosen < 0 || chosen > total
        ? 0
        : Array.from({ length: chosen }, (ignored, index) => (total - index) / (index + 1)).reduce(
            (product, value) => product * value,
            1,
          );
    const fieldPower = (power: number, order: number): number =>
      (binomial(power, order) * vacuum ** (power - order)) / 2 ** (power / 2);
    return [0, 1, 2, 3, 4].map(
      (order) => quadratic * fieldPower(2, order) - quartic * fieldPower(4, order),
    );
  }

  private higgsSelf(): Vertex[] {
    const coefficients = this.potentialCoefficients();
    const factorial = (value: number): number => (value <= 1 ? 1 : value * factorial(value - 1));
    return [
      {
        structure: 'tripleScalar',
        legs: [leg(HIGGS), leg(HIGGS), leg(HIGGS)],
        factors: [times(IMAGINARY, complex(factorial(3) * (coefficients[3] ?? 0)))],
      },
      {
        structure: 'quarticScalar',
        legs: [leg(HIGGS), leg(HIGGS), leg(HIGGS), leg(HIGGS)],
        factors: [times(IMAGINARY, complex(factorial(4) * (coefficients[4] ?? 0)))],
      },
    ];
  }
}

export function deriveLagrangian(parameters: StandardModelParameters): DerivedLagrangian {
  const derivation = new Derivation(parameters);
  return { vertices: derivation.vertices(), masses: derivation.masses() };
}
