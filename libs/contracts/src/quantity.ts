/* Quantity: a physical value with uncertainty, unit and provenance. Every constant in the project has this shape. */
export type QuantitySource =
  | 'CODATA2022'
  | 'PDG2026'
  | 'PDG2024'
  | 'PYTHIA8'
  | 'NUBASE2020'
  | 'AME2020'
  | 'NISTASD'
  | 'UFF'
  | 'OpenStax'
  | 'standardModelTheory'
  | 'derived';

export interface Quantity {
  readonly value: number;
  readonly uncertainty: number | null;
  readonly exact: boolean;
  readonly unit: string;
  readonly source: QuantitySource;
  readonly sourceName: string;
}
