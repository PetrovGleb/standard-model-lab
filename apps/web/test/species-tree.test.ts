/* Checks the species picker model: periodic table places from the Madelung filling order, class cards for matter and antimatter, ions, nuclides ordered stable first, molecule groups,
   search over formulas, symbols and names, and breadcrumbs back to every earlier screen. */
import type { ElementEntry, NuclideEntry, ParticleCatalogEntry } from '@standard-model/contracts';
import { describe, expect, it } from 'vitest';
import { speciesSymbolResolver } from '../src/species';
import {
  atomStepFields,
  breadcrumbs,
  classCards,
  ionCards,
  moleculeGroups,
  moleculeSections,
  nucleusStepFields,
  nuclideCards,
  openClass,
  particleScreen,
  periodicPosition,
  quickElements,
  searchSpecies,
  speciesCaption,
  type SpeciesSource,
} from '../src/species-tree';

function particle(
  name: string,
  family: string,
  pdgId: number,
  symbol: string,
): ParticleCatalogEntry {
  return {
    name,
    family,
    pdgId,
    symbol,
    massInGev: { value: 0.000511 },
    electricChargeInElementaryUnits: -1,
  } as unknown as ParticleCatalogEntry;
}

function element(
  protons: number,
  symbol: string,
  russian: string,
  defaultMassNumber: number,
  isotopes: readonly { massNumber: number; abundance: number }[],
  electronAffinityInEv: number | null,
): ElementEntry {
  return {
    protons,
    symbol,
    name: symbol,
    label: { ru: russian, en: symbol },
    defaultMassNumber,
    isotopes,
    electronAffinityInEv,
    ionizationEnergyInEv: null,
  } as unknown as ElementEntry;
}

function nuclide(
  massNumber: number,
  stable: boolean,
  abundancePercent: number | null,
  halfLifeInSeconds: number | null,
  halfLifeText: string,
  decayMode: string | null,
): NuclideEntry {
  return {
    massNumber,
    stable,
    abundancePercent,
    halfLifeInSeconds,
    halfLifeText,
    decayMode,
    spinParity: '0+',
  };
}

const WATER = 'molecule:8-16,1-1,1-1;0-1-1,0-2-1';
const HYDROGEN = 'molecule:1-1,1-1;0-1-1';

const source: SpeciesSource = {
  particles: [
    particle('electron', 'chargedLepton', 11, 'e-'),
    particle('electronNeutrino', 'neutrino', 12, 'νe'),
    particle('positron', 'chargedLepton', -11, 'e+'),
    particle('photon', 'gaugeBoson', 22, 'γ'),
    particle('antiDeuteron', 'nucleus', -1000010020, 'd̄'),
  ],
  elements: [
    element(
      1,
      'H',
      'Водород',
      1,
      [
        { massNumber: 1, abundance: 0.9998 },
        { massNumber: 2, abundance: 0.0002 },
      ],
      0.75,
    ),
    element(8, 'O', 'Кислород', 16, [{ massNumber: 16, abundance: 0.9976 }], 1.46),
    element(
      17,
      'Cl',
      'Хлор',
      35,
      [
        { massNumber: 35, abundance: 0.76 },
        { massNumber: 37, abundance: 0.24 },
      ],
      3.61,
    ),
    element(92, 'U', 'Уран', 238, [{ massNumber: 238, abundance: 0.9927 }], null),
  ],
  molecules: [
    {
      key: 'hydrogen',
      name: HYDROGEN as never,
      formula: 'H₂',
      label: { ru: 'водород', en: 'hydrogen' },
      category: 'elementMolecules',
      massInDaltons: 2.01565,
      linear: true,
      radical: false,
    },
    {
      key: 'water',
      name: WATER as never,
      formula: 'H₂O',
      label: { ru: 'вода', en: 'water' },
      category: 'waterAndOxides',
      massInDaltons: 18.0106,
      linear: false,
      radical: false,
    },
  ],
  moleculeCategories: [
    {
      key: 'elementMolecules',
      label: { ru: 'Простые вещества', en: 'Elements' },
      group: 'inorganic',
    },
    {
      key: 'waterAndOxides',
      label: { ru: 'Вода и оксиды', en: 'Water and oxides' },
      group: 'inorganic',
    },
    { key: 'aminoAcids', label: { ru: 'Аминокислоты', en: 'Amino acids' }, group: 'biomolecules' },
  ],
  moleculeGroups: [
    { key: 'inorganic', label: { ru: 'Неорганические', en: 'Inorganic' } },
    { key: 'biomolecules', label: { ru: 'Биомолекулы', en: 'Biomolecules' } },
  ],
  environments: [
    {
      name: 'air',
      group: { ru: 'Атмосфера', en: 'Atmosphere' },
      title: { ru: 'Воздух', en: 'Air' },
      components: [{ species: 'atom:18:40:0' as never, numberDensityPerCubicMeter: 1 }],
      temperatureInKelvin: 288,
      pressureInPascals: 101325,
      radiationTemperatureInKelvin: null,
      source: '',
      note: { ru: '', en: '' },
    },
  ],
};

