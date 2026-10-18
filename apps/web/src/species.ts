/* Display symbols of any species name the engine accepts: catalog particles by their symbol, nuclei and atoms as mass number, element and charge (⁴⁰Ar, ¹²C⁶⁺), molecules by their catalogue formula (HCl, NaCl) or else as a Hill formula with subscripts and the charge of their formal charges (N₂, CO₂, OH⁻, C₂H₅NO₂±). */
import { formatSymbol } from './format';

export interface SymbolSources {
  readonly particles: readonly { readonly name: string; readonly symbol: string }[];
  readonly elements: readonly { readonly protons: number; readonly symbol: string }[];
  readonly molecules?: readonly { readonly name: string; readonly formula: string }[] | undefined;
}

export type SpeciesSymbolOf = (name: string) => string;

const SUPERSCRIPTS = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const SUBSCRIPTS = '₀₁₂₃₄₅₆₇₈₉';
const MATTER_NAME = /^(nucleus|atom):(\d+):(\d+)(?::(-?\d+))?$/;
const MOLECULE_PREFIX = 'molecule:';
const CARBON = 'C';
const HYDROGEN = 'H';

function digits(value: number, glyphs: string): string {
  return String(value)
    .split('')
    .map((digit) => glyphs[Number(digit)] ?? digit)
    .join('');
}

function chargeText(charge: number): string {
  if (charge === 0) {
    return '';
  }
  const sign = charge > 0 ? '⁺' : '⁻';
  return Math.abs(charge) === 1 ? sign : `${digits(Math.abs(charge), SUPERSCRIPTS)}${sign}`;
}

function hillFormula(elementSymbols: readonly string[]): string {
  const counts = new Map<string, number>();
  elementSymbols.forEach((symbol) => counts.set(symbol, (counts.get(symbol) ?? 0) + 1));
  const sorted = [...counts.keys()].sort();
  const ordered = counts.has(CARBON)
    ? [
        CARBON,
        ...(counts.has(HYDROGEN) ? [HYDROGEN] : []),
        ...sorted.filter((symbol) => symbol !== CARBON && symbol !== HYDROGEN),
      ]
    : sorted;
  return ordered
    .map((symbol) => {
      const count = counts.get(symbol) ?? 0;
      return count === 1 ? symbol : `${symbol}${digits(count, SUBSCRIPTS)}`;
    })
    .join('');
}

export function speciesSymbolResolver(sources: SymbolSources): SpeciesSymbolOf {
  const particleSymbols = new Map(sources.particles.map((entry) => [entry.name, entry.symbol]));
  const moleculeFormulas = new Map(
    (sources.molecules ?? []).map((entry) => [entry.name, entry.formula]),
  );
  const elementSymbols = new Map(sources.elements.map((entry) => [entry.protons, entry.symbol]));
  const elementOf = (protons: number): string =>
    elementSymbols.get(protons) ?? `Z${String(protons)}`;
  return (name) => {
    const known = particleSymbols.get(name);
    if (known !== undefined) {
      return formatSymbol(known);
    }
    const written = moleculeFormulas.get(name);
    if (written !== undefined) {
      return written;
    }
    if (name.startsWith(MOLECULE_PREFIX)) {
      const [atomPart = '', , chargePart = ''] = name.slice(MOLECULE_PREFIX.length).split(';');
      const formalCharges = chargePart
        .split(',')
        .filter((entry) => entry !== '')
        .map((entry) => Number(/[+-]\d+$/.exec(entry)?.[0] ?? 0));
      const charge = formalCharges.reduce((sum, value) => sum + value, 0);
      const zwitterion = charge === 0 && formalCharges.some((value) => value !== 0);
      return `${hillFormula(
        atomPart
          .split(',')
          .filter((atom) => atom !== '')
          .map((atom) => elementOf(Number(atom.split('-')[0]))),
      )}${zwitterion ? '±' : chargeText(charge)}`;
    }
    const matter = MATTER_NAME.exec(name);
    if (matter === null) {
      return name;
    }
    const protons = Number(matter[2]);
    const charge = matter[1] === 'nucleus' ? protons : Number(matter[4] ?? 0);
    return `${digits(Number(matter[3]), SUPERSCRIPTS)}${elementOf(protons)}${chargeText(charge)}`;
  };
}

export function speciesFamilyResolver(
  particles: readonly { readonly name: string; readonly family: string }[],
): (name: string) => string {
  const families = new Map(particles.map((entry) => [entry.name, entry.family]));
  return (name) =>
    families.get(name) ??
    (name.startsWith(MOLECULE_PREFIX)
      ? 'molecule'
      : name.startsWith('nucleus:')
        ? 'nucleus'
        : 'atom');
}
