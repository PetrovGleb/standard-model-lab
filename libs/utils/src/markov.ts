/* Continuous-time Markov chains: the transition matrix exp(Q t) of a rate generator by scaling and squaring a Taylor series, rows clamped to probabilities;
   absorbing chains keep the leak to absorbing states apart from the conserved flow, so rates 10^35 apart stay exact, and the absorption time is found on a dyadic ladder. */
const SCALED_NORM_LIMIT = 0.5;
const TAYLOR_ORDER = 18;
const ABSORPTION_TIME_LEVELS = 52;

type Matrix = readonly (readonly number[])[];

function multiply(left: Matrix, right: Matrix): number[][] {
  const columns = right[0]?.length ?? 0;
  return left.map((row) => {
    const product = new Array<number>(columns).fill(0);
    row.forEach((value, inner) => {
      const other = right[inner] ?? [];
      for (let column = 0; column < columns; column += 1) {
        product[column] = (product[column] ?? 0) + value * (other[column] ?? 0);
      }
    });
    return product;
  });
}

function combine(left: Matrix, right: Matrix, factor = 1): number[][] {
  return left.map((row, index) =>
    row.map((value, column) => value + factor * (right[index]?.[column] ?? 0)),
  );
}

function scale(matrix: Matrix, factor: number): number[][] {
  return matrix.map((row) => row.map((value) => value * factor));
}

function rowTimes(row: readonly number[], matrix: Matrix): number[] {
  return (
    matrix[0]?.map((unused, column) =>
      row.reduce((sum, value, inner) => sum + value * (matrix[inner]?.[column] ?? 0), 0),
    ) ?? []
  );
}

function normalizedRows(matrix: Matrix): number[][] {
  return matrix.map((row) => {
    const clamped = row.map((value) => Math.max(0, value));
    const total = clamped.reduce((sum, value) => sum + value, 0);
    return clamped.map((value) => value / total);
  });
}

function identity(size: number): number[][] {
  return Array.from({ length: size }, (unused, row) =>
    Array.from({ length: size }, (ignored, column) => (row === column ? 1 : 0)),
  );
}

export function markovTransitionMatrix(
  generatorPerSecond: Matrix,
  durationInSeconds: number,
): number[][] {
  const size = generatorPerSecond.length;
  const norm = Math.max(
    0,
    ...generatorPerSecond.map((row) =>
      row.reduce((sum, rate) => sum + Math.abs(rate * durationInSeconds), 0),
    ),
  );
  const squarings = norm > SCALED_NORM_LIMIT ? Math.ceil(Math.log2(norm / SCALED_NORM_LIMIT)) : 0;
  const scale = durationInSeconds / 2 ** squarings;
  const step = generatorPerSecond.map((row) => row.map((rate) => rate * scale));
  let term = identity(size);
  let result = identity(size);
  for (let order = 1; order <= TAYLOR_ORDER; order += 1) {
    term = multiply(term, step).map((row) => row.map((value) => value / order));
    result = result.map((row, index) =>
      row.map((value, column) => value + (term[index]?.[column] ?? 0)),
    );
  }
  for (let squaring = 0; squaring < squarings; squaring += 1) {
    result = normalizedRows(multiply(result, result));
  }
  return normalizedRows(result);
}

export interface AbsorbingTransition {
  readonly survivingProbabilities: number[][];
  readonly absorbedProbabilities: number[][];
}

interface AbsorbingLevel {
  readonly conserved: number[][];
  readonly leaked: number[][];
  readonly absorbed: number[][];
}

