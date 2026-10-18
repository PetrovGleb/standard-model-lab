/* Numerical Dirac algebra in the Dirac representation: complex spinors, four-vectors with upper indices, γ matrices, chiral projectors, slashed vectors and the Minkowski product; arrays interleave real and imaginary parts. */

export type ComplexPair = Float64Array;
export type Spinor = Float64Array;
export type ComplexFourVector = Float64Array;
export type DiracMatrix = Float64Array;

export const SPINOR_COMPONENTS = 4;
const MATRIX_ENTRIES = SPINOR_COMPONENTS * SPINOR_COMPONENTS;
const METRIC = [1, -1, -1, -1] as const;

export function complexPair(real: number, imaginary = 0): ComplexPair {
  return Float64Array.of(real, imaginary);
}

export function pairMultiply(first: ComplexPair, second: ComplexPair): ComplexPair {
  const firstReal = first[0] ?? 0;
  const firstImaginary = first[1] ?? 0;
  const secondReal = second[0] ?? 0;
  const secondImaginary = second[1] ?? 0;
  return complexPair(
    firstReal * secondReal - firstImaginary * secondImaginary,
    firstReal * secondImaginary + firstImaginary * secondReal,
  );
}

export function pairDivide(numerator: ComplexPair, denominator: ComplexPair): ComplexPair {
  const real = denominator[0] ?? 0;
  const imaginary = denominator[1] ?? 0;
  const norm = real * real + imaginary * imaginary;
  return pairMultiply(numerator, complexPair(real / norm, -imaginary / norm));
}

export function scaleArray(values: Float64Array, factor: ComplexPair): Float64Array {
  const real = factor[0] ?? 0;
  const imaginary = factor[1] ?? 0;
  const result = new Float64Array(values.length);
  for (let index = 0; index < values.length; index += 2) {
    const valueReal = values[index] ?? 0;
    const valueImaginary = values[index + 1] ?? 0;
    result[index] = valueReal * real - valueImaginary * imaginary;
    result[index + 1] = valueReal * imaginary + valueImaginary * real;
  }
  return result;
}

export function addArrays(first: Float64Array, second: Float64Array): Float64Array {
  const result = new Float64Array(first.length);
  for (let index = 0; index < first.length; index += 1) {
    result[index] = (first[index] ?? 0) + (second[index] ?? 0);
  }
  return result;
}

export function accumulate(target: Float64Array, addition: Float64Array): void {
  for (let index = 0; index < target.length; index += 1) {
    target[index] = (target[index] ?? 0) + (addition[index] ?? 0);
  }
}

export function conjugateArray(values: Float64Array): Float64Array {
  const result = Float64Array.from(values);
  for (let index = 1; index < result.length; index += 2) {
    result[index] = -(result[index] ?? 0);
  }
  return result;
}

export function minkowskiProduct(first: ComplexFourVector, second: ComplexFourVector): ComplexPair {
  let real = 0;
  let imaginary = 0;
  for (let component = 0; component < SPINOR_COMPONENTS; component += 1) {
    const sign = METRIC[component] ?? 0;
    const firstReal = first[2 * component] ?? 0;
    const firstImaginary = first[2 * component + 1] ?? 0;
    const secondReal = second[2 * component] ?? 0;
    const secondImaginary = second[2 * component + 1] ?? 0;
    real += sign * (firstReal * secondReal - firstImaginary * secondImaginary);
    imaginary += sign * (firstReal * secondImaginary + firstImaginary * secondReal);
  }
  return complexPair(real, imaginary);
}

export function realFourVector(components: readonly number[]): ComplexFourVector {
  const result = new Float64Array(2 * SPINOR_COMPONENTS);
  components.forEach((value, index) => {
    result[2 * index] = value;
  });
  return result;
}

export function realMinkowskiSquare(momentum: readonly number[]): number {
  const [energy = 0, x = 0, y = 0, z = 0] = momentum;
  return energy * energy - x * x - y * y - z * z;
}

