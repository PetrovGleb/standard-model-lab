/* Minimal complex linear algebra on typed arrays: matrices, Kronecker products, adjoints and a Hermitian spectral decomposition through a real symmetric Jacobi solver. */
export interface ComplexNumber {
  readonly real: number;
  readonly imaginary: number;
}

export interface ComplexMatrix {
  readonly rows: number;
  readonly columns: number;
  readonly real: Float64Array;
  readonly imaginary: Float64Array;
}

export interface SpectralComponent {
  readonly eigenvalue: number;
  readonly multiplicity: number;
  readonly projector: ComplexMatrix;
}

export const COMPLEX_ZERO: ComplexNumber = { real: 0, imaginary: 0 };
export const COMPLEX_ONE: ComplexNumber = { real: 1, imaginary: 0 };
export const IMAGINARY_UNIT: ComplexNumber = { real: 0, imaginary: 1 };

const JACOBI_MAX_SWEEPS = 100;
const JACOBI_RELATIVE_CONVERGENCE = 1e-15;
const EIGENVALUE_GROUPING_TOLERANCE = 1e-9;
const EIGENVALUE_SIGNIFICANT_DIGITS = 12;

function roundEigenvalue(value: number, zeroThreshold: number): number {
  if (Math.abs(value) <= zeroThreshold) {
    return 0;
  }
  return Number(value.toPrecision(EIGENVALUE_SIGNIFICANT_DIGITS));
}

export function complex(real: number, imaginary = 0): ComplexNumber {
  return { real, imaginary };
}

export function complexPhase(angleRadians: number): ComplexNumber {
  return { real: Math.cos(angleRadians), imaginary: Math.sin(angleRadians) };
}

export function complexAdd(first: ComplexNumber, second: ComplexNumber): ComplexNumber {
  return { real: first.real + second.real, imaginary: first.imaginary + second.imaginary };
}

export function complexMultiply(first: ComplexNumber, second: ComplexNumber): ComplexNumber {
  return {
    real: first.real * second.real - first.imaginary * second.imaginary,
    imaginary: first.real * second.imaginary + first.imaginary * second.real,
  };
}

export function complexConjugate(value: ComplexNumber): ComplexNumber {
  return { real: value.real, imaginary: -value.imaginary };
}

export function complexAbsSquared(value: ComplexNumber): number {
  return value.real * value.real + value.imaginary * value.imaginary;
}

function toComplex(value: ComplexNumber | number): ComplexNumber {
  return typeof value === 'number' ? { real: value, imaginary: 0 } : value;
}

export function zeroMatrix(rows: number, columns: number): ComplexMatrix {
  return {
    rows,
    columns,
    real: new Float64Array(rows * columns),
    imaginary: new Float64Array(rows * columns),
  };
}

export function matrixFromRows(
  rows: ReadonlyArray<ReadonlyArray<ComplexNumber | number>>,
): ComplexMatrix {
  const rowCount = rows.length;
  const columnCount = rows[0]?.length ?? 0;
  const result = zeroMatrix(rowCount, columnCount);
  rows.forEach((row, rowIndex) => {
    if (row.length !== columnCount) {
      throw new Error('All rows must have the same length');
    }
    row.forEach((value, columnIndex) => {
      const entry = toComplex(value);
      result.real[rowIndex * columnCount + columnIndex] = entry.real;
      result.imaginary[rowIndex * columnCount + columnIndex] = entry.imaginary;
    });
  });
  return result;
}

export function columnVector(entries: ReadonlyArray<ComplexNumber | number>): ComplexMatrix {
  return matrixFromRows(entries.map((entry) => [entry]));
}

export function identityMatrix(dimension: number): ComplexMatrix {
  const result = zeroMatrix(dimension, dimension);
  for (let index = 0; index < dimension; index += 1) {
    result.real[index * dimension + index] = 1;
  }
  return result;
}

export function entryAt(matrix: ComplexMatrix, row: number, column: number): ComplexNumber {
  const offset = row * matrix.columns + column;
  return { real: matrix.real[offset] ?? 0, imaginary: matrix.imaginary[offset] ?? 0 };
}

export function scaleMatrix(matrix: ComplexMatrix, scalar: ComplexNumber | number): ComplexMatrix {
  const factor = toComplex(scalar);
  const result = zeroMatrix(matrix.rows, matrix.columns);
  for (let index = 0; index < matrix.real.length; index += 1) {
    const real = matrix.real[index] ?? 0;
    const imaginary = matrix.imaginary[index] ?? 0;
    result.real[index] = real * factor.real - imaginary * factor.imaginary;
    result.imaginary[index] = real * factor.imaginary + imaginary * factor.real;
  }
  return result;
}

