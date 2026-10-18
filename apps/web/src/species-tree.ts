/* Species picker model: the screens of the medium component picker (matter or antimatter and eight classes, particles with filter chips, atoms, ions and isotopes and nuclei by element on a
   periodic table placed by the Madelung filling order, molecules by group and category, preset mixtures, search over every species) as pure data the modal renders, with breadcrumbs. */
import type {
  CatalogResponse,
  ElementEntry,
  EnvironmentPreset,
  MoleculeCatalogEntry,
  NuclideEntry,
  ParticleCatalogEntry,
} from '@standard-model/contracts';
import { formatMass, formatNumber } from './format';
import { PARTICLE_GLOSSARY } from './glossary';
import { HINTS, decayModeHint } from './hints';
import { localize, say } from './language';
import { matterKindOf, type MatterKind } from './presets';
import type { SpeciesSymbolOf } from './species';

export type SpeciesSource = Pick<
  CatalogResponse,
  'particles' | 'elements' | 'molecules' | 'moleculeCategories' | 'moleculeGroups' | 'environments'
>;

export type SpeciesClass =
  'bosons' | 'quarks' | 'leptons' | 'hadrons' | 'nuclei' | 'atoms' | 'molecules' | 'mixtures';

export type AtomMode = 'neutral' | 'ion' | 'isotope';

export type SpeciesScreen =
  | { readonly view: 'root' }
  | {
      readonly view: 'particles';
      readonly speciesClass: SpeciesClass;
      readonly filter: string | null;
    }
  | { readonly view: 'atoms'; readonly mode: AtomMode; readonly protons: number | null }
  | { readonly view: 'nuclei'; readonly protons: number | null }
  | { readonly view: 'molecules'; readonly group: string | null; readonly selected: string | null }
  | { readonly view: 'mixtures' };

export interface PickedComponent {
  readonly species: string;
  readonly numberDensityPerCubicMeter?: number;
}

export interface ClassCard {
  readonly key: SpeciesClass;
  readonly title: string;
  readonly description: string;
  readonly footer: string;
  readonly icon: string;
  readonly tone: string;
  readonly enabled: boolean;
}

export interface SpeciesCard {
  readonly key: string;
  readonly species: string;
  readonly glyph: string;
  readonly title: string;
  readonly meta: string;
  readonly badge?: { readonly text: string; readonly stable: boolean; readonly hint: string };
  readonly tone?: string;
  readonly hint?: string;
}

export interface FilterChip {
  readonly key: string;
  readonly label: string;
  readonly count: number;
}

export interface Crumb {
  readonly label: string;
  readonly target: SpeciesScreen;
}

const SPIN_STATES = 2;
const SHELL_LETTERS = 'spdf';
const IONS_SHOWN = 4;
const PREVIEW_SHOWN = 6;
const SEARCH_LIMIT = 40;
const PERCENT = 100;
const MAIN_COLUMNS = 18;
const MAIN_ROWS = 7;
const F_ROWS_GAP = 1;
const P_BLOCK_START_COLUMN = 12;
const D_BLOCK_START_COLUMN = 2;
const F_BLOCK_START_COLUMN = 2;
const FIRST_F_SHELL = 4;
const DEUTERIUM_MASS_NUMBER = 2;
const MOLECULE_MASS_DECIMALS = 2;
const WEIGHT_DIGITS = 6;
const SUBSCRIPT_DIGITS = '₀₁₂₃₄₅₆₇₈₉';
const SUPERSCRIPT_DIGITS = '⁰¹²³⁴⁵⁶⁷⁸⁹';

const CLASS_FAMILIES: Readonly<Record<SpeciesClass, readonly string[]>> = {
  bosons: ['gaugeBoson', 'scalarBoson'],
  quarks: ['quark'],
  leptons: ['chargedLepton', 'neutrino'],
  hadrons: ['meson', 'baryon'],
  nuclei: ['nucleus'],
  atoms: ['atom'],
  molecules: ['molecule'],
  mixtures: [],
};