function matrix(
  rows: ReadonlyArray<ReadonlyArray<readonly [number, number] | number>>,
): DiracMatrix {
  const result = new Float64Array(2 * MATRIX_ENTRIES);
  rows.forEach((row, rowIndex) =>
    row.forEach((entry, columnIndex) => {
      const offset = 2 * (rowIndex * SPINOR_COMPONENTS + columnIndex);
      if (typeof entry === 'number') {
        result[offset] = entry;
      } else {
        result[offset] = entry[0];
        result[offset + 1] = entry[1];
      }
    }),
  );
  return result;
}

const IMAGINARY: readonly [number, number] = [0, 1];
const MINUS_I: readonly [number, number] = [0, -1];

export const GAMMA: readonly DiracMatrix[] = [
  matrix([
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, -1, 0],
    [0, 0, 0, -1],
  ]),
  matrix([
    [0, 0, 0, 1],
    [0, 0, 1, 0],
    [0, -1, 0, 0],
    [-1, 0, 0, 0],
  ]),
  matrix([
    [0, 0, 0, MINUS_I],
    [0, 0, IMAGINARY, 0],
    [0, IMAGINARY, 0, 0],
    [MINUS_I, 0, 0, 0],
  ]),
  matrix([
    [0, 0, 1, 0],
    [0, 0, 0, -1],
    [-1, 0, 0, 0],
    [0, 1, 0, 0],
  ]),
];

export const GAMMA_FIVE = matrix([
  [0, 0, 1, 0],
  [0, 0, 0, 1],
  [1, 0, 0, 0],
  [0, 1, 0, 0],
]);

export const IDENTITY = matrix([
  [1, 0, 0, 0],
  [0, 1, 0, 0],
  [0, 0, 1, 0],
  [0, 0, 0, 1],
]);

export const LEFT_PROJECTOR = scaleArray(
  addArrays(IDENTITY, scaleArray(GAMMA_FIVE, complexPair(-1))),
  complexPair(0.5),
);
export const RIGHT_PROJECTOR = scaleArray(addArrays(IDENTITY, GAMMA_FIVE), complexPair(0.5));

export function slash(vector: ComplexFourVector): DiracMatrix {
  let result: Float64Array = new Float64Array(2 * MATRIX_ENTRIES);
  for (let component = 0; component < SPINOR_COMPONENTS; component += 1) {
    const sign = METRIC[component] ?? 0;
    const coefficient = complexPair(
      sign * (vector[2 * component] ?? 0),
      sign * (vector[2 * component + 1] ?? 0),
    );
    result = addArrays(result, scaleArray(GAMMA[component] as DiracMatrix, coefficient));
  }
  return result;
}

export function chiralCoupling(left: ComplexPair, right: ComplexPair): DiracMatrix {
  return addArrays(scaleArray(LEFT_PROJECTOR, left), scaleArray(RIGHT_PROJECTOR, right));
}

export function multiplyDirac(first: DiracMatrix, second: DiracMatrix): DiracMatrix {
  const result = new Float64Array(2 * MATRIX_ENTRIES);
  for (let row = 0; row < SPINOR_COMPONENTS; row += 1) {
    for (let column = 0; column < SPINOR_COMPONENTS; column += 1) {
      let real = 0;
      let imaginary = 0;
      for (let inner = 0; inner < SPINOR_COMPONENTS; inner += 1) {
        const left = 2 * (row * SPINOR_COMPONENTS + inner);
        const right = 2 * (inner * SPINOR_COMPONENTS + column);
        const leftReal = first[left] ?? 0;
        const leftImaginary = first[left + 1] ?? 0;
        const rightReal = second[right] ?? 0;
        const rightImaginary = second[right + 1] ?? 0;
        real += leftReal * rightReal - leftImaginary * rightImaginary;
        imaginary += leftReal * rightImaginary + leftImaginary * rightReal;
      }
      result[2 * (row * SPINOR_COMPONENTS + column)] = real;
      result[2 * (row * SPINOR_COMPONENTS + column) + 1] = imaginary;
    }
  }
  return result;
}

