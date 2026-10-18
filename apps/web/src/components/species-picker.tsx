/* SpeciesPicker: the medium component modal over a blurred backdrop: matter or antimatter and a class on the first screen, then particles, atoms, ions, isotopes and nuclei on a periodic
   table, catalogue molecules by group or preset mixtures, with breadcrumbs, a back button, search over every species and the viewer's recent picks. */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronLeft, ChevronRight, Info, Plus, Search, X } from 'lucide-react';
import type { ElementEntry, NuclideEntry } from '@standard-model/contracts';
import { api } from '../api';
import { formatNumber } from '../format';
import { CLASS_HINTS, HINTS, KIND_HINTS, MODE_HINTS } from '../hints';
import { localize, say } from '../language';
import type { MatterKind } from '../presets';
import type { SpeciesSymbolOf } from '../species';
import {
  atomSpecies,
  breadcrumbs,
  classCards,
  elementName,
  elementSummary,
  ionCards,
  kindTitle,
  modeTitle,
  moleculeGroups,
  moleculeSections,
  mixtureSections,
  nuclideCards,
  nuclideSummary,
  openClass,
  parentScreen,
  particleScreen,
  periodicPosition,
  quickElements,
  searchSpecies,
  type AtomMode,
  type PickedComponent,
  type SpeciesCard,
  type SpeciesScreen,
  type SpeciesSource,
} from '../species-tree';
import { SmlIcon } from './sml-icon';

interface Props {
  readonly source: SpeciesSource;
  readonly symbolOf: SpeciesSymbolOf;
  readonly onPick: (components: readonly PickedComponent[]) => void;
  readonly onClose: () => void;
  readonly allowMixtures?: boolean;
  readonly scope?: PickerScope;
}

export type PickerScope = 'medium' | 'molecule' | 'moleculeAtom' | 'atom' | 'nucleus';

const NEUTRAL_ATOM = /^atom:\d+:\d+:0$/;
const CATION_OR_NEUTRAL_ATOM = /^atom:\d+:\d+:\d+$/;
const RECENT_KEY = 'standard-model.recent-species';
const RECENT_SHOWN = 6;
const SUBSCRIPT_DIGITS = '₀₁₂₃₄₅₆₇₈₉';
const SUBSCRIPT_RUN = /^[₀-₉]+$/;
const FORMULA_PIXELS = 24;
const SMALLEST_FORMULA_PIXELS = 13;
const KINDS: readonly MatterKind[] = ['matter', 'antimatter'];
const ATOM_MODES: readonly AtomMode[] = ['neutral', 'ion', 'isotope'];
const MODE_ICONS: Readonly<Record<AtomMode, string>> = {
  neutral: 'atom',
  ion: 'ion-positive',
  isotope: 'isotope',
};