function combineMatrices(first: ComplexMatrix, second: ComplexMatrix, sign: number): ComplexMatrix {
  if (first.rows !== second.rows || first.columns !== second.columns) {
    throw new Error('Matrix shapes differ');
  }
  const result = zeroMatrix(first.rows, first.columns);
  for (let index = 0; index < first.real.length; index += 1) {
    result.real[index] = (first.real[index] ?? 0) + sign * (second.real[index] ?? 0);
    result.imaginary[index] = (first.imaginary[index] ?? 0) + sign * (second.imaginary[index] ?? 0);
  }
  return result;
}

export function addMatrices(first: ComplexMatrix, second: ComplexMatrix): ComplexMatrix {
  return combineMatrices(first, second, 1);
}

export function subtractMatrices(first: ComplexMatrix, second: ComplexMatrix): ComplexMatrix {
  return combineMatrices(first, second, -1);
}

export function multiplyMatrices(first: ComplexMatrix, second: ComplexMatrix): ComplexMatrix {
  if (first.columns !== second.rows) {
    throw new Error(
      `Cannot multiply ${String(first.rows)}x${String(first.columns)} by ${String(second.rows)}x${String(second.columns)}`,
    );
  }
  const result = zeroMatrix(first.rows, second.columns);
  for (let row = 0; row < first.rows; row += 1) {
    for (let inner = 0; inner < first.columns; inner += 1) {
      const leftReal = first.real[row * first.columns + inner] ?? 0;
      const leftImaginary = first.imaginary[row * first.columns + inner] ?? 0;
      if (leftReal === 0 && leftImaginary === 0) {
        continue;
      }
      for (let column = 0; column < second.columns; column += 1) {
        const rightReal = second.real[inner * second.columns + column] ?? 0;
        const rightImaginary = second.imaginary[inner * second.columns + column] ?? 0;
        const target = row * second.columns + column;
        result.real[target] =
          (result.real[target] ?? 0) + leftReal * rightReal - leftImaginary * rightImaginary;
        result.imaginary[target] =
          (result.imaginary[target] ?? 0) + leftReal * rightImaginary + leftImaginary * rightReal;
      }
    }
  }
  return result;
}

export function kroneckerProduct(first: ComplexMatrix, second: ComplexMatrix): ComplexMatrix {
  const result = zeroMatrix(first.rows * second.rows, first.columns * second.columns);
  for (let firstRow = 0; firstRow < first.rows; firstRow += 1) {
    for (let firstColumn = 0; firstColumn < first.columns; firstColumn += 1) {
      const leftReal = first.real[firstRow * first.columns + firstColumn] ?? 0;
      const leftImaginary = first.imaginary[firstRow * first.columns + firstColumn] ?? 0;
      if (leftReal === 0 && leftImaginary === 0) {
        continue;
      }
      for (let secondRow = 0; secondRow < second.rows; secondRow += 1) {
        for (let secondColumn = 0; secondColumn < second.columns; secondColumn += 1) {
          const rightReal = second.real[secondRow * second.columns + secondColumn] ?? 0;
          const rightImaginary = second.imaginary[secondRow * second.columns + secondColumn] ?? 0;
          const row = firstRow * second.rows + secondRow;
          const column = firstColumn * second.columns + secondColumn;
          const target = row * result.columns + column;
          result.real[target] = leftReal * rightReal - leftImaginary * rightImaginary;
          result.imaginary[target] = leftReal * rightImaginary + leftImaginary * rightReal;
        }
      }
    }
  }
  return result;
}

export function adjoint(matrix: ComplexMatrix): ComplexMatrix {
  const result = zeroMatrix(matrix.columns, matrix.rows);
  for (let row = 0; row < matrix.rows; row += 1) {
    for (let column = 0; column < matrix.columns; column += 1) {
      result.real[column * matrix.rows + row] = matrix.real[row * matrix.columns + column] ?? 0;
      result.imaginary[column * matrix.rows + row] = -(
        matrix.imaginary[row * matrix.columns + column] ?? 0
      );
    }
  }
  return result;
}