const CLASS_TONES: Readonly<Record<SpeciesClass, string>> = {
  bosons: 'gaugeBoson',
  quarks: 'quark',
  leptons: 'chargedLepton',
  hadrons: 'baryon',
  nuclei: 'nucleus',
  atoms: 'atom',
  molecules: 'molecule',
  mixtures: 'mixture',
};

const CLASS_ICONS: Readonly<Record<SpeciesClass, string>> = {
  bosons: 'gauge-boson',
  quarks: 'quark',
  leptons: 'lepton',
  hadrons: 'hadron',
  nuclei: 'nucleus',
  atoms: 'atom',
  molecules: 'molecule',
  mixtures: 'medium-gas',
};

export function classTitle(speciesClass: SpeciesClass): string {
  switch (speciesClass) {
    case 'bosons':
      return say('Бозоны', 'Bosons');
    case 'quarks':
      return say('Кварки', 'Quarks');
    case 'leptons':
      return say('Лептоны', 'Leptons');
    case 'hadrons':
      return say('Адроны', 'Hadrons');
    case 'nuclei':
      return say('Ядра', 'Nuclei');
    case 'atoms':
      return say('Атомы', 'Atoms');
    case 'molecules':
      return say('Молекулы', 'Molecules');
    case 'mixtures':
      return say('Готовые смеси', 'Ready mixtures');
  }
}

export function kindTitle(kind: MatterKind): string {
  return kind === 'matter' ? say('Вещество', 'Matter') : say('Антивещество', 'Antimatter');
}

export function modeTitle(mode: AtomMode): string {
  switch (mode) {
    case 'neutral':
      return say('Нейтральные атомы', 'Neutral atoms');
    case 'ion':
      return say('Ионы', 'Ions');
    case 'isotope':
      return say('Изотопы', 'Isotopes');
  }
}

export function elementName(element: ElementEntry): string {
  return element.label === undefined ? element.name : localize(element.label);
}

const SHELL_PART = /^(\d[spdf])(\d*)$/;

function shellsText(groundShells: string): string {
  return groundShells
    .split('.')
    .map((part) => {
      const match = SHELL_PART.exec(part);
      return match === null
        ? part
        : `${match[1] ?? ''}${(match[2] === '' ? '1' : (match[2] ?? '1'))
            .split('')
            .map((digit) => SUPERSCRIPT_DIGITS[Number(digit)] ?? digit)
            .join('')}`;
    })
    .join(' ');
}

export function elementSummary(element: ElementEntry): string {
  return [
    elementName(element),
    `Z = ${String(element.protons)}`,
    element.standardAtomicWeight === null
      ? null
      : say(
          `атомная масса ${String(Number(element.standardAtomicWeight.toPrecision(WEIGHT_DIGITS)))} u`,
          `atomic weight ${String(Number(element.standardAtomicWeight.toPrecision(WEIGHT_DIGITS)))} u`,
        ),
    element.groundShells === '' ? null : shellsText(element.groundShells),
  ]
    .filter((part) => part !== null)
    .join(' · ');
}

function countText(count: number, russian: string, english: string): string {
  return say(`${String(count)} ${russian}`, `${String(count)} ${english}`);
}

function notInCatalogue(): string {
  return say('нет в каталоге', 'not in the catalogue');
}

function particlesOf(
  source: SpeciesSource,
  kind: MatterKind,
  families: readonly string[],
): readonly ParticleCatalogEntry[] {
  return source.particles.filter(
    (entry) => families.includes(entry.family) && matterKindOf(entry) === kind,
  );
}

function symbolsPreview(
  entries: readonly { readonly name: string }[],
  symbolOf: SpeciesSymbolOf,
): string {
  const shown = entries.slice(0, PREVIEW_SHOWN).map((entry) => symbolOf(entry.name));
  return `${shown.join(', ')}${entries.length > PREVIEW_SHOWN ? '…' : ''}`;
}

