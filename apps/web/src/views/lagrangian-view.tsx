/* LagrangianView: the Standard Model Lagrangian as the engine uses it: terms, multiplets, parameters with mass checks, derived vertices, and a tree-level process calculator with diagrams, dσ/dcosθ and PDG comparison. */
import type {
  CatalogResponse,
  CouplingScheme,
  LagrangianResponse,
  ParticleName,
  ProcessResult,
  VertexView,
} from '@standard-model/contracts';
import { SmlIcon } from '../components/sml-icon';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { MathBlock, useMathRenderer, type MathRenderer } from '../components/math';
import { Select } from '../components/select';
import { symbolLatex } from '../experiment-formula';
import { formatNumber } from '../format';
import { PARTICLE_GLOSSARY } from '../glossary';
import { bilingual, localize, say } from '../language';

const STRUCTURE_TITLES = bilingual<VertexView['structure']>({
  fermionFermionVector: ['Фермионный ток: f̄ f V', 'Fermion current: f̄ f V'],
  fermionFermionScalar: ['Юкава: f̄ f h', 'Yukawa: f̄ f h'],
  tripleGauge: ['Три калибровочных бозона', 'Three gauge bosons'],
  quarticGauge: ['Четыре калибровочных бозона', 'Four gauge bosons'],
  vectorVectorScalar: ['Хиггс и пара бозонов: V V h', 'Higgs and a boson pair: V V h'],
  vectorVectorScalarScalar: [
    'Два Хиггса и пара бозонов: V V h h',
    'Two Higgs and a boson pair: V V h h',
  ],
  tripleScalar: ['Самодействие Хиггса: hhh', 'Higgs self-coupling: hhh'],
  quarticScalar: ['Самодействие Хиггса: hhhh', 'Higgs self-coupling: hhhh'],
});

const NONE = 'none';
function energyPresets(): readonly (readonly [string, number])[] {
  return [
    [say('1 МэВ, порог e⁺e⁻', '1 MeV, e⁺e⁻ threshold'), 0.001022],
    [say('10 ГэВ, B-фабрика', '10 GeV, B factory'), 10.58],
    [say('91.19 ГэВ, пик Z', '91.19 GeV, Z peak'), 91.1876],
    [say('200 ГэВ, LEP2', '200 GeV, LEP2'), 200],
    [say('250 ГэВ, фабрика Хиггса', '250 GeV, Higgs factory'), 250],
    [say('1 ТэВ', '1 TeV'), 1000],
  ];
}

function complexText(value: { readonly real: number; readonly imaginary: number }): string {
  const real = Math.abs(value.real) < 1e-12 ? 0 : value.real;
  const imaginary = Math.abs(value.imaginary) < 1e-12 ? 0 : value.imaginary;
  if (imaginary === 0) {
    return formatNumber(real);
  }
  if (real === 0) {
    return `${formatNumber(imaginary)}·i`;
  }
  return `${formatNumber(real)} ${imaginary < 0 ? '−' : '+'} ${formatNumber(Math.abs(imaginary))}·i`;
}

function particlesLatex(particles: readonly ParticleName[], catalog: CatalogResponse): string {
  return particles
    .map((name) =>
      symbolLatex(catalog.particles.find((particle) => particle.name === name)?.symbol ?? name),
    )
    .join('\\,');
}

function scaledCrossSection(nanobarns: number): string {
  if (!Number.isFinite(nanobarns)) {
    return '∞';
  }
  if (nanobarns >= 1e6) {
    return `${formatNumber(nanobarns / 1e9)} ${say('б', 'b')}`;
  }
  if (nanobarns >= 1) {
    return `${formatNumber(nanobarns)} ${say('нб', 'nb')}`;
  }
  if (nanobarns >= 1e-3) {
    return `${formatNumber(nanobarns * 1e3)} ${say('пб', 'pb')}`;
  }
  return `${formatNumber(nanobarns * 1e6)} ${say('фб', 'fb')}`;
}

