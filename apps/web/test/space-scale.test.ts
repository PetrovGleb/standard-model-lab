/* Checks cube dragging on the scale ruler: moving keeps the grid, edges snap the grid, the cube never leaves the axis. */
import { describe, expect, it } from 'vitest';
import { dragScale } from '../src/space-scale';

const GRIDS = [32, 64];
const START = { cellSizeInMeters: 5e-11, gridPointsPerAxis: 32 };

describe('dragScale', () => {
  it('moves the whole cube by decades and keeps the grid', () => {
    expect(dragScale('move', START, 1, GRIDS)).toEqual({
      cellSizeInMeters: 5e-10,
      gridPointsPerAxis: 32,
    });
  });

  it('snaps the grid when an edge is dragged', () => {
    expect(dragScale('edge', START, 0.3, GRIDS)).toEqual({
      cellSizeInMeters: 5e-11,
      gridPointsPerAxis: 64,
    });
    expect(dragScale('edge', START, 0.1, GRIDS)).toEqual(START);
    expect(dragScale('cell', START, -0.3, GRIDS)).toEqual({
      cellSizeInMeters: 2.5e-11,
      gridPointsPerAxis: 64,
    });
  });

  it('keeps the cube inside the axis', () => {
    expect(dragScale('move', START, -10, GRIDS).cellSizeInMeters).toBe(1e-15);
    expect(dragScale('move', START, 10, GRIDS).cellSizeInMeters * 32).toBeLessThanOrEqual(1e-5);
  });
});
