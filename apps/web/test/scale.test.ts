/* Checks the logarithmic scale: positions round-trip to values across the landmark decades, decade ticks thin out to fit, landmark labels take separate rows, and a value is named by the landmark it sits at. */
import type { ScaleLandmark } from '@standard-model/contracts';
import { describe, expect, it } from 'vitest';
import {
  SLIDER_STEPS,
  decadeTicks,
  labelRows,
  logScaleOf,
  nearestLandmark,
  sliderPosition,
  valueAtPosition,
} from '../src/scale';

const LANDMARKS: readonly ScaleLandmark[] = [
  { value: 1e-8, label: { ru: 'вакуум', en: 'vacuum' } },
  { value: 101325, label: { ru: 'Земля', en: 'Earth' } },
  { value: 9.2e6, label: { ru: 'Венера', en: 'Venus' } },
];
const ROUND_TRIP_AGREEMENT = 0.02;

describe('logarithmic scale', () => {
  it('spans the landmark decades with a margin and round-trips values', () => {
    const scale = logScaleOf(LANDMARKS);
    expect(scale).toEqual({ lowExponent: -9, highExponent: 8 });
    [1e-8, 1, 101325, 9.2e6].forEach((value) => {
      const back = valueAtPosition(sliderPosition(value, scale), scale);
      expect(Math.abs(back / value - 1)).toBeLessThan(ROUND_TRIP_AGREEMENT);
    });
    expect(sliderPosition(0, scale)).toBe(0);
    expect(sliderPosition(1e30, scale)).toBe(SLIDER_STEPS);
    expect(logScaleOf(LANDMARKS, 1e12).highExponent).toBe(13);
  });

  it('names a value by the nearest landmark within a fifth of a decade', () => {
    expect(nearestLandmark(110000, LANDMARKS)?.label.en).toBe('Earth');
    expect(nearestLandmark(5000, LANDMARKS)).toBeUndefined();
    expect(nearestLandmark(0, LANDMARKS)).toBeUndefined();
  });

  it('thins decade ticks to fit and keeps neighbouring labels in different rows', () => {
    expect(decadeTicks({ lowExponent: -9, highExponent: 8 }, 7)).toEqual([-9, -6, -3, 0, 3, 6]);
    expect(decadeTicks({ lowExponent: 0, highExponent: 4 }, 12)).toEqual([0, 1, 2, 3, 4]);
    expect(labelRows([100, 130, 400], [80, 80, 80], 3)).toEqual([0, 1, 0]);
    expect(labelRows([100, 110, 120, 130], [80, 80, 80, 80], 3)).toEqual([0, 1, 2, -1]);
  });
});
