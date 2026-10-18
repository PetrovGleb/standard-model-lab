/* Typed access to data/pdg2026.json: PDG values that CODATA does not cover, wrapped as Quantity objects. */
import type {
  DecayChannel,
  DecayProduct,
  Quantity,
  QuantitySource,
} from '@standard-model/contracts';
import pdgData from '../data/pdg2026.json' with { type: 'json' };

interface PdgEntry {
  readonly value: number;
  readonly uncertainty: number | null;
  readonly source?: string;
}

interface PdgBranchingEntry extends PdgEntry {
  readonly products: readonly string[];
}

export const PDG_2026 = pdgData;

export function pdgQuantity(entry: PdgEntry, sourceName: string, unit: string): Quantity {
  const source: QuantitySource = entry.source === 'PDG2024' ? 'PDG2024' : 'PDG2026';
  return {
    value: entry.value,
    uncertainty: entry.uncertainty,
    exact: false,
    unit,
    source,
    sourceName,
  };
}

export function pdgDecayChannels(
  entries: readonly PdgBranchingEntry[],
  parentName: string,
): readonly DecayChannel[] {
  return entries.map((entry) => ({
    products: entry.products as readonly DecayProduct[],
    branchingFraction: pdgQuantity(entry, `${parentName} branching fraction`, ''),
  }));
}