function readRecent(): readonly string[] {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(stored) ? stored.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function rememberRecent(species: readonly string[]): void {
  try {
    const next = [...new Set([...species, ...readRecent()])].slice(0, RECENT_SHOWN);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    return;
  }
}

function screenKey(screen: SpeciesScreen): string {
  return JSON.stringify(screen.view === 'molecules' ? { ...screen, selected: null } : screen);
}

function toneStyle(tone: string | undefined): CSSProperties {
  return { '--tone': `var(--fam-${tone ?? 'atom'}, var(--accent))` } as CSSProperties;
}

function kindHint(kind: MatterKind): string {
  return kind === 'matter'
    ? say('обычные частицы, атомы, молекулы', 'ordinary particles, atoms, molecules')
    : say('позитроны, антипротоны, антиатомы', 'positrons, antiprotons, antiatoms');
}

function modeHint(mode: AtomMode, elements: number): string {
  switch (mode) {
    case 'neutral':
      return say(`${String(elements)} элементов`, `${String(elements)} elements`);
    case 'ion':
      return say('катионы и анионы, голое ядро', 'cations and anions, bare nucleus');
    case 'isotope':
      return say('стабильные и радиоактивные', 'stable and radioactive');
  }
}

function SpeciesCardButton({
  card,
  onPick,
}: {
  readonly card: SpeciesCard;
  readonly onPick: (species: string) => void;
}) {
  return (
    <button
      type="button"
      className="picker-card"
      style={toneStyle(card.tone)}
      onClick={() => onPick(card.species)}
    >
      <span className="picker-avatar">{card.glyph}</span>
      <span className="picker-card-text">
        <span className="picker-card-title">
          {card.title}
          {card.badge !== undefined && (
            <span
              className={card.badge.stable ? 'picker-badge stable' : 'picker-badge'}
              data-tooltip={card.badge.hint}
            >
              {card.badge.text}
            </span>
          )}
        </span>
        {card.meta !== '' && (
          <span className="picker-card-meta" data-tooltip={card.hint}>
            {card.meta}
          </span>
        )}
      </span>
      <ChevronRight className="picker-card-next" size={16} aria-hidden="true" />
    </button>
  );
}

function FormulaText({ formula }: { readonly formula: string }) {
  const parts = formula.split(/([₀-₉]+)/).filter((part) => part !== '');
  const box = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const element = box.current;
    if (element === null) {
      return;
    }
    let size = FORMULA_PIXELS;
    element.style.fontSize = `${String(size)}px`;
    while (element.scrollWidth > element.clientWidth && size > SMALLEST_FORMULA_PIXELS) {
      size -= 1;
      element.style.fontSize = `${String(size)}px`;
    }
  }, [formula]);
  return (
    <span ref={box} className="picker-formula">
      {parts.map((part, index) =>
        SUBSCRIPT_RUN.test(part) ? (
          <sub key={index}>
            {part
              .split('')
              .map((glyph) => String(SUBSCRIPT_DIGITS.indexOf(glyph)))
              .join('')}
          </sub>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </span>
  );
}

function PeriodicTable({
  elements,
  selected,
  onSelect,
}: {
  readonly elements: readonly ElementEntry[];
  readonly selected: number | null;
  readonly onSelect: (element: ElementEntry) => void;
}) {
  const [hovered, setHovered] = useState<ElementEntry | null>(null);
  return (
    <>
      <p className="periodic-caption" aria-live="polite">
        {hovered === null
          ? say(
              'Наведите на клетку: имя, атомная масса и электронная конфигурация',
              'Hover a cell: name, atomic weight and electron configuration',
            )
          : elementSummary(hovered)}
      </p>
      <div className="periodic-scroll" onMouseLeave={() => setHovered(null)}>
        <div className="periodic-table">
          {elements.map((element) => {
            const position = periodicPosition(element.protons);
            return (
              <button
                key={element.protons}
                type="button"
                className={
                  element.protons === selected ? 'periodic-cell selected' : 'periodic-cell'
                }
                style={{ gridRow: position.row, gridColumn: position.column }}
                data-tooltip={elementSummary(element)}
                aria-label={elementName(element)}
                onMouseEnter={() => setHovered(element)}
                onFocus={() => setHovered(element)}
                onClick={() => onSelect(element)}
              >
                <span className="periodic-number">{element.protons}</span>
                <span className="periodic-symbol">{element.symbol}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

function ElementBox({
  elements,
  selected,
  onSelect,
  onTable,
}: {
  readonly elements: readonly ElementEntry[];
  readonly selected: number | null;
  readonly onSelect: (element: ElementEntry) => void;
  readonly onTable: () => void;
}) {
  return (
    <div className="picker-element-box">
      <h4 className="picker-eyebrow" data-tooltip={HINTS.quickElements}>
        {say('Элемент', 'Element')}
      </h4>
      <div className="picker-element-chips">
        {elements.map((element) => (
          <button
            key={element.protons}
            type="button"
            className={element.protons === selected ? 'picker-element selected' : 'picker-element'}
            data-tooltip={elementSummary(element)}
            onClick={() => onSelect(element)}
          >
            {element.symbol}
          </button>
        ))}
      </div>
      <button type="button" className="picker-link" onClick={onTable}>
        {say('вся таблица', 'whole table')}
        <ChevronRight size={14} aria-hidden="true" />
      </button>
    </div>
  );
}

function NuclideList({
  element,
  bare,
  note,
  symbolOf,
  onPick,
}: {
  readonly element: ElementEntry;
  readonly bare: boolean;
  readonly note: string;
  readonly symbolOf: SpeciesSymbolOf;
  readonly onPick: (species: string) => void;
}) {
  const [loaded, setLoaded] = useState<{
    readonly protons: number;
    readonly nuclides: readonly NuclideEntry[] | null;
  } | null>(null);
  useEffect(() => {
    let active = true;
    api
      .nuclides(element.protons)
      .then((nuclides) => active && setLoaded({ protons: element.protons, nuclides }))
      .catch(() => active && setLoaded({ protons: element.protons, nuclides: null }));
    return () => {
      active = false;
    };
  }, [element.protons]);
  const nuclides = loaded?.protons === element.protons ? loaded.nuclides : undefined;
  const name = elementName(element);
  return (
    <>
      <h4 className="picker-eyebrow">
        {bare
          ? say(`Ядра: ${name}`, `Nuclei: ${name}`)
          : say(`Изотопы: ${name}`, `Isotopes: ${name}`)}
        {nuclides !== undefined && nuclides !== null && (
          <span className="picker-eyebrow-note">{nuclideSummary(element, nuclides)}</span>
        )}
      </h4>
      {nuclides === undefined && (
        <p className="hint">{say('Загружаю нуклиды…', 'Loading nuclides…')}</p>
      )}
      {nuclides === null && (
        <p className="hint">{say('Не удалось загрузить нуклиды', 'Could not load nuclides')}</p>
      )}
      {nuclides !== undefined && nuclides !== null && (
        <div className="picker-cards two">
          {nuclideCards(element, nuclides, symbolOf, bare).map((card) => (
            <SpeciesCardButton key={card.key} card={card} onPick={onPick} />
          ))}
        </div>
      )}
      <p className="picker-note">
        <Info size={14} aria-hidden="true" />
        {note}
      </p>
    </>
  );
}

function initialScreen(source: SpeciesSource, scope: PickerScope): SpeciesScreen {
  switch (scope) {
    case 'medium':
      return { view: 'root' };
    case 'molecule':
      return openClass(source, 'matter', 'molecules');
    case 'moleculeAtom':
    case 'atom':
      return { view: 'atoms', mode: 'neutral', protons: null };
    case 'nucleus':
      return { view: 'nuclei', protons: null };
  }
}

function scopeTitle(scope: PickerScope): string {
  switch (scope) {
    case 'medium':
      return say('Компонент среды', 'Medium component');
    case 'molecule':
      return say('Молекула из каталога', 'Molecule from the catalogue');
    case 'moleculeAtom':
      return say('Атом молекулы', 'Atom of the molecule');
    case 'atom':
      return say('Атом или ион', 'Atom or ion');
    case 'nucleus':
      return say('Ядро', 'Nucleus');
  }
}

function nuclideNoteOf(scope: PickerScope): string {
  switch (scope) {
    case 'moleculeAtom':
      return say(
        'Выбор изотопа сразу ставит атом в молекулу. Полураспады и спины из NUBASE2020.',
        'Picking an isotope puts the atom into the molecule at once. Half-lives and spins are from NUBASE2020.',
      );
    case 'atom':
      return say(
        'Выбор изотопа сразу задаёт атом шага. Полураспады и спины из NUBASE2020.',
        'Picking an isotope sets the atom of the step at once. Half-lives and spins are from NUBASE2020.',
      );
    case 'nucleus':
      return say(
        'Выбор нуклида сразу задаёт ядро шага. Полураспады и спины из NUBASE2020.',
        'Picking a nuclide sets the nucleus of the step at once. Half-lives and spins are from NUBASE2020.',
      );
    case 'medium':
    case 'molecule':
      return say(
        'Выбор нуклида сразу создаёт компонент; концентрацию и сечение задайте в строке таблицы. Полураспады и спины из NUBASE2020.',
        'Picking a nuclide creates the component at once; set its density and cross section in the table row. Half-lives and spins are from NUBASE2020.',
      );
  }
}

export function SpeciesPicker({
  source,
  symbolOf,
  onPick,
  onClose,
  allowMixtures = true,
  scope = 'medium',
}: Props) {
  const [kind, setKind] = useState<MatterKind>('matter');
  const [screen, setScreen] = useState<SpeciesScreen>(() => initialScreen(source, scope));
  const [query, setQuery] = useState('');
  const [recent] = useState(readRecent);
  const quick = useMemo(() => quickElements(source, recent), [source, recent]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const pick = (components: readonly PickedComponent[]): void => {
    rememberRecent(components.map((component) => component.species));
    onPick(components);
  };
  const pickOne = (species: string): void => pick([{ species }]);
  const navigate = (next: SpeciesScreen): void => {
    setQuery('');
    setScreen(next);
  };
  const allCrumbs = breadcrumbs(source, kind, screen);
  const crumbs = scope === 'medium' ? allCrumbs : allCrumbs.slice(1);
  const atTop = screenKey(screen) === screenKey(initialScreen(source, scope));
  const parent = parentScreen(screen);
  const back = scope !== 'medium' && parent.view === 'root' ? initialScreen(source, scope) : parent;
  const modes = scope === 'moleculeAtom' ? ATOM_MODES.filter((mode) => mode !== 'ion') : ATOM_MODES;
  const ionsOf = (element: ElementEntry): readonly SpeciesCard[] =>
    scope === 'atom'
      ? ionCards(
          element,
          symbolOf,
          Array.from({ length: element.protons - 1 }, (unused, index) => index + 1),
        )
      : ionCards(element, symbolOf);
  const nuclideNote = nuclideNoteOf(scope);
  const moleculeView = screen.view === 'molecules';
  const searching = query.trim() !== '' && !moleculeView;

  const elementSelect = (element: ElementEntry): void => {
    if (screen.view === 'atoms' && screen.mode === 'neutral') {
      pickOne(atomSpecies(element.protons, element.defaultMassNumber, 0));
      return;
    }
    if (screen.view === 'atoms' || screen.view === 'nuclei') {
      setScreen({ ...screen, protons: element.protons });
    }
  };

  const renderRoot = () => (
    <>
      <section className="picker-section">
        <h4 className="picker-eyebrow">
          {say('Шаг 1 · из чего состоит', 'Step 1 · what it is made of')}
        </h4>
        <div className="picker-kinds">
          {KINDS.map((candidate) => (
            <button
              key={candidate}
              type="button"
              className={candidate === kind ? 'picker-kind selected' : 'picker-kind'}
              data-tooltip={KIND_HINTS[candidate]}
              aria-pressed={candidate === kind}
              onClick={() => setKind(candidate)}
            >
              <span
                className="picker-icon"
                style={toneStyle(candidate === 'matter' ? 'scalarBoson' : 'quark')}
              >
                <SmlIcon name={candidate} size={22} aria-hidden="true" />
              </span>
              <span className="picker-kind-text">
                <strong>{kindTitle(candidate)}</strong>
                <small>{kindHint(candidate)}</small>
              </span>
              {candidate === kind && (
                <Check className="picker-kind-check" size={18} aria-hidden="true" />
              )}
            </button>
          ))}
        </div>
      </section>
      <section className="picker-section">
        <h4 className="picker-eyebrow">{say('Шаг 2 · класс', 'Step 2 · class')}</h4>
        <div className="picker-classes">
          {classCards(source, kind, symbolOf)
            .filter((card) => allowMixtures || card.key !== 'mixtures')
            .map((card) => (
              <button
                key={card.key}
                type="button"
                className="picker-class"
                data-tooltip={CLASS_HINTS[card.key]}
                style={toneStyle(card.tone)}
                disabled={!card.enabled}
                onClick={() => navigate(openClass(source, kind, card.key))}
              >
                <span className="picker-icon">
                  <SmlIcon name={card.icon} size={22} aria-hidden="true" />
                </span>
                <strong>{card.title}</strong>
                <small>{card.description}</small>
                <span className="picker-class-foot">
                  <span>{card.footer}</span>
                  {card.enabled && <ChevronRight size={16} aria-hidden="true" />}
                </span>
              </button>
            ))}
        </div>
      </section>
      {recent.length > 0 && (
        <div className="picker-recent">
          <Info size={14} aria-hidden="true" />
          <span data-tooltip={HINTS.recentPicks}>{say('Недавние:', 'Recent:')}</span>
          {recent.map((species) => (
            <button
              key={species}
              type="button"
              className="picker-chip"
              onClick={() => pickOne(species)}
            >
              {symbolOf(species)}
            </button>
          ))}
        </div>
      )}
    </>
  );

  const renderParticles = (view: Extract<SpeciesScreen, { view: 'particles' }>) => {
    const { filters, cards } = particleScreen(
      source,
      kind,
      view.speciesClass,
      view.filter,
      symbolOf,
    );
    return (
      <>
        {filters.length > 0 && (
          <div className="picker-chips">
            <button
              type="button"
              className={view.filter === null ? 'picker-chip selected' : 'picker-chip'}
              data-tooltip={HINTS.familyChip}
              onClick={() => setScreen({ ...view, filter: null })}
            >
              {say('все', 'all')}
              <span className="picker-chip-count">
                {filters.reduce((sum, chip) => sum + chip.count, 0)}
              </span>
            </button>
            {filters.map((chip) => (
              <button
                key={chip.key}
                type="button"
                className={view.filter === chip.key ? 'picker-chip selected' : 'picker-chip'}
                data-tooltip={HINTS.familyChip}
                onClick={() => setScreen({ ...view, filter: chip.key })}
              >
                {chip.label}
                <span className="picker-chip-count">{chip.count}</span>
              </button>
            ))}
          </div>
        )}
        <div className="picker-cards">
          {cards.map((card) => (
            <SpeciesCardButton key={card.key} card={card} onPick={pickOne} />
          ))}
        </div>
      </>
    );
  };

  const renderElements = (view: Extract<SpeciesScreen, { view: 'atoms' | 'nuclei' }>) => {
    const element = source.elements.find((entry) => entry.protons === view.protons);
    return (
      <div className="picker-split">
        <aside className="picker-aside">
          {view.view === 'atoms' && (
            <>
              <h4 className="picker-eyebrow">{say('Подкатегория атомов', 'Atom subcategory')}</h4>
              {modes.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={view.mode === mode ? 'picker-mode selected' : 'picker-mode'}
                  data-tooltip={MODE_HINTS[mode]}
                  onClick={() => setScreen({ ...view, mode })}
                >
                  <span className="picker-icon small" style={toneStyle('atom')}>
                    <SmlIcon name={MODE_ICONS[mode]} size={18} aria-hidden="true" />
                  </span>
                  <span className="picker-kind-text">
                    <strong>{modeTitle(mode)}</strong>
                    <small>{modeHint(mode, source.elements.length)}</small>
                  </span>
                </button>
              ))}
            </>
          )}
          <ElementBox
            elements={quick}
            selected={view.protons}
            onSelect={elementSelect}
            onTable={() => setScreen({ ...view, protons: null })}
          />
        </aside>
        <div className="picker-main">
          {element === undefined ? (
            <>
              <h4 className="picker-eyebrow">
                {say('Выберите элемент', 'Choose an element')}
                {view.view === 'atoms' && view.mode === 'neutral' && (
                  <span className="picker-eyebrow-note">
                    {say(
                      'щелчок добавляет атом самого распространённого изотопа',
                      'a click adds the atom of the most abundant isotope',
                    )}
                  </span>
                )}
              </h4>
              <PeriodicTable
                elements={source.elements}
                selected={view.protons}
                onSelect={elementSelect}
              />
            </>
          ) : view.view === 'atoms' && view.mode === 'ion' ? (
            <>
              <h4 className="picker-eyebrow">
                {say(`Ионы: ${elementName(element)}`, `Ions: ${elementName(element)}`)}
                <span className="picker-eyebrow-note">
                  {`Z = ${String(element.protons)}`}
                  {element.ionizationEnergyInEv !== null &&
                    ` · ${say('ионизация', 'ionization')} ${formatNumber(element.ionizationEnergyInEv)} ${say('эВ', 'eV')}`}
                </span>
              </h4>
              <div className="picker-cards two">
                {ionsOf(element).map((card) => (
                  <SpeciesCardButton key={card.key} card={card} onPick={pickOne} />
                ))}
              </div>
            </>
          ) : (
            <NuclideList
              note={nuclideNote}
              element={element}
              bare={view.view === 'nuclei'}
              symbolOf={symbolOf}
              onPick={pickOne}
            />
          )}
        </div>
      </div>
    );
  };

  const renderMolecules = (view: Extract<SpeciesScreen, { view: 'molecules' }>) => {
    const sections = moleculeSections(source, view.group, query);
    return (
      <>
        {query.trim() === '' && (
          <div className="picker-chips">
            {moleculeGroups(source).map((chip) => (
              <button
                key={chip.key}
                type="button"
                className={view.group === chip.key ? 'picker-chip selected' : 'picker-chip'}
                data-tooltip={HINTS.groupChip}
                onClick={() => setScreen({ ...view, group: chip.key, selected: null })}
              >
                {chip.label}
                <span className="picker-chip-count">{chip.count}</span>
              </button>
            ))}
          </div>
        )}
        {sections.length === 0 && (
          <p className="hint">{say('Ничего не нашлось', 'Nothing found')}</p>
        )}
        {sections.map((section) => (
          <section key={section.key} className="picker-section">
            <h4 className="picker-eyebrow">
              {section.title}
              <span className="picker-eyebrow-note">{section.cards.length}</span>
            </h4>
            <div className="picker-molecules">
              {section.cards.map((card) => (
                <button
                  key={card.key}
                  type="button"
                  className={
                    view.selected === card.species ? 'picker-molecule selected' : 'picker-molecule'
                  }
                  aria-pressed={view.selected === card.species}
                  onClick={() => setScreen({ ...view, selected: card.species })}
                  onDoubleClick={() => pickOne(card.species)}
                >
                  <FormulaText formula={card.glyph} />
                  <span className="picker-molecule-mark">
                    <SmlIcon name="molecule" size={14} aria-hidden="true" />
                  </span>
                  <span className="picker-card-title">{card.title}</span>
                  {card.meta !== '' && (
                    <span className="picker-card-meta" data-tooltip={HINTS.moleculeMeta}>
                      {card.meta}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </section>
        ))}
      </>
    );
  };

  const renderMixtures = () => (
    <>
      {mixtureSections(source).map((section) => (
        <section key={section.title} className="picker-section">
          <h4 className="picker-eyebrow">{section.title}</h4>
          <div className="picker-cards two">
            {section.presets.map((preset) => (
              <button
                key={preset.name}
                type="button"
                className="picker-card mixture"
                onClick={() =>
                  pick(
                    preset.components.map((component) => ({
                      species: component.species,
                      numberDensityPerCubicMeter: component.numberDensityPerCubicMeter,
                    })),
                  )
                }
              >
                <span className="picker-card-text">
                  <span className="picker-card-title">{localize(preset.title)}</span>
                  <span className="picker-card-meta">{localize(preset.note)}</span>
                  <span className="picker-mixture-species">
                    {preset.components.map((component) => (
                      <span
                        key={component.species}
                        className="picker-chip static"
                        data-tooltip={`${formatNumber(component.numberDensityPerCubicMeter)} ${say('частиц в м³', 'particles per m³')}`}
                      >
                        {symbolOf(component.species)}
                      </span>
                    ))}
                  </span>
                </span>
                <Plus className="picker-card-next" size={16} aria-hidden="true" />
              </button>
            ))}
          </div>
        </section>
      ))}
      <p className="picker-note">
        <Info size={14} aria-hidden="true" />
        {say(
          'Смесь добавляет все свои компоненты с их концентрациями; температуру и давление пресета задаёт поле «Готовая среда».',
          'A mixture adds all its components with their densities; the preset temperature and pressure come from the Preset environment field.',
        )}
      </p>
    </>
  );

  const renderSearch = () => {
    const results = searchSpecies(source, query, symbolOf, scope === 'nucleus').filter((card) =>
      scope === 'moleculeAtom'
        ? NEUTRAL_ATOM.test(card.species)
        : scope === 'atom'
          ? CATION_OR_NEUTRAL_ATOM.test(card.species)
          : true,
    );
    return (
      <>
        <h4 className="picker-eyebrow">
          {say('Найдено', 'Found')}
          <span className="picker-eyebrow-note">{results.length}</span>
        </h4>
        {results.length === 0 && (
          <p className="hint">{say('Ничего не нашлось', 'Nothing found')}</p>
        )}
        <div className="picker-cards">
          {results.map((card) => (
            <SpeciesCardButton key={card.key} card={card} onPick={pickOne} />
          ))}
        </div>
      </>
    );
  };

  const renderBody = () => {
    if (searching) {
      return renderSearch();
    }
    switch (screen.view) {
      case 'root':
        return renderRoot();
      case 'particles':
        return renderParticles(screen);
      case 'atoms':
      case 'nuclei':
        return renderElements(screen);
      case 'molecules':
        return renderMolecules(screen);
      case 'mixtures':
        return renderMixtures();
    }
  };

  const selectedMolecule =
    screen.view === 'molecules'
      ? source.molecules?.find((entry) => entry.name === screen.selected)
      : undefined;

  return createPortal(
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="species-modal"
        role="dialog"
        aria-modal="true"
        aria-label={scopeTitle(scope)}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="species-modal-head">
          <button
            type="button"
            className="icon-button round"
            aria-label={say('Назад', 'Back')}
            data-tooltip={say('Назад', 'Back')}
            disabled={atTop && !searching}
            onClick={() => (searching ? setQuery('') : navigate(back))}
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <nav className="species-crumbs" aria-label={say('Путь выбора', 'Choice path')}>
            {crumbs.length === 0 ? (
              <span className="species-crumb current">
                <SmlIcon name="medium-gas" size={14} aria-hidden="true" />
                {scopeTitle(scope)}
              </span>
            ) : (
              crumbs.map((crumb, index) => (
                <span key={`${String(index)}:${crumb.label}`} className="species-crumb-step">
                  {index > 0 && <ChevronRight size={13} aria-hidden="true" />}
                  {index === crumbs.length - 1 ? (
                    <span className="species-crumb current">{crumb.label}</span>
                  ) : (
                    <button
                      type="button"
                      className="species-crumb"
                      onClick={() => navigate(crumb.target)}
                    >
                      {crumb.label}
                    </button>
                  )}
                </span>
              ))
            )}
          </nav>
          <label className="species-search">
            <Search size={15} aria-hidden="true" />
            <input
              type="search"
              value={query}
              placeholder={
                moleculeView
                  ? say('формула или имя', 'formula or name')
                  : say('найти: H₂O, Fe²⁺, ³⁵Cl…', 'find: H₂O, Fe²⁺, ³⁵Cl…')
              }
              aria-label={say('Поиск вещества', 'Search species')}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="icon-button round"
            aria-label={say('Закрыть', 'Close')}
            data-tooltip={say('Закрыть', 'Close')}
            onClick={onClose}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <div key={searching ? 'search' : screenKey(screen)} className="species-body">
          {renderBody()}
        </div>
        {moleculeView && (
          <footer className="species-modal-foot">
            <span className="hint">
              {say(
                `В каталоге ${String(source.molecules?.length ?? 0)} молекул; двойной щелчок добавляет сразу`,
                `${String(source.molecules?.length ?? 0)} molecules in the catalogue; a double click adds at once`,
              )}
            </span>
            <button
              type="button"
              className="primary"
              disabled={selectedMolecule === undefined}
              onClick={() => selectedMolecule !== undefined && pickOne(selectedMolecule.name)}
            >
              <Plus size={16} aria-hidden="true" />
              {selectedMolecule === undefined
                ? say('Выберите молекулу', 'Choose a molecule')
                : scope === 'molecule'
                  ? say(`Собрать ${selectedMolecule.formula}`, `Build ${selectedMolecule.formula}`)
                  : say(
                      `Добавить ${selectedMolecule.formula} в среду`,
                      `Add ${selectedMolecule.formula} to the medium`,
                    )}
            </button>
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}