export function trace(matrix: ComplexMatrix): ComplexNumber {
  let real = 0;
  let imaginary = 0;
  for (let index = 0; index < Math.min(matrix.rows, matrix.columns); index += 1) {
    real += matrix.real[index * matrix.columns + index] ?? 0;
    imaginary += matrix.imaginary[index * matrix.columns + index] ?? 0;
  }
  return { real, imaginary };
}

export function frobeniusNorm(matrix: ComplexMatrix): number {
  let sum = 0;
  for (let index = 0; index < matrix.real.length; index += 1) {
    sum += (matrix.real[index] ?? 0) ** 2 + (matrix.imaginary[index] ?? 0) ** 2;
  }
  return Math.sqrt(sum);
}

export function isHermitian(matrix: ComplexMatrix, tolerance = 1e-12): boolean {
  return (
    matrix.rows === matrix.columns &&
    frobeniusNorm(subtractMatrices(matrix, adjoint(matrix))) < tolerance
  );
}

export function isUnitary(matrix: ComplexMatrix, tolerance = 1e-10): boolean {
  if (matrix.rows !== matrix.columns) {
    return false;
  }
  const product = multiplyMatrices(adjoint(matrix), matrix);
  return frobeniusNorm(subtractMatrices(product, identityMatrix(matrix.rows))) < tolerance;
}

export interface RealSymmetricEigensystem {
  readonly values: Float64Array;
  readonly vectors: Float64Array;
}

export function jacobiEigensystem(input: Float64Array, size: number): RealSymmetricEigensystem {
  const working = Float64Array.from(input);
  const vectors = new Float64Array(size * size);
  for (let index = 0; index < size; index += 1) {
    vectors[index * size + index] = 1;
  }
  let scale = 0;
  for (let index = 0; index < working.length; index += 1) {
    scale += (working[index] ?? 0) ** 2;
  }
  scale = Math.sqrt(scale);
  for (let sweep = 0; sweep < JACOBI_MAX_SWEEPS; sweep += 1) {
    let offDiagonal = 0;
    for (let row = 0; row < size; row += 1) {
      for (let column = row + 1; column < size; column += 1) {
        offDiagonal += (working[row * size + column] ?? 0) ** 2;
      }
    }
    if (Math.sqrt(offDiagonal) <= JACOBI_RELATIVE_CONVERGENCE * (scale + 1)) {
      break;
    }
    for (let row = 0; row < size; row += 1) {
      for (let column = row + 1; column < size; column += 1) {
        const offEntry = working[row * size + column] ?? 0;
        if (Math.abs(offEntry) < Number.MIN_VALUE) {
          continue;
        }
        const diagonalDifference =
          (working[column * size + column] ?? 0) - (working[row * size + row] ?? 0);
        const cotangentOfTwiceAngle = diagonalDifference / (2 * offEntry);
        const sign = cotangentOfTwiceAngle >= 0 ? 1 : -1;
        const tangent =
          sign / (Math.abs(cotangentOfTwiceAngle) + Math.sqrt(cotangentOfTwiceAngle ** 2 + 1));
        const cosine = 1 / Math.sqrt(tangent * tangent + 1);
        const sine = tangent * cosine;
        for (let other = 0; other < size; other += 1) {
          const rowEntry = working[other * size + row] ?? 0;
          const columnEntry = working[other * size + column] ?? 0;
          working[other * size + row] = cosine * rowEntry - sine * columnEntry;
          working[other * size + column] = sine * rowEntry + cosine * columnEntry;
        }
        for (let other = 0; other < size; other += 1) {
          const rowEntry = working[row * size + other] ?? 0;
          const columnEntry = working[column * size + other] ?? 0;
          working[row * size + other] = cosine * rowEntry - sine * columnEntry;
          working[column * size + other] = sine * rowEntry + cosine * columnEntry;
        }
        for (let other = 0; other < size; other += 1) {
          const rowEntry = vectors[other * size + row] ?? 0;
          const columnEntry = vectors[other * size + column] ?? 0;
          vectors[other * size + row] = cosine * rowEntry - sine * columnEntry;
          vectors[other * size + column] = sine * rowEntry + cosine * columnEntry;
        }
      }
    }
  }
  const values = new Float64Array(size);
  for (let index = 0; index < size; index += 1) {
    values[index] = working[index * size + index] ?? 0;
  }
  return { values, vectors };
}