export function classCards(
  source: SpeciesSource,
  kind: MatterKind,
  symbolOf: SpeciesSymbolOf,
): readonly ClassCard[] {
  const matter = kind === 'matter';
  const card = (
    key: SpeciesClass,
    description: string,
    footer: string,
    enabled: boolean,
  ): ClassCard => ({
    key,
    title: classTitle(key),
    description,
    footer,
    icon: CLASS_ICONS[key],
    tone: CLASS_TONES[key],
    enabled,
  });
  const particleClass = (key: SpeciesClass): ClassCard => {
    const members = particlesOf(source, kind, CLASS_FAMILIES[key]);
    return card(
      key,
      members.length > 0 ? symbolsPreview(members, symbolOf) : notInCatalogue(),
      members.length > 0 ? countText(members.length, 'частиц', 'particles') : '',
      members.length > 0,
    );
  };
  const molecules = source.molecules ?? [];
  const groups = source.moleculeGroups ?? [];
  const mixtureGroups = [...new Set(source.environments.map((preset) => localize(preset.group)))];
  return [
    particleClass('bosons'),
    particleClass('quarks'),
    particleClass('leptons'),
    particleClass('hadrons'),
    matter
      ? card(
          'nuclei',
          say('голые ядра без электронов', 'bare nuclei without electrons'),
          say('по элементу и изотопу', 'by element and isotope'),
          source.elements.length > 0,
        )
      : particleClass('nuclei'),
    matter
      ? card(
          'atoms',
          say('нейтральные, ионы, изотопы', 'neutral, ions, isotopes'),
          countText(source.elements.length, 'элементов', 'elements'),
          source.elements.length > 0,
        )
      : particleClass('atoms'),
    card(
      'molecules',
      matter && groups.length > 0
        ? groups.map((group) => localize(group.label).toLowerCase()).join(', ')
        : notInCatalogue(),
      matter && molecules.length > 0 ? countText(molecules.length, 'молекул', 'molecules') : '',
      matter && molecules.length > 0,
    ),
    card(
      'mixtures',
      matter && mixtureGroups.length > 0
        ? mixtureGroups.slice(0, PREVIEW_SHOWN).join(', ').toLowerCase()
        : notInCatalogue(),
      matter && source.environments.length > 0
        ? countText(source.environments.length, 'пресетов', 'presets')
        : '',
      matter && source.environments.length > 0,
    ),
  ];
}

export function openClass(
  source: SpeciesSource,
  kind: MatterKind,
  key: SpeciesClass,
): SpeciesScreen {
  if (kind === 'matter' && key === 'atoms') {
    return { view: 'atoms', mode: 'neutral', protons: null };
  }
  if (kind === 'matter' && key === 'nuclei') {
    return { view: 'nuclei', protons: null };
  }
  if (key === 'molecules') {
    return { view: 'molecules', group: source.moleculeGroups?.[0]?.key ?? null, selected: null };
  }
  if (key === 'mixtures') {
    return { view: 'mixtures' };
  }
  return { view: 'particles', speciesClass: key, filter: null };
}

function chargeText(charge: number): string {
  if (charge === 0) {
    return '0';
  }
  return `${charge > 0 ? '+' : '−'}${formatNumber(Math.abs(charge))}`;
}

function particleCard(entry: ParticleCatalogEntry, symbolOf: SpeciesSymbolOf): SpeciesCard {
  return {
    key: entry.name,
    species: entry.name,
    glyph: symbolOf(entry.name),
    title: PARTICLE_GLOSSARY[entry.name] ?? entry.name,
    meta: `${formatMass(entry.massInGev.value)} · ${say('заряд', 'charge')} ${chargeText(entry.electricChargeInElementaryUnits)}`,
    tone: entry.family,
    hint: HINTS.particleMeta,
  };
}

const FAMILY_FILTERS: Readonly<Record<string, readonly [string, string]>> = {
  chargedLepton: ['заряженные', 'charged'],
  neutrino: ['нейтрино', 'neutrinos'],
  meson: ['мезоны', 'mesons'],
  baryon: ['барионы', 'baryons'],
  gaugeBoson: ['калибровочные', 'gauge'],
  scalarBoson: ['скалярные', 'scalar'],
};