export function matrixTimesColumn(diracMatrix: DiracMatrix, column: Spinor): Spinor {
  const result = new Float64Array(2 * SPINOR_COMPONENTS);
  for (let row = 0; row < SPINOR_COMPONENTS; row += 1) {
    let real = 0;
    let imaginary = 0;
    for (let inner = 0; inner < SPINOR_COMPONENTS; inner += 1) {
      const entry = 2 * (row * SPINOR_COMPONENTS + inner);
      const matrixReal = diracMatrix[entry] ?? 0;
      const matrixImaginary = diracMatrix[entry + 1] ?? 0;
      const valueReal = column[2 * inner] ?? 0;
      const valueImaginary = column[2 * inner + 1] ?? 0;
      real += matrixReal * valueReal - matrixImaginary * valueImaginary;
      imaginary += matrixReal * valueImaginary + matrixImaginary * valueReal;
    }
    result[2 * row] = real;
    result[2 * row + 1] = imaginary;
  }
  return result;
}

export function rowTimesMatrix(row: Spinor, diracMatrix: DiracMatrix): Spinor {
  const result = new Float64Array(2 * SPINOR_COMPONENTS);
  for (let column = 0; column < SPINOR_COMPONENTS; column += 1) {
    let real = 0;
    let imaginary = 0;
    for (let inner = 0; inner < SPINOR_COMPONENTS; inner += 1) {
      const entry = 2 * (inner * SPINOR_COMPONENTS + column);
      const matrixReal = diracMatrix[entry] ?? 0;
      const matrixImaginary = diracMatrix[entry + 1] ?? 0;
      const valueReal = row[2 * inner] ?? 0;
      const valueImaginary = row[2 * inner + 1] ?? 0;
      real += valueReal * matrixReal - valueImaginary * matrixImaginary;
      imaginary += valueReal * matrixImaginary + valueImaginary * matrixReal;
    }
    result[2 * column] = real;
    result[2 * column + 1] = imaginary;
  }
  return result;
}

export function rowTimesColumn(row: Spinor, column: Spinor): ComplexPair {
  let real = 0;
  let imaginary = 0;
  for (let index = 0; index < SPINOR_COMPONENTS; index += 1) {
    const rowReal = row[2 * index] ?? 0;
    const rowImaginary = row[2 * index + 1] ?? 0;
    const columnReal = column[2 * index] ?? 0;
    const columnImaginary = column[2 * index + 1] ?? 0;
    real += rowReal * columnReal - rowImaginary * columnImaginary;
    imaginary += rowReal * columnImaginary + rowImaginary * columnReal;
  }
  return complexPair(real, imaginary);
}

export function diracAdjoint(column: Spinor): Spinor {
  return rowTimesMatrix(conjugateArray(column), GAMMA[0] as DiracMatrix);
}

function sigmaDot(
  vector: ComplexFourVector,
  upperReal: number,
  upperImaginary: number,
  lowerReal: number,
  lowerImaginary: number,
): readonly [number, number, number, number] {
  const xReal = vector[2] ?? 0;
  const xImaginary = vector[3] ?? 0;
  const yReal = vector[4] ?? 0;
  const yImaginary = vector[5] ?? 0;
  const zReal = vector[6] ?? 0;
  const zImaginary = vector[7] ?? 0;
  const minusReal = xReal + yImaginary;
  const minusImaginary = xImaginary - yReal;
  const plusReal = xReal - yImaginary;
  const plusImaginary = xImaginary + yReal;
  return [
    zReal * upperReal -
      zImaginary * upperImaginary +
      minusReal * lowerReal -
      minusImaginary * lowerImaginary,
    zReal * upperImaginary +
      zImaginary * upperReal +
      minusReal * lowerImaginary +
      minusImaginary * lowerReal,
    plusReal * upperReal -
      plusImaginary * upperImaginary -
      (zReal * lowerReal - zImaginary * lowerImaginary),
    plusReal * upperImaginary +
      plusImaginary * upperReal -
      (zReal * lowerImaginary + zImaginary * lowerReal),
  ];
}

