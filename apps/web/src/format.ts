/* Number and outcome formatting for results: compact scientific numbers, readable spin, flavor and decay channel labels (cations keep their + sign), durations for the remaining run time. */
import { PARTICLE_GLOSSARY } from './glossary';
import { bilingual, say } from './language';

const SIGNIFICANT_DIGITS = 4;
const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const SCIENTIFIC_ABOVE = 1e5;
const SCIENTIFIC_BELOW = 1e-3;

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return say('нет данных', 'no data');
  }
  if (value === 0) {
    return '0';
  }
  const magnitude = Math.abs(value);
  if (magnitude >= SCIENTIFIC_ABOVE || magnitude < SCIENTIFIC_BELOW) {
    const [mantissa, exponent] = value.toExponential(SIGNIFICANT_DIGITS - 1).split('e');
    return `${String(Number(mantissa))}·10${superscript(Number(exponent))}`;
  }
  return Number(value.toPrecision(SIGNIFICANT_DIGITS)).toString();
}

const SUPERSCRIPT_DIGITS: Readonly<Record<string, string>> = {
  '-': '⁻',
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
};

function superscript(exponent: number): string {
  return String(exponent)
    .split('')
    .map((character) => SUPERSCRIPT_DIGITS[character] ?? character)
    .join('');
}

const FLAVOR_LABELS = bilingual<string>({
  electron: ['электронный', 'electron'],
  muon: ['мюонный', 'muon'],
  tau: ['тау', 'tau'],
});

const OUTCOME_SEPARATOR = /\+(?!\+|$)/;

export function formatOutcome(outcome: string): string {
  const names = outcome.split(OUTCOME_SEPARATOR);
  if (names.length > 1 && !Number.isFinite(Number(outcome))) {
    return names.map((name) => PARTICLE_GLOSSARY[name] ?? name).join(' + ');
  }
  const particle = PARTICLE_GLOSSARY[outcome];
  if (particle !== undefined) {
    return particle;
  }
  const flavor = FLAVOR_LABELS[outcome];
  if (flavor !== undefined) {
    return flavor;
  }
  const value = Number(outcome);
  if (Number.isFinite(value)) {
    if (value === 0.5) {
      return '↑ +½';
    }
    if (value === -0.5) {
      return '↓ −½';
    }
    return formatNumber(value);
  }
  return outcome;
}

export function formatMass(massInGev: number): string {
  if (!(massInGev > 0)) {
    return say('без массы', 'massless');
  }
  const units: ReadonlyArray<readonly [number, string]> = [
    [1, say('ГэВ', 'GeV')],
    [1e-3, say('МэВ', 'MeV')],
    [1e-6, say('кэВ', 'keV')],
    [1e-9, say('эВ', 'eV')],
  ];
  const unit = units.find(([scale]) => massInGev >= scale) ?? units[units.length - 1];
  return unit === undefined
    ? formatNumber(massInGev)
    : `${formatNumber(massInGev / unit[0])} ${unit[1]}`;
}

export function formatLength(meters: number): string {
  if (!Number.isFinite(meters)) {
    return '—';
  }
  if (Math.abs(meters) < 1e-18) {
    return '0';
  }
  const units: ReadonlyArray<readonly [number, string]> = [
    [1, say('м', 'm')],
    [1e-2, say('см', 'cm')],
    [1e-3, say('мм', 'mm')],
    [1e-6, say('мкм', 'µm')],
    [1e-9, say('нм', 'nm')],
    [1e-12, say('пм', 'pm')],
    [1e-15, say('фм', 'fm')],
  ];
  const unit = units.find(([scale]) => Math.abs(meters) >= scale) ?? units[units.length - 1];
  if (unit === undefined) {
    return `${formatNumber(meters)} ${say('м', 'm')}`;
  }
  return `${formatNumber(meters / unit[0])} ${unit[1]}`;
}

const SYMBOL_GLYPHS: ReadonlyArray<readonly [RegExp, string]> = [
  [/Meson$/, ''],
  [/gamma/g, 'γ'],
  [/alpha/g, 'α'],
  [/Lambda/g, 'Λ'],
  [/Sigma/g, 'Σ'],
  [/Xi/g, 'Ξ'],
  [/Delta/g, 'Δ'],
  [/Omega/g, 'Ω'],
  [/_c/g, 'c'],
  [/_b/g, 'b'],
  [/'/g, '′'],
  [/pi/g, 'π'],
  [/eta′/g, 'η′'],
  [/eta/g, 'η'],
  [/rho/g, 'ρ'],
  [/omega/g, 'ω'],
  [/phi/g, 'φ'],
  [/_S$/, '⁰ₛ'],
  [/_L$/, '⁰ₗ'],
  [/_s/, 'ₛ'],
  [/nu_e/g, 'νₑ'],
  [/nu_mu/g, 'νμ'],
  [/nu_tau/g, 'ντ'],
  [/mu/g, 'μ'],
  [/tau/g, 'τ'],
  [/nu/g, 'ν'],
  [/--$/, '⁻⁻'],
  [/\+\+$/, '⁺⁺'],
  [/-$/, '⁻'],
  [/\+$/, '⁺'],
  [/0$/, '⁰'],
];

const ANTI_PREFIX = 'anti-';
const COMBINING_OVERLINE = '\u0304';

export function formatSymbol(symbol: string): string {
  const isAnti = symbol.startsWith(ANTI_PREFIX);
  const glyphs = SYMBOL_GLYPHS.reduce(
    (text, [pattern, glyph]) => text.replace(pattern, glyph),
    isAnti ? symbol.slice(ANTI_PREFIX.length) : symbol,
  );
  return isAnti ? `${glyphs.slice(0, 1)}${COMBINING_OVERLINE}${glyphs.slice(1)}` : glyphs;
}

const MILLISECONDS_SHOWN_BELOW = 1000;

export function formatMilliseconds(milliseconds: number): string {
  if (milliseconds >= MILLISECONDS_SHOWN_BELOW) {
    return formatDuration(milliseconds);
  }
  const shown = milliseconds < 1 ? milliseconds.toFixed(2) : String(Math.round(milliseconds));
  return `${shown} ${say('мс', 'ms')}`;
}

export function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / MILLISECONDS_PER_SECOND));
  const hours = Math.floor(totalSeconds / (SECONDS_PER_MINUTE * MINUTES_PER_HOUR));
  const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE) % MINUTES_PER_HOUR;
  const seconds = totalSeconds % SECONDS_PER_MINUTE;
  const parts = [
    hours > 0 ? say(`${String(hours)} ч`, `${String(hours)} h`) : '',
    hours > 0 || minutes > 0 ? say(`${String(minutes)} мин`, `${String(minutes)} min`) : '',
    say(`${String(seconds)} с`, `${String(seconds)} s`),
  ];
  return parts.filter((part) => part !== '').join(' ');
}