export function particleScreen(
  source: SpeciesSource,
  kind: MatterKind,
  speciesClass: SpeciesClass,
  filter: string | null,
  symbolOf: SpeciesSymbolOf,
): { readonly filters: readonly FilterChip[]; readonly cards: readonly SpeciesCard[] } {
  const members = particlesOf(source, kind, CLASS_FAMILIES[speciesClass]);
  const families = [...new Set(members.map((entry) => entry.family))];
  const filters =
    families.length > 1
      ? families.map((family) => {
          const label = FAMILY_FILTERS[family];
          return {
            key: family,
            label: label === undefined ? family : say(label[0], label[1]),
            count: members.filter((entry) => entry.family === family).length,
          };
        })
      : [];
  return {
    filters,
    cards: members
      .filter((entry) => filter === null || entry.family === filter)
      .map((entry) => particleCard(entry, symbolOf)),
  };
}

interface Subshell {
  readonly principal: number;
  readonly orbital: number;
  readonly electrons: number;
}

export function lastSubshell(protons: number): Subshell {
  const order = Array.from({ length: protons + 1 }, (unused, principal) => principal + 1)
    .flatMap((principal) =>
      Array.from({ length: Math.min(principal, SHELL_LETTERS.length) }, (unused, orbital) => ({
        principal,
        orbital,
      })),
    )
    .sort(
      (left, right) =>
        left.principal + left.orbital - (right.principal + right.orbital) ||
        left.principal - right.principal,
    );
  let remaining = protons;
  for (const subshell of order) {
    const capacity = SPIN_STATES * (2 * subshell.orbital + 1);
    if (remaining <= capacity) {
      return { ...subshell, electrons: remaining };
    }
    remaining -= capacity;
  }
  return { principal: 1, orbital: 0, electrons: protons };
}

export interface TablePosition {
  readonly row: number;
  readonly column: number;
}

export function periodicPosition(protons: number): TablePosition {
  const { principal, orbital, electrons } = lastSubshell(protons);
  if (orbital === 0) {
    return {
      row: principal,
      column: principal === 1 && electrons === 2 ? MAIN_COLUMNS : electrons,
    };
  }
  if (orbital === 1) {
    return { row: principal, column: P_BLOCK_START_COLUMN + electrons };
  }
  if (orbital === 2) {
    return { row: principal + 1, column: D_BLOCK_START_COLUMN + electrons };
  }
  return {
    row: MAIN_ROWS + F_ROWS_GAP + 1 + principal - FIRST_F_SHELL,
    column: F_BLOCK_START_COLUMN + electrons,
  };
}

function protonsOfSpecies(species: string): readonly number[] {
  const matter = /^(?:nucleus|atom):(\d+):/.exec(species);
  if (matter !== null) {
    return [Number(matter[1])];
  }
  if (!species.startsWith('molecule:')) {
    return [];
  }
  const [atoms = ''] = species.slice('molecule:'.length).split(';');
  return atoms.split(',').map((atom) => Number(atom.split('-')[0]));
}

export function quickElements(
  source: SpeciesSource,
  recent: readonly string[],
): readonly ElementEntry[] {
  const fromMedia = source.environments.flatMap((preset) =>
    preset.components.flatMap((component) => protonsOfSpecies(component.species)),
  );
  const firstCategory = source.moleculeCategories?.[0]?.key;
  const fromSimpleSubstances = (source.molecules ?? [])
    .filter((entry) => entry.category === firstCategory)
    .flatMap((entry) => protonsOfSpecies(entry.name));
  const wanted = new Set([
    ...fromMedia,
    ...fromSimpleSubstances,
    ...recent.flatMap(protonsOfSpecies),
  ]);
  return source.elements.filter((element) => wanted.has(element.protons));
}

export function atomSpecies(protons: number, massNumber: number, charge: number): string {
  return charge === protons
    ? `nucleus:${String(protons)}:${String(massNumber)}`
    : `atom:${String(protons)}:${String(massNumber)}:${String(charge)}`;
}