function sigmaDotRow(
  vector: ComplexFourVector,
  firstReal: number,
  firstImaginary: number,
  secondReal: number,
  secondImaginary: number,
): readonly [number, number, number, number] {
  const xReal = vector[2] ?? 0;
  const xImaginary = vector[3] ?? 0;
  const yReal = vector[4] ?? 0;
  const yImaginary = vector[5] ?? 0;
  const zReal = vector[6] ?? 0;
  const zImaginary = vector[7] ?? 0;
  const minusReal = xReal + yImaginary;
  const minusImaginary = xImaginary - yReal;
  const plusReal = xReal - yImaginary;
  const plusImaginary = xImaginary + yReal;
  return [
    firstReal * zReal -
      firstImaginary * zImaginary +
      secondReal * plusReal -
      secondImaginary * plusImaginary,
    firstReal * zImaginary +
      firstImaginary * zReal +
      secondReal * plusImaginary +
      secondImaginary * plusReal,
    firstReal * minusReal -
      firstImaginary * minusImaginary -
      (secondReal * zReal - secondImaginary * zImaginary),
    firstReal * minusImaginary +
      firstImaginary * minusReal -
      (secondReal * zImaginary + secondImaginary * zReal),
  ];
}

export function slashColumn(vector: ComplexFourVector, column: Spinor): Spinor {
  const timeReal = vector[0] ?? 0;
  const timeImaginary = vector[1] ?? 0;
  const [u0r = 0, u0i = 0, u1r = 0, u1i = 0, l0r = 0, l0i = 0, l1r = 0, l1i = 0] = column;
  const lower = sigmaDot(vector, l0r, l0i, l1r, l1i);
  const upper = sigmaDot(vector, u0r, u0i, u1r, u1i);
  return Float64Array.of(
    timeReal * u0r - timeImaginary * u0i - lower[0],
    timeReal * u0i + timeImaginary * u0r - lower[1],
    timeReal * u1r - timeImaginary * u1i - lower[2],
    timeReal * u1i + timeImaginary * u1r - lower[3],
    upper[0] - (timeReal * l0r - timeImaginary * l0i),
    upper[1] - (timeReal * l0i + timeImaginary * l0r),
    upper[2] - (timeReal * l1r - timeImaginary * l1i),
    upper[3] - (timeReal * l1i + timeImaginary * l1r),
  );
}

export function slashRow(row: Spinor, vector: ComplexFourVector): Spinor {
  const timeReal = vector[0] ?? 0;
  const timeImaginary = vector[1] ?? 0;
  const [u0r = 0, u0i = 0, u1r = 0, u1i = 0, l0r = 0, l0i = 0, l1r = 0, l1i = 0] = row;
  const fromLower = sigmaDotRow(vector, l0r, l0i, l1r, l1i);
  const fromUpper = sigmaDotRow(vector, u0r, u0i, u1r, u1i);
  return Float64Array.of(
    timeReal * u0r - timeImaginary * u0i + fromLower[0],
    timeReal * u0i + timeImaginary * u0r + fromLower[1],
    timeReal * u1r - timeImaginary * u1i + fromLower[2],
    timeReal * u1i + timeImaginary * u1r + fromLower[3],
    -fromUpper[0] - (timeReal * l0r - timeImaginary * l0i),
    -fromUpper[1] - (timeReal * l0i + timeImaginary * l0r),
    -fromUpper[2] - (timeReal * l1r - timeImaginary * l1i),
    -fromUpper[3] - (timeReal * l1i + timeImaginary * l1r),
  );
}