function absorbingLevels(
  generatorPerSecond: Matrix,
  absorptionRatesPerSecond: Matrix,
  durationInSeconds: number,
  minimumLevels: number,
): AbsorbingLevel[] {
  const size = generatorPerSecond.length;
  const leaks = identity(size).map((row, index) =>
    row.map(
      (value) =>
        value * (absorptionRatesPerSecond[index] ?? []).reduce((sum, rate) => sum + rate, 0),
    ),
  );
  const kept = combine(generatorPerSecond, leaks, -1);
  const norm = Math.max(
    0,
    ...kept.map((row) => row.reduce((sum, rate) => sum + Math.abs(rate * durationInSeconds), 0)),
  );
  const squarings = Math.max(
    minimumLevels,
    norm > SCALED_NORM_LIMIT ? Math.ceil(Math.log2(norm / SCALED_NORM_LIMIT)) : 0,
  );
  const step = durationInSeconds / 2 ** squarings;
  let conservedTerm = identity(size);
  let leakedTerm = scale(identity(size), 0);
  let conserved = identity(size);
  let leaked = leakedTerm;
  let absorbed = scale(absorptionRatesPerSecond, step);
  for (let order = 1; order <= TAYLOR_ORDER; order += 1) {
    leakedTerm = scale(
      combine(multiply(conservedTerm, leaks), multiply(leakedTerm, kept)),
      step / order,
    );
    conservedTerm = scale(multiply(conservedTerm, generatorPerSecond), step / order);
    conserved = combine(conserved, conservedTerm);
    leaked = combine(leaked, leakedTerm);
    absorbed = combine(
      absorbed,
      multiply(
        combine(conservedTerm, leakedTerm, -1),
        scale(absorptionRatesPerSecond, step / (order + 1)),
      ),
    );
  }
  const levels: AbsorbingLevel[] = [{ conserved, leaked, absorbed }];
  for (let squaring = 0; squaring < squarings; squaring += 1) {
    const half = levels[0] ?? { conserved, leaked, absorbed };
    levels.unshift({
      conserved: normalizedRows(multiply(half.conserved, half.conserved)),
      leaked: combine(
        combine(multiply(half.conserved, half.leaked), multiply(half.leaked, half.conserved)),
        multiply(half.leaked, half.leaked),
        -1,
      ),
      absorbed: combine(
        half.absorbed,
        combine(multiply(half.conserved, half.absorbed), multiply(half.leaked, half.absorbed), -1),
      ),
    });
  }
  return levels.slice(0, minimumLevels + 1);
}

export function absorbingMarkovTransition(
  generatorPerSecond: Matrix,
  absorptionRatesPerSecond: Matrix,
  durationInSeconds: number,
): AbsorbingTransition {
  const [level] = absorbingLevels(
    generatorPerSecond,
    absorptionRatesPerSecond,
    durationInSeconds,
    0,
  );
  const surviving = combine(level?.conserved ?? [], level?.leaked ?? [], -1);
  const absorbed = level?.absorbed ?? [];
  const rows = surviving.map((row, index) => {
    const kept = row.map((value) => Math.max(0, value));
    const lost = (absorbed[index] ?? []).map((value) => Math.max(0, value));
    const total = [...kept, ...lost].reduce((sum, value) => sum + value, 0);
    return { kept: kept.map((value) => value / total), lost: lost.map((value) => value / total) };
  });
  return {
    survivingProbabilities: rows.map((row) => row.kept),
    absorbedProbabilities: rows.map((row) => row.lost),
  };
}

export function absorptionTimeInSeconds(
  generatorPerSecond: Matrix,
  absorptionRatesPerSecond: Matrix,
  durationInSeconds: number,
  startIndex: number,
  channelIndex: number,
  quantile: number,
): number {
  const levels = absorbingLevels(
    generatorPerSecond,
    absorptionRatesPerSecond,
    durationInSeconds,
    ABSORPTION_TIME_LEVELS,
  );
  const target = quantile * (levels[0]?.absorbed[startIndex]?.[channelIndex] ?? 0);
  let surviving = identity(generatorPerSecond.length)[startIndex] ?? [];
  let absorbed = 0;
  let elapsed = 0;
  levels.slice(1).forEach((level, index) => {
    const reached = absorbed + (rowTimes(surviving, level.absorbed)[channelIndex] ?? 0);
    if (reached <= target) {
      const leaked = rowTimes(surviving, level.leaked);
      surviving = rowTimes(surviving, level.conserved).map(
        (value, column) => value - (leaked[column] ?? 0),
      );
      absorbed = reached;
      elapsed += durationInSeconds / 2 ** (index + 1);
    }
  });
  return elapsed;
}