export function ionCards(
  element: ElementEntry,
  symbolOf: SpeciesSymbolOf,
  chosenCharges?: readonly number[],
): readonly SpeciesCard[] {
  const affinity = element.electronAffinityInEv ?? 0;
  const charges = chosenCharges ?? [
    ...(affinity > 0 ? [-1] : []),
    ...Array.from({ length: Math.min(element.protons, IONS_SHOWN) }, (unused, index) => index + 1),
    ...(element.protons > IONS_SHOWN ? [element.protons] : []),
  ];
  const name = elementName(element);
  return charges.map((charge) => {
    const species = atomSpecies(element.protons, element.defaultMassNumber, charge);
    const title =
      charge === element.protons
        ? say(`${name}: голое ядро`, `${name}: bare nucleus`)
        : charge < 0
          ? say(`${name}: анион`, `${name}: anion`)
          : say(`${name}: катион ${chargeText(charge)}`, `${name}: cation ${chargeText(charge)}`);
    const meta =
      charge < 0
        ? say(
            `сродство к электрону ${formatNumber(affinity)} эВ`,
            `electron affinity ${formatNumber(affinity)} eV`,
          )
        : charge === 1 && element.ionizationEnergyInEv !== null
          ? say(
              `энергия ионизации ${formatNumber(element.ionizationEnergyInEv)} эВ`,
              `ionization energy ${formatNumber(element.ionizationEnergyInEv)} eV`,
            )
          : say(`заряд ${chargeText(charge)}`, `charge ${chargeText(charge)}`);
    return {
      key: `charge:${String(charge)}`,
      species,
      glyph: symbolOf(species),
      title,
      meta,
      hint: HINTS.ionMeta,
    };
  });
}

const DECAY_GLYPHS: ReadonlyArray<readonly [RegExp, string]> = [
  [/B-/g, 'β⁻'],
  [/B\+/g, 'β⁺'],
  [/^A$/, 'α'],
  [/EC/g, 'ε'],
];

const HALF_LIFE_UNITS: Readonly<Record<string, string>> = {
  ys: 'ис',
  zs: 'зс',
  as: 'ас',
  fs: 'фс',
  ps: 'пс',
  ns: 'нс',
  us: 'мкс',
  ms: 'мс',
  s: 'с',
  m: 'мин',
  h: 'ч',
  d: 'сут',
  y: 'лет',
  ky: 'тыс. лет',
  My: 'млн лет',
  Gy: 'млрд лет',
  Ty: 'трлн лет',
};

export function decayGlyph(mode: string): string {
  return DECAY_GLYPHS.reduce((text, [pattern, glyph]) => text.replace(pattern, glyph), mode);
}

export function halfLifeText(nuclide: NuclideEntry): string {
  const match = /^([\d.]+)\s*(\S+)$/.exec(nuclide.halfLifeText.trim());
  if (match === null) {
    return nuclide.halfLifeText;
  }
  const value = match[1] ?? '';
  const unit = match[2] ?? '';
  return say(`${value} ${HALF_LIFE_UNITS[unit] ?? unit}`, `${value} ${unit}`);
}

