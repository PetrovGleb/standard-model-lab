/* Space scale dragging: moves the cube along a logarithmic length axis or resizes it by an edge, snapping the grid to the allowed sizes and keeping the cube inside the axis. */

export interface CubeScale {
  readonly cellSizeInMeters: number;
  readonly gridPointsPerAxis: number;
}

export type ScaleHandle = 'move' | 'cell' | 'edge';

export const SMALLEST_RULER_EXPONENT = -15;
export const LARGEST_RULER_EXPONENT = -5;
const SIGNIFICANT_DIGITS = 2;

function rounded(value: number): number {
  return Number(value.toPrecision(SIGNIFICANT_DIGITS));
}

function nearestGrid(ratio: number, grids: readonly number[]): number {
  return grids.reduce((best, grid) =>
    Math.abs(Math.log(grid / ratio)) < Math.abs(Math.log(best / ratio)) ? grid : best,
  );
}

function clampCell(cell: number, grid: number): number {
  const smallest = 10 ** SMALLEST_RULER_EXPONENT;
  const largest = 10 ** LARGEST_RULER_EXPONENT / grid;
  return Math.min(Math.max(cell, smallest), largest);
}

export function dragScale(
  handle: ScaleHandle,
  start: CubeScale,
  exponentShift: number,
  grids: readonly number[],
): CubeScale {
  const factor = 10 ** exponentShift;
  const edge = start.cellSizeInMeters * start.gridPointsPerAxis;
  switch (handle) {
    case 'move':
      return {
        gridPointsPerAxis: start.gridPointsPerAxis,
        cellSizeInMeters: rounded(
          clampCell(start.cellSizeInMeters * factor, start.gridPointsPerAxis),
        ),
      };
    case 'edge': {
      const grid = nearestGrid((edge * factor) / start.cellSizeInMeters, grids);
      return {
        gridPointsPerAxis: grid,
        cellSizeInMeters: rounded(clampCell(start.cellSizeInMeters, grid)),
      };
    }
    case 'cell': {
      const grid = nearestGrid(edge / (start.cellSizeInMeters * factor), grids);
      return { gridPointsPerAxis: grid, cellSizeInMeters: rounded(clampCell(edge / grid, grid)) };
    }
  }
}
