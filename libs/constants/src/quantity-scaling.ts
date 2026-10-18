/* Scales a Quantity by an exact factor into another unit, keeping its uncertainty and provenance. */
import type { Quantity } from '@standard-model/contracts';

export function scaleQuantity(quantity: Quantity, factor: number, unit: string): Quantity {
  return {
    value: quantity.value * factor,
    uncertainty: quantity.uncertainty === null ? null : quantity.uncertainty * factor,
    exact: quantity.exact,
    unit,
    source: quantity.source,
    sourceName: quantity.sourceName,
  };
}

export function theoreticalQuantity(value: number, unit: string, sourceName: string): Quantity {
  return { value, uncertainty: null, exact: true, unit, source: 'standardModelTheory', sourceName };
}