function spinText(spinParity: string | null): string | null {
  const [spin = ''] = (spinParity ?? '')
    .replace(/[()#*]/g, '')
    .split(/[\s,]/)
    .map((part) => part.replace(/[+-]$/, ''));
  return spin === '' ? null : spin;
}

export function orderedNuclides(nuclides: readonly NuclideEntry[]): readonly NuclideEntry[] {
  return [...nuclides].sort((left, right) => {
    if (left.stable !== right.stable) {
      return left.stable ? -1 : 1;
    }
    if (left.stable) {
      return (right.abundancePercent ?? 0) - (left.abundancePercent ?? 0);
    }
    return (right.halfLifeInSeconds ?? 0) - (left.halfLifeInSeconds ?? 0);
  });
}

export function nuclideCards(
  element: ElementEntry,
  nuclides: readonly NuclideEntry[],
  symbolOf: SpeciesSymbolOf,
  bare: boolean,
): readonly SpeciesCard[] {
  const name = elementName(element);
  return orderedNuclides(nuclides).map((nuclide) => {
    const species = atomSpecies(element.protons, nuclide.massNumber, bare ? element.protons : 0);
    const spin = spinText(nuclide.spinParity);
    const meta = [
      nuclide.abundancePercent === null ? null : `${formatNumber(nuclide.abundancePercent)} %`,
      spin === null ? null : say(`спин ${spin}`, `spin ${spin}`),
    ].filter((part) => part !== null);
    const decay = nuclide.decayMode === null ? '' : `${decayGlyph(nuclide.decayMode)} · `;
    return {
      key: `isotope:${String(nuclide.massNumber)}`,
      species,
      glyph: symbolOf(species),
      title:
        element.protons === 1 && nuclide.massNumber === DEUTERIUM_MASS_NUMBER && !bare
          ? say('Дейтерий', 'Deuterium')
          : `${name}-${String(nuclide.massNumber)}`,
      meta: meta.join(' · '),
      tone: nuclide.stable ? 'stable' : 'radioactive',
      hint: HINTS.nuclideMeta,
      badge: nuclide.stable
        ? { text: say('стабилен', 'stable'), stable: true, hint: HINTS.stableNuclide }
        : {
            text: `${decay}${halfLifeText(nuclide)}`,
            stable: false,
            hint: `${decayModeHint(nuclide.decayMode)}; ${say('период полураспада', 'half-life')} ${halfLifeText(nuclide)}`,
          },
    };
  });
}

export function nuclideSummary(element: ElementEntry, nuclides: readonly NuclideEntry[]): string {
  const stable = nuclides.filter((nuclide) => nuclide.stable).length;
  const radioactive = nuclides.length - stable;
  return say(
    `Z = ${String(element.protons)} · стабильных ${String(stable)} · радиоактивных ${String(radioactive)}`,
    `Z = ${String(element.protons)} · ${String(stable)} stable · ${String(radioactive)} radioactive`,
  );
}

export interface MoleculeSection {
  readonly key: string;
  readonly title: string;
  readonly cards: readonly SpeciesCard[];
}

export function moleculeMeta(entry: MoleculeCatalogEntry): string {
  return [
    entry.massInDaltons === undefined
      ? null
      : `${entry.massInDaltons.toFixed(MOLECULE_MASS_DECIMALS)} u`,
    entry.radical === true ? say('радикал', 'radical') : null,
    entry.linear === true ? say('линейная', 'linear') : null,
  ]
    .filter((part) => part !== null)
    .join(' · ');
}

function moleculeCard(entry: MoleculeCatalogEntry): SpeciesCard {
  return {
    key: entry.key,
    species: entry.name,
    glyph: entry.formula,
    title: localize(entry.label),
    meta: moleculeMeta(entry),
    tone: 'molecule',
    hint: HINTS.moleculeMeta,
  };
}

export function moleculeGroups(source: SpeciesSource): readonly FilterChip[] {
  const categories = source.moleculeCategories ?? [];
  const molecules = source.molecules ?? [];
  return (source.moleculeGroups ?? []).map((group) => {
    const inGroup = new Set(
      categories.filter((category) => category.group === group.key).map((category) => category.key),
    );
    return {
      key: group.key,
      label: localize(group.label),
      count: molecules.filter((entry) => inGroup.has(entry.category)).length,
    };
  });
}

export function normalized(text: string): string {
  return text
    .toLowerCase()
    .split('')
    .map((glyph) => {
      const lower = SUBSCRIPT_DIGITS.indexOf(glyph);
      const upper = SUPERSCRIPT_DIGITS.indexOf(glyph);
      if (lower >= 0) {
        return String(lower);
      }
      if (upper >= 0) {
        return String(upper);
      }
      return glyph === '⁺' ? '+' : glyph === '⁻' || glyph === '−' ? '-' : glyph;
    })
    .join('')
    .replace(/\s+/g, '');
}

export function moleculeSections(
  source: SpeciesSource,
  group: string | null,
  query: string,
): readonly MoleculeSection[] {
  const needle = normalized(query);
  const molecules = (source.molecules ?? []).filter(
    (entry) =>
      needle === '' ||
      normalized(entry.formula).includes(needle) ||
      normalized(localize(entry.label)).includes(needle),
  );
  return (source.moleculeCategories ?? [])
    .filter((category) => needle !== '' || group === null || category.group === group)
    .map((category) => ({
      key: category.key,
      title: localize(category.label),
      cards: molecules.filter((entry) => entry.category === category.key).map(moleculeCard),
    }))
    .filter((section) => section.cards.length > 0);
}

export interface MixtureSection {
  readonly title: string;
  readonly presets: readonly EnvironmentPreset[];
}

export function mixtureSections(source: SpeciesSource): readonly MixtureSection[] {
  const titles = [...new Set(source.environments.map((preset) => localize(preset.group)))];
  return titles.map((title) => ({
    title,
    presets: source.environments.filter((preset) => localize(preset.group) === title),
  }));
}

function searchCandidates(
  source: SpeciesSource,
  symbolOf: SpeciesSymbolOf,
): readonly SpeciesCard[] {
  const particles = source.particles
    .filter((entry) => entry.family !== 'diquark')
    .map((entry) => particleCard(entry, symbolOf));
  const atoms = source.elements.flatMap((element) => {
    const name = elementName(element);
    const neutral = atomSpecies(element.protons, element.defaultMassNumber, 0);
    const isotopes = element.isotopes.map((isotope) => {
      const species = atomSpecies(element.protons, isotope.massNumber, 0);
      const share = formatNumber(isotope.abundance * PERCENT);
      return {
        key: species,
        species,
        glyph: symbolOf(species),
        title: `${name}-${String(isotope.massNumber)}`,
        meta: say(`в природе ${share} %`, `natural ${share} %`),
        hint: HINTS.atomMeta,
      };
    });
    return [
      {
        key: neutral,
        species: neutral,
        glyph: symbolOf(neutral),
        title: name,
        meta: `Z = ${String(element.protons)}`,
        hint: HINTS.atomMeta,
      },
      ...isotopes,
      ...ionCards(element, symbolOf),
    ];
  });
  return [...(source.molecules ?? []).map(moleculeCard), ...atoms, ...particles];
}

function nucleusCandidates(
  source: SpeciesSource,
  symbolOf: SpeciesSymbolOf,
): readonly SpeciesCard[] {
  return source.elements.flatMap((element) => {
    const name = elementName(element);
    const massNumbers = [
      ...new Set([
        element.defaultMassNumber,
        ...element.isotopes.map((isotope) => isotope.massNumber),
      ]),
    ];
    return massNumbers.map((massNumber) => {
      const species = atomSpecies(element.protons, massNumber, element.protons);
      const abundance = element.isotopes.find((isotope) => isotope.massNumber === massNumber);
      const share = formatNumber((abundance?.abundance ?? 0) * PERCENT);
      return {
        key: species,
        species,
        glyph: symbolOf(species),
        title: `${name}-${String(massNumber)}`,
        meta:
          abundance === undefined
            ? `Z = ${String(element.protons)}`
            : say(`в природе ${share} %`, `natural ${share} %`),
        hint: HINTS.nuclideMeta,
      };
    });
  });
}

export function searchSpecies(
  source: SpeciesSource,
  query: string,
  symbolOf: SpeciesSymbolOf,
  nucleiOnly = false,
): readonly SpeciesCard[] {
  const needle = normalized(query);
  if (needle === '') {
    return [];
  }
  const candidates = nucleiOnly
    ? nucleusCandidates(source, symbolOf)
    : searchCandidates(source, symbolOf);
  const ranked = candidates.flatMap((card) => {
    const glyph = normalized(card.glyph);
    const title = normalized(card.title);
    const rank =
      glyph === needle || title === needle
        ? 0
        : glyph.startsWith(needle) || title.startsWith(needle)
          ? 1
          : glyph.includes(needle) || title.includes(needle)
            ? 2
            : null;
    return rank === null ? [] : [{ card, rank }];
  });
  const seen = new Set<string>();
  return ranked
    .sort((left, right) => left.rank - right.rank)
    .map((entry) => entry.card)
    .filter((card) => {
      if (seen.has(card.species)) {
        return false;
      }
      seen.add(card.species);
      return true;
    })
    .slice(0, SEARCH_LIMIT);
}

export function breadcrumbs(
  source: SpeciesSource,
  kind: MatterKind,
  screen: SpeciesScreen,
): readonly Crumb[] {
  const root: Crumb = { label: kindTitle(kind), target: { view: 'root' } };
  switch (screen.view) {
    case 'root':
      return [];
    case 'particles':
      return [
        root,
        { label: classTitle(screen.speciesClass), target: { ...screen, filter: null } },
      ];
    case 'atoms': {
      const element = source.elements.find((entry) => entry.protons === screen.protons);
      return [
        root,
        { label: classTitle('atoms'), target: { view: 'atoms', mode: 'neutral', protons: null } },
        { label: modeTitle(screen.mode), target: { ...screen, protons: null } },
        ...(element === undefined ? [] : [{ label: elementName(element), target: screen }]),
      ];
    }
    case 'nuclei': {
      const element = source.elements.find((entry) => entry.protons === screen.protons);
      return [
        root,
        { label: classTitle('nuclei'), target: { view: 'nuclei', protons: null } },
        ...(element === undefined ? [] : [{ label: elementName(element), target: screen }]),
      ];
    }
    case 'molecules': {
      const group = source.moleculeGroups?.find((entry) => entry.key === screen.group);
      const target: SpeciesScreen = { ...screen, selected: null };
      return [
        root,
        { label: classTitle('molecules'), target },
        ...(group === undefined ? [] : [{ label: localize(group.label), target }]),
      ];
    }
    case 'mixtures':
      return [root, { label: classTitle('mixtures'), target: screen }];
  }
}

export function parentScreen(screen: SpeciesScreen): SpeciesScreen {
  if ((screen.view === 'atoms' || screen.view === 'nuclei') && screen.protons !== null) {
    return { ...screen, protons: null };
  }
  return { view: 'root' };
}

export function speciesCaption(
  source: Pick<SpeciesSource, 'elements' | 'molecules'>,
  name: string,
  symbolOf: SpeciesSymbolOf,
): string {
  const known = PARTICLE_GLOSSARY[name];
  if (known !== undefined) {
    return known;
  }
  const molecule = source.molecules?.find((entry) => entry.name === name);
  if (molecule !== undefined) {
    return localize(molecule.label);
  }
  if (name.startsWith('molecule:')) {
    return say(`молекула ${symbolOf(name)}`, `molecule ${symbolOf(name)}`);
  }
  const match = /^(nucleus|atom):(\d+):(\d+)(?::(-?\d+))?$/.exec(name);
  const element = source.elements.find((entry) => entry.protons === Number(match?.[2]));
  if (match === null || element === undefined) {
    return name;
  }
  const isotope = `${elementName(element)}-${match[3] ?? ''}`;
  const charge = Number(match[4] ?? 0);
  if (match[1] === 'nucleus') {
    return say(`ядро ${isotope}`, `nucleus ${isotope}`);
  }
  if (charge === 0) {
    return isotope;
  }
  return charge > 0
    ? say(
        `ион ${isotope}, заряд ${chargeText(charge)}`,
        `ion ${isotope}, charge ${chargeText(charge)}`,
      )
    : say(`анион ${isotope}`, `anion ${isotope}`);
}

const ATOM_NAME = /^atom:(\d+):(\d+):(-?\d+)$/;

export function atomStepFields(
  species: string,
  defaultMassNumber: (protons: number) => number | undefined,
): { readonly protons: number; readonly massNumber?: number; readonly charge?: number } | null {
  const match = ATOM_NAME.exec(species);
  if (match === null) {
    return null;
  }
  const protons = Number(match[1]);
  const massNumber = Number(match[2]);
  const charge = Number(match[3]);
  return {
    protons,
    ...(defaultMassNumber(protons) === massNumber ? {} : { massNumber }),
    ...(charge === 0 ? {} : { charge }),
  };
}

const NUCLEUS_NAME = /^nucleus:(\d+):(\d+)$/;

export function nucleusStepFields(
  species: string,
): { readonly protons: number; readonly massNumber: number } | null {
  const match = NUCLEUS_NAME.exec(species);
  return match === null ? null : { protons: Number(match[1]), massNumber: Number(match[2]) };
}
