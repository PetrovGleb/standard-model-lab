/* Logarithmic scales for medium fields: the decades spanned by the landmarks of a quantity, positions along the track, decade ticks thinned to fit, label rows that keep landmark names from
   overlapping (a name that fits no row is left to its tooltip), and the landmark a value sits at. */
import type { ScaleLandmark } from '@standard-model/contracts';

export const SLIDER_STEPS = 1000;
const MARGIN_IN_DECADES = 1;
const NEAREST_LANDMARK_IN_DECADES = 0.2;
const SIGNIFICANT_DIGITS = 3;
const LABEL_GAP_IN_PIXELS = 10;
export const HIDDEN_ROW = -1;

export interface LogScale {
  readonly lowExponent: number;
  readonly highExponent: number;
}

export function logScaleOf(landmarks: readonly ScaleLandmark[], value?: number): LogScale {
  const exponents = landmarks
    .map((landmark) => Math.log10(landmark.value))
    .concat(value !== undefined && value > 0 ? [Math.log10(value)] : [])
    .filter(Number.isFinite);
  return {
    lowExponent: Math.floor(Math.min(...exponents)) - MARGIN_IN_DECADES,
    highExponent: Math.ceil(Math.max(...exponents)) + MARGIN_IN_DECADES,
  };
}

export function scaleFraction(value: number, scale: LogScale): number {
  if (!(value > 0)) {
    return 0;
  }
  const fraction =
    (Math.log10(value) - scale.lowExponent) / (scale.highExponent - scale.lowExponent);
  return Math.min(1, Math.max(0, fraction));
}

export function sliderPosition(value: number, scale: LogScale): number {
  return Math.round(scaleFraction(value, scale) * SLIDER_STEPS);
}

export function valueAtFraction(fraction: number, scale: LogScale): number {
  const clamped = Math.min(1, Math.max(0, fraction));
  const exponent = scale.lowExponent + clamped * (scale.highExponent - scale.lowExponent);
  return Number((10 ** exponent).toPrecision(SIGNIFICANT_DIGITS));
}

export function valueAtPosition(position: number, scale: LogScale): number {
  return valueAtFraction(position / SLIDER_STEPS, scale);
}

export function decadeTicks(scale: LogScale, maximumTicks: number): readonly number[] {
  const span = scale.highExponent - scale.lowExponent;
  const stride = Math.max(1, Math.ceil(span / Math.max(1, maximumTicks - 1)));
  return Array.from(
    { length: Math.floor(span / stride) + 1 },
    (unused, index) => scale.lowExponent + index * stride,
  );
}

export function labelRows(
  centers: readonly number[],
  widths: readonly number[],
  rowCount: number,
): readonly number[] {
  const rightEdges = Array.from({ length: rowCount }, () => Number.NEGATIVE_INFINITY);
  const order = centers
    .map((center, index) => index)
    .sort((left, right) => (centers[left] ?? 0) - (centers[right] ?? 0));
  const rows = centers.map(() => HIDDEN_ROW);
  order.forEach((index) => {
    const left = (centers[index] ?? 0) - (widths[index] ?? 0) / 2;
    const row = rightEdges.findIndex((edge) => edge + LABEL_GAP_IN_PIXELS <= left);
    if (row !== HIDDEN_ROW) {
      rows[index] = row;
      rightEdges[row] = (centers[index] ?? 0) + (widths[index] ?? 0) / 2;
    }
  });
  return rows;
}

export function nearestLandmark(
  value: number,
  landmarks: readonly ScaleLandmark[],
): ScaleLandmark | undefined {
  if (!(value > 0)) {
    return undefined;
  }
  const nearest = landmarks.reduce<{ landmark: ScaleLandmark; distance: number } | null>(
    (best, landmark) => {
      const distance = Math.abs(Math.log10(landmark.value) - Math.log10(value));
      return best === null || distance < best.distance ? { landmark, distance } : best;
    },
    null,
  );
  return nearest !== null && nearest.distance <= NEAREST_LANDMARK_IN_DECADES
    ? nearest.landmark
    : undefined;
}