const symbolOf = speciesSymbolResolver(source);

describe('periodic table', () => {
  it('places elements by the last subshell of the Madelung filling order', () => {
    expect(periodicPosition(1)).toEqual({ row: 1, column: 1 });
    expect(periodicPosition(2)).toEqual({ row: 1, column: 18 });
    expect(periodicPosition(6)).toEqual({ row: 2, column: 14 });
    expect(periodicPosition(10)).toEqual({ row: 2, column: 18 });
    expect(periodicPosition(21)).toEqual({ row: 4, column: 3 });
    expect(periodicPosition(30)).toEqual({ row: 4, column: 12 });
    expect(periodicPosition(31)).toEqual({ row: 4, column: 13 });
    expect(periodicPosition(57)).toEqual({ row: 9, column: 3 });
    expect(periodicPosition(70)).toEqual({ row: 9, column: 16 });
    expect(periodicPosition(71)).toEqual({ row: 6, column: 3 });
    expect(periodicPosition(92)).toEqual({ row: 10, column: 6 });
  });
});

describe('species picker model', () => {
  it('offers eight classes and disables what antimatter lacks', () => {
    const matter = classCards(source, 'matter', symbolOf);
    expect(matter.map((card) => card.key)).toEqual([
      'bosons',
      'quarks',
      'leptons',
      'hadrons',
      'nuclei',
      'atoms',
      'molecules',
      'mixtures',
    ]);
    expect(matter.filter((card) => card.enabled).map((card) => card.key)).toEqual([
      'bosons',
      'leptons',
      'nuclei',
      'atoms',
      'molecules',
      'mixtures',
    ]);
    const antimatter = classCards(source, 'antimatter', symbolOf);
    expect(antimatter.filter((card) => card.enabled).map((card) => card.key)).toEqual([
      'leptons',
      'nuclei',
    ]);
  });

  it('opens atoms and nuclei by element for matter and as catalog particles for antimatter', () => {
    expect(openClass(source, 'matter', 'atoms')).toEqual({
      view: 'atoms',
      mode: 'neutral',
      protons: null,
    });
    expect(openClass(source, 'antimatter', 'nuclei')).toEqual({
      view: 'particles',
      speciesClass: 'nuclei',
      filter: null,
    });
    expect(openClass(source, 'matter', 'molecules')).toEqual({
      view: 'molecules',
      group: 'inorganic',
      selected: null,
    });
  });

  it('filters particles by family', () => {
    const leptons = particleScreen(source, 'matter', 'leptons', null, symbolOf);
    expect(leptons.filters.map((chip) => [chip.key, chip.count])).toEqual([
      ['chargedLepton', 1],
      ['neutrino', 1],
    ]);
    expect(
      particleScreen(source, 'matter', 'leptons', 'neutrino', symbolOf).cards.map(
        (card) => card.species,
      ),
    ).toEqual(['electronNeutrino']);
  });

  it('lists the anion first and the bare nucleus last among ions', () => {
    const chlorine = source.elements[2];
    const uranium = source.elements[3];
    expect(
      chlorine === undefined ? [] : ionCards(chlorine, symbolOf).map((card) => card.species)[0],
    ).toBe('atom:17:35:-1');
    expect(
      uranium === undefined ? [] : ionCards(uranium, symbolOf).map((card) => card.species),
    ).toEqual([
      'atom:92:238:1',
      'atom:92:238:2',
      'atom:92:238:3',
      'atom:92:238:4',
      'nucleus:92:238',
    ]);
  });

  it('orders nuclides stable by abundance, then radioactive by half-life', () => {
    const oxygen = source.elements[1];
    const nuclides = [
      nuclide(14, false, null, 70.6, '70.6 s', 'B+'),
      nuclide(17, true, 0.038, null, 'stbl', null),
      nuclide(15, false, null, 122, '122 s', 'B+'),
      nuclide(16, true, 99.757, null, 'stbl', null),
    ];
    const cards = oxygen === undefined ? [] : nuclideCards(oxygen, nuclides, symbolOf, false);
    expect(cards.map((card) => card.species)).toEqual([
      'atom:8:16:0',
      'atom:8:17:0',
      'atom:8:15:0',
      'atom:8:14:0',
    ]);
    expect(cards[0]?.badge?.stable).toBe(true);
    expect(cards[2]?.badge?.text).toBe('β⁺ · 122 с');
    expect(
      oxygen === undefined ? [] : nuclideCards(oxygen, nuclides, symbolOf, true)[0]?.species,
    ).toBe('nucleus:8:16');
  });

  it('groups molecules and finds them by formula or name', () => {
    expect(moleculeGroups(source).map((chip) => [chip.key, chip.count])).toEqual([
      ['inorganic', 2],
      ['biomolecules', 0],
    ]);
    expect(moleculeSections(source, 'inorganic', '').map((section) => section.key)).toEqual([
      'elementMolecules',
      'waterAndOxides',
    ]);
    expect(
      moleculeSections(source, 'biomolecules', 'h2o').flatMap((section) =>
        section.cards.map((card) => card.species),
      ),
    ).toEqual([WATER]);
  });

  it('searches every species by symbol, formula and name', () => {
    expect(searchSpecies(source, 'H2O', symbolOf)[0]?.species).toBe(WATER);
    expect(searchSpecies(source, 'Cl-', symbolOf).map((card) => card.species)).toContain(
      'atom:17:35:-1',
    );
    expect(searchSpecies(source, '37cl', symbolOf)[0]?.species).toBe('atom:17:37:0');
    expect(searchSpecies(source, 'кисл', symbolOf)[0]?.species).toBe('atom:8:16:0');
    expect(searchSpecies(source, '', symbolOf)).toEqual([]);
  });

  it('builds breadcrumbs back to the class and the subcategory', () => {
    const crumbs = breadcrumbs(source, 'matter', { view: 'atoms', mode: 'isotope', protons: 8 });
    expect(crumbs.map((crumb) => crumb.label)).toEqual([
      'Вещество',
      'Атомы',
      'Изотопы',
      'Кислород',
    ]);
    expect(crumbs[2]?.target).toEqual({ view: 'atoms', mode: 'isotope', protons: null });
  });

  it('takes quick elements from preset media, simple substances and recent picks', () => {
    expect(quickElements(source, ['atom:92:235:0']).map((entry) => entry.symbol)).toEqual([
      'H',
      'U',
    ]);
  });

  it('names a chosen species for the component button', () => {
    expect(speciesCaption(source, WATER, symbolOf)).toBe('вода');
    expect(speciesCaption(source, 'atom:17:35:-1', symbolOf)).toBe('анион Хлор-35');
    expect(speciesCaption(source, 'nucleus:92:235', symbolOf)).toBe('ядро Уран-235');
  });

  it('turns a picked atom or cation into create-atom fields and lists chosen charges', () => {
    const defaults: Readonly<Record<number, number>> = { 11: 23, 17: 35 };
    const defaultMassNumber = (protons: number): number | undefined => defaults[protons];
    expect(atomStepFields('atom:11:23:0', defaultMassNumber)).toEqual({ protons: 11 });
    expect(atomStepFields('atom:11:22:1', defaultMassNumber)).toEqual({
      protons: 11,
      massNumber: 22,
      charge: 1,
    });
    expect(atomStepFields('nucleus:11:23', defaultMassNumber)).toBeNull();
    const chlorine = source.elements[2];
    expect(
      chlorine === undefined
        ? []
        : ionCards(chlorine, symbolOf, [1, 2, 16]).map((card) => card.species),
    ).toEqual(['atom:17:35:1', 'atom:17:35:2', 'atom:17:35:16']);
  });

  it('finds nuclei only in the nucleus scope and turns one into create-nucleus fields', () => {
    const uranium = searchSpecies(source, 'уран', symbolOf, true).map((card) => card.species);
    expect(uranium).toEqual(['nucleus:92:238']);
    expect(searchSpecies(source, 'H2O', symbolOf, true)).toEqual([]);
    expect(nucleusStepFields('nucleus:92:235')).toEqual({ protons: 92, massNumber: 235 });
    expect(nucleusStepFields('atom:92:235:0')).toBeNull();
  });
});
