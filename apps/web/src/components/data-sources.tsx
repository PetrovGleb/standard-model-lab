/* DataSources: the header chip naming where the numbers come from; hovering or focusing it opens a card with every dataset the engine reads. */
import { SmlIcon } from './sml-icon';
import { say } from '../language';

const SOURCES: readonly { readonly name: string; readonly what: readonly [string, string] }[] = [
  {
    name: 'NIST CODATA 2022',
    what: [
      'фундаментальные константы, массы и моменты лептонов и нуклонов',
      'fundamental constants, masses and moments of leptons and nucleons',
    ],
  },
  {
    name: 'PDG 2026',
    what: [
      'массы, ширины и каналы распада частиц, CKM, связи',
      'particle masses, widths and decay channels, CKM, couplings',
    ],
  },
  {
    name: 'NUBASE2020 · AME2020',
    what: [
      '3558 ядер: массы, спин, период полураспада, моды распада',
      '3558 nuclei: masses, spin, half-life, decay modes',
    ],
  },
  {
    name: 'NIST ASD',
    what: [
      'энергии ионизации всех ионов, основные уровни, линии охлаждения',
      'ionization energies of all ions, ground levels, cooling lines',
    ],
  },
  {
    name: 'NNPDF2.3 LO',
    what: [
      'партонные распределения протона для адронных столкновений',
      'proton parton distributions for hadron collisions',
    ],
  },
  {
    name: 'PYTHIA 8.3',
    what: [
      'параметры струн Лунда, дикварки и остатки пучка',
      'Lund string parameters, diquarks and beam remnants',
    ],
  },
  {
    name: 'Bosch–Hale · Solar Fusion II',
    what: ['сечения термоядерного синтеза легких ядер', 'fusion cross sections of light nuclei'],
  },
  {
    name: 'JINA REACLIB',
    what: [
      'скорости 37 тысяч термоядерных реакций между всеми ядрами NUBASE и фотораспад',
      'rates of 37 thousand thermonuclear reactions between all NUBASE nuclei and photodisintegration',
    ],
  },
  {
    name: 'USSA 1976 · NASA · Draine 2011 · Planck 2018',
    what: [
      'готовые среды: атмосфера Земли по высотам, океан, планеты, Солнце, межзвездные фазы, ранняя Вселенная',
      'preset media: Earth atmosphere by altitude, ocean, planets, the Sun, interstellar phases, the early Universe',
    ],
  },
  {
    name: 'NIST WebBook · CRC Handbook',
    what: [
      'критические точки, точки кипения и плавления для агрегатных состояний',
      'critical, boiling and melting points for aggregate states',
    ],
  },
  {
    name: 'Verner 1996',
    what: [
      'сечения фотоионизации атомов и ионов до цинка',
      'photoionization cross sections of atoms and ions up to zinc',
    ],
  },
  {
    name: 'Voronov 1997',
    what: ['скорости ионизации электронным ударом, H–Ni', 'electron-impact ionization rates, H–Ni'],
  },
  {
    name: 'UFF · OpenStax',
    what: ['силовое поле и энергии связей молекул', 'force field and bond energies of molecules'],
  },
];

export function DataSources() {
  return (
    <div className="data-sources">
      <button
        type="button"
        className="data-sources-chip"
        aria-describedby="data-sources-card"
        aria-label={say('Источники данных', 'Data sources')}
      >
        <SmlIcon name="data-source" size={18} aria-hidden="true" />
        <span className="data-sources-label">{say('Источники данных', 'Data sources')}</span>
      </button>
      <div id="data-sources-card" className="data-sources-card" role="tooltip">
        <strong>{say('Откуда берутся числа', 'Where the numbers come from')}</strong>
        <small className="muted">
          {say(
            'Числа не перепечатываются: генераторы читают исходные таблицы.',
            'Numbers are never retyped: generators read the original tables.',
          )}
        </small>
        <dl>
          {SOURCES.map((source) => (
            <div key={source.name}>
              <dt>{source.name}</dt>
              <dd>{say(...source.what)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