function realEmbedding(hermitian: ComplexMatrix): Float64Array {
  const dimension = hermitian.rows;
  const size = 2 * dimension;
  const embedded = new Float64Array(size * size);
  for (let row = 0; row < dimension; row += 1) {
    for (let column = 0; column < dimension; column += 1) {
      const real = hermitian.real[row * dimension + column] ?? 0;
      const imaginary = hermitian.imaginary[row * dimension + column] ?? 0;
      embedded[row * size + column] = real;
      embedded[(row + dimension) * size + column + dimension] = real;
      embedded[row * size + column + dimension] = -imaginary;
      embedded[(row + dimension) * size + column] = imaginary;
    }
  }
  return embedded;
}

export function spectralDecomposition(hermitian: ComplexMatrix): readonly SpectralComponent[] {
  if (!isHermitian(hermitian)) {
    throw new Error('Spectral decomposition requires a Hermitian matrix');
  }
  const dimension = hermitian.rows;
  const size = 2 * dimension;
  const { values, vectors } = jacobiEigensystem(realEmbedding(hermitian), size);
  const order = Array.from({ length: size }, (ignored, index) => index).sort(
    (first, second) => (values[second] ?? 0) - (values[first] ?? 0),
  );
  const largest = Math.max(1, ...Array.from(values, Math.abs));
  const tolerance = EIGENVALUE_GROUPING_TOLERANCE * largest;
  const components: SpectralComponent[] = [];
  let groupStart = 0;
  while (groupStart < size) {
    const groupValue = values[order[groupStart] ?? 0] ?? 0;
    let groupEnd = groupStart;
    while (
      groupEnd < size &&
      Math.abs((values[order[groupEnd] ?? 0] ?? 0) - groupValue) <= tolerance
    ) {
      groupEnd += 1;
    }
    const groupSize = groupEnd - groupStart;
    if (groupSize % 2 !== 0) {
      throw new Error('Degenerate eigenvalues could not be paired in the real embedding');
    }
    const projector = zeroMatrix(dimension, dimension);
    for (let member = groupStart; member < groupEnd; member += 1) {
      const vectorIndex = order[member] ?? 0;
      for (let row = 0; row < dimension; row += 1) {
        const rowReal = vectors[row * size + vectorIndex] ?? 0;
        const rowImaginary = vectors[(row + dimension) * size + vectorIndex] ?? 0;
        for (let column = 0; column < dimension; column += 1) {
          const columnReal = vectors[column * size + vectorIndex] ?? 0;
          const columnImaginary = vectors[(column + dimension) * size + vectorIndex] ?? 0;
          const target = row * dimension + column;
          projector.real[target] =
            (projector.real[target] ?? 0) +
            (rowReal * columnReal + rowImaginary * columnImaginary) / 2;
          projector.imaginary[target] =
            (projector.imaginary[target] ?? 0) +
            (rowImaginary * columnReal - rowReal * columnImaginary) / 2;
        }
      }
    }
    let eigenvalueSum = 0;
    for (let member = groupStart; member < groupEnd; member += 1) {
      eigenvalueSum += values[order[member] ?? 0] ?? 0;
    }
    components.push({
      eigenvalue: roundEigenvalue(eigenvalueSum / groupSize, tolerance),
      multiplicity: groupSize / 2,
      projector,
    });
    groupStart = groupEnd;
  }
  return components;
}

export function eigenvectorFromRankOneProjector(projector: ComplexMatrix): ComplexMatrix {
  let bestColumn = 0;
  let bestNorm = 0;
  for (let column = 0; column < projector.columns; column += 1) {
    let norm = 0;
    for (let row = 0; row < projector.rows; row += 1) {
      norm += complexAbsSquared(entryAt(projector, row, column));
    }
    if (norm > bestNorm) {
      bestNorm = norm;
      bestColumn = column;
    }
  }
  if (bestNorm === 0) {
    throw new Error('Projector is zero');
  }
  const vector = zeroMatrix(projector.rows, 1);
  const scale = 1 / Math.sqrt(bestNorm);
  for (let row = 0; row < projector.rows; row += 1) {
    const entry = entryAt(projector, row, bestColumn);
    vector.real[row] = entry.real * scale;
    vector.imaginary[row] = entry.imaginary * scale;
  }
  return vector;
}

export function hermitianFunction(
  hermitian: ComplexMatrix,
  scalarFunction: (eigenvalue: number) => ComplexNumber,
): ComplexMatrix {
  return spectralDecomposition(hermitian).reduce(
    (sum, component) =>
      addMatrices(sum, scaleMatrix(component.projector, scalarFunction(component.eigenvalue))),
    zeroMatrix(hermitian.rows, hermitian.columns),
  );
}
