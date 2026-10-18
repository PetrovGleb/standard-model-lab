/* Turns a CODATA quantity name into a self-descriptive UPPER_SNAKE_CASE constant name with symbols spelled out. */
const PHRASE_REPLACEMENTS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bmag\. mom\./g, 'magnetic moment'],
  [/\bmag\./g, 'magnetic'],
  [/\bgyromag\./g, 'gyromagnetic'],
  [/\bh-bar c\b/g, 'reduced planck constant times speed of light'],
  [/\bh-bar\b/g, 'reduced planck constant'],
  [/\btimes hc\b/g, 'times planck constant times speed of light'],
  [/\btimes c\b/g, 'times speed of light'],
  [/\bMeV\/c\b/g, 'mev per speed of light'],
  [/\beV s\b/g, 'ev second'],
  [/\bMeV fm\b/g, 'mev femtometer'],
  [/\bin u\b/g, 'in atomic mass units'],
  [/\bCs-133\b/g, 'cesium 133'],
  [/\bcarbon-12\b/g, 'carbon 12'],
  [/\bSi \(220\)/g, 'silicon 220'],
  [/\b1st\b/g, 'first'],
  [/\b2nd\b/g, 'second'],
  [/\bof d and p\b/g, 'of deuteron and proton'],
  [/\bof t and p\b/g, 'of triton and proton'],
  [/\bK\/T\b/g, 'kelvin per tesla'],
  [/\/T\b/g, ' per tesla'],
  [/\/K\b/g, ' per kelvin'],
  [/\/Hz\b/g, ' per hertz'],
  [/\(([^)]*)\)/g, ' at $1 '],
];

const PAIRWISE_QUANTITY_PATTERN = /\b(ratio|relationship)\b/;

export function toConstantName(codataName: string): string {
  const spelledOut = PHRASE_REPLACEMENTS.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    codataName,
  );
  const hyphenReplacement = PAIRWISE_QUANTITY_PATTERN.test(spelledOut) ? ' to ' : ' ';
  return spelledOut
    .replace(/-/g, hyphenReplacement)
    .split(/[^A-Za-z0-9]+/)
    .filter((token) => token.length > 0)
    .map((token) => token.toUpperCase())
    .join('_');
}