function DistributionChart({ result }: { readonly result: ProcessResult }) {
  const distribution = result.angularDistribution;
  if (distribution === null || distribution.cosine.length === 0) {
    return null;
  }
  const width = 520;
  const height = 180;
  const padding = 28;
  const values = distribution.differentialInNanobarns.filter(Number.isFinite);
  const peak = Math.max(...values, 0) || 1;
  const points = distribution.cosine
    .map((cosine, index) => {
      const value = distribution.differentialInNanobarns[index] ?? 0;
      const x = padding + ((cosine + 1) / 2) * (width - 2 * padding);
      const y = height - padding - (Math.min(value, peak) / peak) * (height - 2 * padding);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg
      className="process-chart"
      viewBox={`0 0 ${String(width)} ${String(height)}`}
      role="img"
      aria-label="dσ/dcosθ"
    >
      <line
        className="chart-axis"
        x1={padding}
        x2={width - padding}
        y1={height - padding}
        y2={height - padding}
      />
      <polyline className="chart-line" points={points} />
      <text className="chart-label" x={padding} y={height - 8}>
        −1
      </text>
      <text className="chart-label" x={width / 2} y={height - 8} textAnchor="middle">
        cos θ*
      </text>
      <text className="chart-label" x={width - padding} y={height - 8} textAnchor="end">
        1
      </text>
      <text className="chart-label" x={padding} y={16}>
        dσ/dcosθ, {say('максимум', 'peak')} {scaledCrossSection(peak)}
      </text>
    </svg>
  );
}

function ProcessCalculator({
  catalog,
  render,
}: {
  readonly catalog: CatalogResponse;
  readonly render: MathRenderer | null;
}) {
  const elementary = catalog.particles
    .filter((particle) => particle.constituents === null)
    .map((particle) => particle.name);
  const [initial, setInitial] = useState<string[]>(['electron', 'positron']);
  const [final, setFinal] = useState<string[]>(['muon', 'antiMuon', NONE]);
  const [energy, setEnergy] = useState(91.1876);
  const [cut, setCut] = useState(1);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isDecay = initial[1] === NONE;
  const labels = Object.fromEntries([
    [NONE, '—'],
    ...elementary.map((name) => [name, PARTICLE_GLOSSARY[name] ?? name]),
  ]);
  const run = (): void => {
    setBusy(true);
    setError(null);
    api
      .process({
        initial: initial.filter((name) => name !== NONE) as ParticleName[],
        final: final.filter((name) => name !== NONE) as ParticleName[],
        ...(isDecay ? {} : { centerOfMassEnergyInGev: energy, maximumAbsoluteCosine: cut }),
      })
      .then(setResult)
      .catch((failure: Error) => {
        setResult(null);
        setError(failure.message);
      })
      .finally(() => setBusy(false));
  };
  const ratio =
    result?.reference === null || result?.reference === undefined
      ? null
      : result.value / result.reference.value;
  return (
    <section className="card">
      <div className="section-head">
        <h3>
          <SmlIcon name="feynman-diagram" aria-hidden="true" size={18} />{' '}
          {say('Калькулятор процессов', 'Process calculator')}
        </h3>
        <span className="kicker">
          {say('древесный уровень из лагранжиана', 'tree level from the Lagrangian')}
        </span>
      </div>
      <div className="process-form">
        <label>
          {say('Начальное состояние', 'Initial state')}
          <div className="row">
            {[0, 1].map((slot) => (
              <Select
                key={slot}
                value={initial[slot] ?? NONE}
                options={slot === 0 ? elementary : [NONE, ...elementary]}
                labels={labels}
                onChange={(value) =>
                  setInitial(initial.map((item, index) => (index === slot ? value : item)))
                }
              />
            ))}
          </div>
        </label>
        <label>
          {say('Конечное состояние', 'Final state')}
          <div className="row">
            {[0, 1, 2].map((slot) => (
              <Select
                key={slot}
                value={final[slot] ?? NONE}
                options={slot < 2 ? elementary : [NONE, ...elementary]}
                labels={labels}
                onChange={(value) =>
                  setFinal(final.map((item, index) => (index === slot ? value : item)))
                }
              />
            ))}
          </div>
        </label>
        {!isDecay && (
          <>
            <label>
              {say('√s, ГэВ', '√s, GeV')}
              <div className="row">
                <input
                  type="number"
                  value={energy}
                  onChange={(event) => setEnergy(Number(event.target.value))}
                />
                <Select
                  value=""
                  options={['', ...energyPresets().map(([label]) => label)]}
                  labels={{ '': say('пресет…', 'preset…') }}
                  onChange={(label) => {
                    const preset = energyPresets().find(([name]) => name === label);
                    if (preset !== undefined) {
                      setEnergy(preset[1]);
                    }
                  }}
                />
              </div>
            </label>
            <label
              data-tooltip={say(
                'Акцептанс детектора: при обмене безмассовой частицей вперед сечение без среза бесконечно',
                'Detector acceptance: with a massless particle exchanged forward the cross section without a cut is infinite',
              )}
            >
              {say('|cos θ| не больше', '|cos θ| at most')}
              <input
                type="number"
                min={0.1}
                max={1}
                step={0.01}
                value={cut}
                onChange={(event) => setCut(Number(event.target.value))}
              />
            </label>
          </>
        )}
      </div>
      <div className="actions">
        <button type="button" className="primary" disabled={busy} onClick={run}>
          {busy
            ? say('Считаю…', 'Computing…')
            : isDecay
              ? say('Посчитать ширину', 'Compute width')
              : say('Посчитать сечение', 'Compute cross section')}
        </button>
      </div>
      {error !== null && <p className="error">{error}</p>}
      {result !== null && (
        <div className="process-result">
          <div className="tiles">
            <div className="tile">
              <span className="tile-label">{result.process}</span>
              <span className="tile-value">
                {result.kind === 'width'
                  ? `Γ = ${formatNumber(result.value)} ${say('ГэВ', 'GeV')}`
                  : `σ = ${scaledCrossSection(result.value)}`}
              </span>
            </div>
            {result.lifetimeInSeconds !== null && (
              <div className="tile">
                <span className="tile-label">
                  {say(
                    'Время жизни, если канал единственный',
                    'Lifetime if this is the only channel',
                  )}
                </span>
                <span className="tile-value">
                  {formatNumber(result.lifetimeInSeconds)} {say('с', 's')}
                </span>
              </div>
            )}
            {result.reference !== null && (
              <div className="tile" data-tooltip={localize(result.reference.label)}>
                <span className="tile-label">PDG 2026</span>
                <span className="tile-value">
                  {formatNumber(result.reference.value)} {say('ГэВ', 'GeV')}
                  {ratio === null ? '' : ` · ×${ratio.toFixed(3)}`}
                </span>
              </div>
            )}
          </div>
          {result.notes.map((note) => (
            <p key={note.en} className="muted hint">
              {localize(note)}
            </p>
          ))}
          <DistributionChart result={result} />
          <h4>
            {say('Диаграммы Фейнмана', 'Feynman diagrams')}: {result.diagrams.length}
          </h4>
          <ul className="diagram-list">
            {result.diagrams.map((diagram, index) => (
              <li key={index}>
                <span className="tag">{localize(diagram.channel)}</span>{' '}
                {diagram.propagators.map((line) => (
                  <span key={`${line.particle}${line.momentum}`} className="diagram-line">
                    <MathBlock
                      latex={`${particlesLatex([line.particle], catalog)}^{*}`}
                      render={render}
                      display={false}
                    />
                    <small className="muted"> ({line.momentum})</small>
                  </span>
                ))}
                <span className="muted"> · {say('вершины', 'vertices')}: </span>
                {diagram.vertices.map((vertex, position) => (
                  <span key={position} className="diagram-vertex">
                    <MathBlock
                      latex={particlesLatex(vertex, catalog)}
                      render={render}
                      display={false}
                    />
                  </span>
                ))}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export function LagrangianView() {
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [scheme, setScheme] = useState<CouplingScheme>('fermiConstant');
  const [lagrangian, setLagrangian] = useState<LagrangianResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const render = useMathRenderer();

  useEffect(() => {
    api
      .catalog()
      .then(setCatalog)
      .catch((failure: Error) => setError(failure.message));
  }, []);
  useEffect(() => {
    api
      .lagrangian(scheme, scheme === 'runningAlpha' ? 91.1876 : null)
      .then(setLagrangian)
      .catch((failure: Error) => setError(failure.message));
  }, [scheme]);

  const grouped = useMemo(() => {
    const groups = new Map<VertexView['structure'], VertexView[]>();
    lagrangian?.vertices.forEach((vertex) =>
      groups.set(vertex.structure, [...(groups.get(vertex.structure) ?? []), vertex]),
    );
    return [...groups.entries()];
  }, [lagrangian]);

  if (error !== null) {
    return <p className="error">{error}</p>;
  }
  if (lagrangian === null || catalog === null) {
    return <p className="muted">{say('Загружаю лагранжиан…', 'Loading the Lagrangian…')}</p>;
  }
  return (
    <div className="lagrangian">
      <section className="card">
        <div className="section-head">
          <h2>
            <SmlIcon name="lagrangian" aria-hidden="true" size={22} />{' '}
            {say('Лагранжиан Стандартной модели', 'Standard Model Lagrangian')}
          </h2>
          <Select
            value={scheme}
            options={['fermiConstant', 'runningAlpha']}
            labels={{
              fermiConstant: say('Схема G_F: G_F, M_W, M_Z', 'G_F scheme: G_F, M_W, M_Z'),
              runningAlpha: say('Схема α(M_Z): бегущая α', 'α(M_Z) scheme: running α'),
            }}
            onChange={(value) => setScheme(value as CouplingScheme)}
          />
        </div>
        <p className="muted">
          {say(
            'Движок не хранит готовых формул процессов: вершины ниже выведены из этих членов, а сечения и ширины собираются из них по правилам Фейнмана.',
            'The engine stores no ready-made process formulas: the vertices below are derived from these terms, and cross sections and widths are assembled from them by the Feynman rules.',
          )}
        </p>
        {lagrangian.terms.map((term) => (
          <figure key={term.name} className="formula-line">
            <MathBlock latex={term.latex} render={render} />
            <figcaption>{localize(term.note)}</figcaption>
          </figure>
        ))}
      </section>
      <div className="two-up">
        <section className="card">
          <h3>{say('Поля', 'Fields')}</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>{say('Мультиплет', 'Multiplet')}</th>
                <th>SU(3)</th>
                <th>SU(2)</th>
                <th>Y</th>
                <th>{say('Поколения', 'Generations')}</th>
              </tr>
            </thead>
            <tbody>
              {lagrangian.multiplets.map((multiplet) => (
                <tr key={multiplet.name}>
                  <td>
                    <MathBlock latex={multiplet.latex} render={render} display={false} />
                  </td>
                  <td>{multiplet.colorRepresentation === 'triplet' ? '3' : '1'}</td>
                  <td>{multiplet.weakRepresentation === 'doublet' ? '2' : '1'}</td>
                  <td>{formatNumber(multiplet.hypercharge)}</td>
                  <td>
                    {multiplet.generations.map((generation, index) => (
                      <span key={index} className="generation">
                        <MathBlock
                          latex={`(${particlesLatex(generation, catalog)})`}
                          render={render}
                          display={false}
                        />
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="card">
          <h3>{say('Параметры', 'Parameters')}</h3>
          <table className="data-table">
            <tbody>
              {lagrangian.parameters.map((parameter) => (
                <tr
                  key={parameter.name}
                  className={`origin-${parameter.origin}`}
                  data-tooltip={localize(parameter.note)}
                >
                  <td>
                    <MathBlock latex={parameter.latex} render={render} display={false} />
                  </td>
                  <td>
                    {formatNumber(parameter.value)} {parameter.unit}
                  </td>
                  <td>
                    <span className={`tag origin-tag-${parameter.origin}`}>
                      {parameter.origin === 'input'
                        ? say('вход', 'input')
                        : parameter.origin === 'derived'
                          ? say('выведен', 'derived')
                          : say('проверка', 'check')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
      <ProcessCalculator catalog={catalog} render={render} />
      <section className="card">
        <h3>
          {say('Вершины, выведенные из лагранжиана', 'Vertices derived from the Lagrangian')}:{' '}
          {lagrangian.vertices.length}
        </h3>
        {grouped.map(([structure, vertices]) => (
          <details key={structure} className="vertex-group">
            <summary>
              {STRUCTURE_TITLES[structure]} · {vertices.length}
            </summary>
            <MathBlock latex={vertices[0]?.latex ?? ''} render={render} />
            <table className="data-table">
              <tbody>
                {vertices.map((vertex, index) => (
                  <tr key={index}>
                    <td>
                      <MathBlock
                        latex={particlesLatex(vertex.particles, catalog)}
                        render={render}
                        display={false}
                      />
                    </td>
                    <td className="mono">
                      {Object.entries(vertex.couplings)
                        .map(([name, value]) => `${name} = ${complexText(value)}`)
                        .join(',  ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        ))}
      </section>
    </div>
  );
}