export function chiralApply(spinor: Spinor, left: ComplexPair, right: ComplexPair): Spinor {
  const sumReal = ((left[0] ?? 0) + (right[0] ?? 0)) / 2;
  const sumImaginary = ((left[1] ?? 0) + (right[1] ?? 0)) / 2;
  const differenceReal = ((right[0] ?? 0) - (left[0] ?? 0)) / 2;
  const differenceImaginary = ((right[1] ?? 0) - (left[1] ?? 0)) / 2;
  const result = new Float64Array(2 * SPINOR_COMPONENTS);
  for (let component = 0; component < 2; component += 1) {
    const upperReal = spinor[2 * component] ?? 0;
    const upperImaginary = spinor[2 * component + 1] ?? 0;
    const lowerReal = spinor[2 * component + 4] ?? 0;
    const lowerImaginary = spinor[2 * component + 5] ?? 0;
    result[2 * component] =
      sumReal * upperReal -
      sumImaginary * upperImaginary +
      differenceReal * lowerReal -
      differenceImaginary * lowerImaginary;
    result[2 * component + 1] =
      sumReal * upperImaginary +
      sumImaginary * upperReal +
      differenceReal * lowerImaginary +
      differenceImaginary * lowerReal;
    result[2 * component + 4] =
      differenceReal * upperReal -
      differenceImaginary * upperImaginary +
      sumReal * lowerReal -
      sumImaginary * lowerImaginary;
    result[2 * component + 5] =
      differenceReal * upperImaginary +
      differenceImaginary * upperReal +
      sumReal * lowerImaginary +
      sumImaginary * lowerReal;
  }
  return result;
}

export function vectorCurrent(row: Spinor, column: Spinor): ComplexFourVector {
  const result = new Float64Array(2 * SPINOR_COMPONENTS);
  const product = (
    firstReal: number,
    firstImaginary: number,
    secondReal: number,
    secondImaginary: number,
  ): readonly [number, number] => [
    firstReal * secondReal - firstImaginary * secondImaginary,
    firstReal * secondImaginary + firstImaginary * secondReal,
  ];
  const [r0r = 0, r0i = 0, r1r = 0, r1i = 0, r2r = 0, r2i = 0, r3r = 0, r3i = 0] = row;
  const [c0r = 0, c0i = 0, c1r = 0, c1i = 0, c2r = 0, c2i = 0, c3r = 0, c3i = 0] = column;
  const terms = (
    pairs: ReadonlyArray<readonly [number, number, number, number, number]>,
  ): readonly [number, number] =>
    pairs.reduce<readonly [number, number]>(
      (total, [factor, firstReal, firstImaginary, secondReal, secondImaginary]) => {
        const value = product(firstReal, firstImaginary, secondReal, secondImaginary);
        return [total[0] + factor * value[0], total[1] + factor * value[1]];
      },
      [0, 0],
    );
  const time = terms([
    [1, r0r, r0i, c0r, c0i],
    [1, r1r, r1i, c1r, c1i],
    [-1, r2r, r2i, c2r, c2i],
    [-1, r3r, r3i, c3r, c3i],
  ]);
  const xComponent = terms([
    [1, r0r, r0i, c3r, c3i],
    [1, r1r, r1i, c2r, c2i],
    [-1, r2r, r2i, c1r, c1i],
    [-1, r3r, r3i, c0r, c0i],
  ]);
  const yProduct = terms([
    [1, r0r, r0i, c3r, c3i],
    [-1, r1r, r1i, c2r, c2i],
    [-1, r2r, r2i, c1r, c1i],
    [1, r3r, r3i, c0r, c0i],
  ]);
  const zComponent = terms([
    [1, r0r, r0i, c2r, c2i],
    [-1, r1r, r1i, c3r, c3i],
    [-1, r2r, r2i, c0r, c0i],
    [1, r3r, r3i, c1r, c1i],
  ]);
  result[0] = time[0];
  result[1] = time[1];
  result[2] = xComponent[0];
  result[3] = xComponent[1];
  result[4] = yProduct[1];
  result[5] = -yProduct[0];
  result[6] = zComponent[0];
  result[7] = zComponent[1];
  return result;
}
