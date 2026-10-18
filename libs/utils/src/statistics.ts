/* Statistics for Monte Carlo tests: binomial standard error and the tolerance window around an expected probability; a running mean for progress estimates. */
export const DEFAULT_MONTE_CARLO_SHOTS = 10_000;
export const DEFAULT_SIGMA_MULTIPLIER = 5;
export const DEFAULT_ABSOLUTE_FLOOR = 1e-3;

export function binomialStandardError(probability: number, shots: number): number {
  return Math.sqrt((probability * (1 - probability)) / shots);
}

export function statisticalTolerance(
  probability: number,
  shots: number,
  sigmaMultiplier: number = DEFAULT_SIGMA_MULTIPLIER,
  absoluteFloor: number = DEFAULT_ABSOLUTE_FLOOR,
): number {
  return Math.max(sigmaMultiplier * binomialStandardError(probability, shots), absoluteFloor);
}

export function isWithinTolerance(observed: number, expected: number, tolerance: number): boolean {
  return Math.abs(observed - expected) <= tolerance;
}

export function frequency(count: number, shots: number): number {
  return count / shots;
}

export function updatedRunningMean(mean: number, count: number, value: number): number {
  return mean + (value - mean) / count;
}
