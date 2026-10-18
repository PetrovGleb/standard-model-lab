/* Typed access to data/element-names.json: the Russian name of each chemical element by its proton number, beside the English names that come from NIST. */
import namesJson from '../data/element-names.json' with { type: 'json' };

interface ElementNamesFile {
  readonly source: string;
  readonly names: readonly { readonly protons: number; readonly ru: string }[];
}

const file = namesJson as ElementNamesFile;
const RUSSIAN_NAMES = new Map(file.names.map((entry) => [entry.protons, entry.ru]));

export const ELEMENT_NAMES_SOURCE = file.source;

export function elementNameInRussian(protons: number): string | null {
  return RUSSIAN_NAMES.get(protons) ?? null;
}
