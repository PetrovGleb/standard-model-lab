/* TemplatesView: pick a built-in or saved template, set parameters, run it and see the result. */
import type {
  CatalogResponse,
  ExperimentPlan,
  TemplateCategory,
  TemplateDetail,
  TemplateSummary,
  TemplateComplexity,
} from '@standard-model/contracts';
import { SmlIcon } from '../components/sml-icon';
import { useEffect, useState } from 'react';
import { api } from '../api';
import { formatMilliseconds } from '../format';
import { HINTS } from '../hints';
import { CategoryChips } from '../components/category-chips';
import { TEMPLATE_CATEGORY_LABELS } from '../glossary';
import { TEMPLATE_CATEGORY_ICONS } from '../icons';
import { ParameterForm, type RunSettings } from '../components/parameter-form';
import { PlanSchema } from '../components/plan-schema';
import { say, useLanguage } from '../language';

interface Props {
  readonly onEdit: (plan: ExperimentPlan) => void;
  readonly onRun: (plan: ExperimentPlan, settings: RunSettings) => void;
}

function forecastMilliseconds(complexity: TemplateComplexity, shots: number): number {
  return (
    (complexity.firstShotMilliseconds ?? complexity.meanShotMilliseconds) +
    complexity.meanShotMilliseconds * Math.max(shots - 1, 0)
  );
}

export function TemplatesView({ onEdit, onRun }: Props) {
  const [templates, setTemplates] = useState<readonly TemplateSummary[]>([]);
  const [selected, setSelected] = useState<TemplateDetail | null>(null);
  const [settings, setSettings] = useState<RunSettings>({ parameters: {}, shots: 1000, seed: 1 });
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<readonly TemplateCategory[]>([]);
  const [query, setQuery] = useState('');
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  useEffect(() => {
    api
      .catalog()
      .then(setCatalog)
      .catch(() => setCatalog(null));
  }, []);

  const present = (Object.keys(TEMPLATE_CATEGORY_LABELS) as TemplateCategory[]).filter((category) =>
    templates.some((template) => template.categories.includes(category)),
  );
  const counts = Object.fromEntries(
    present.map((category) => [
      category,
      templates.filter((template) => template.categories.includes(category)).length,
    ]),
  );
  const selectedComplexity = templates.find(
    (template) => template.name === selected?.template.name,
  )?.complexity;
  const needle = query.trim().toLowerCase();
  const visible = templates.filter(
    (template) =>
      (categories.length === 0 ||
        template.categories.some((category) => categories.includes(category))) &&
      (needle === '' ||
        [
          template.name,
          template.description ?? '',
          ...template.categories.map((category) => TEMPLATE_CATEGORY_LABELS[category]),
        ].some((text) => text.toLowerCase().includes(needle))),
  );
  const toggleCategory = (category: TemplateCategory): void =>
    setCategories((current) =>
      current.includes(category)
        ? current.filter((existing) => existing !== category)
        : [...current, category],
    );

  const reload = (): void => {
    api
      .templates()
      .then((response) => setTemplates(response.templates))
      .catch((failure: Error) => setError(failure.message));
  };

  const language = useLanguage();

  const choose = (name: string): void => {
    setError(null);
    api
      .template(name)
      .then((detail) => {
        setSelected(detail);
        setSettings({
          parameters: { ...detail.template.parameters },
          shots: detail.template.shots,
          seed: detail.template.seed ?? 1,
        });
      })
      .catch((failure: Error) => setError(failure.message));
  };

  useEffect(() => {
    reload();
    if (selected !== null) {
      choose(selected.template.name);
    }
  }, [language]);

  const run = (): void => {
    if (selected !== null) {
      onRun(selected.template, settings);
    }
  };

  const remove = (): void => {
    if (selected === null || selected.source !== 'saved') {
      return;
    }
    api
      .deleteTemplate(selected.template.name)
      .then(() => {
        setSelected(null);
        reload();
      })
      .catch((failure: Error) => setError(failure.message));
  };

  return (
    <div className="two-columns">
      <aside className="card">
        <h2>{say('Шаблоны', 'Templates')}</h2>
        <label className="search-field">
          <SmlIcon name="search" size={16} aria-hidden="true" />
          <input
            type="search"
            placeholder={say('Поиск шаблона', 'Search templates')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <CategoryChips
          categories={present}
          selected={categories}
          counts={counts}
          onToggle={toggleCategory}
        />
        {templates.length > 0 && visible.length === 0 && (
          <p className="muted">{say('Ничего не найдено.', 'Nothing found.')}</p>
        )}
        <ul className="list">
          {visible.map((template) => (
            <li key={template.name}>
              <button
                type="button"
                className={
                  selected?.template.name === template.name ? 'list-item active' : 'list-item'
                }
                onClick={() => choose(template.name)}
              >
                <strong>
                  {template.name}
                  <span className="category-icons">
                    {template.categories.map((category) => {
                      const Icon = TEMPLATE_CATEGORY_ICONS[category];
                      return (
                        <span key={category} className="category-icon" data-category={category}>
                          <Icon size={18} aria-label={TEMPLATE_CATEGORY_LABELS[category]} />
                        </span>
                      );
                    })}
                  </span>
                </strong>
                <small>
                  <span
                    data-tooltip={
                      template.source === 'builtIn' ? HINTS.builtInTemplate : HINTS.savedTemplate
                    }
                  >
                    {template.source === 'builtIn'
                      ? say('встроенный', 'built-in')
                      : say('сохраненный', 'saved')}
                  </span>
                  ,{' '}
                  <span data-tooltip={HINTS.stepCount}>
                    {say('шагов', 'steps')} {template.stepCount}
                  </span>
                  {template.complexity !== undefined && (
                    <span
                      className="template-weight"
                      data-tooltip={say(
                        'Среднее время одного выстрела по пробному прогону',
                        'Mean time of one shot from a pilot run',
                      )}
                    >
                      {' · '}
                      {formatMilliseconds(template.complexity.meanShotMilliseconds)}{' '}
                      {say('на выстрел', 'per shot')}
                    </span>
                  )}
                </small>
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <section>
        {error !== null && <p className="error">{error}</p>}
        {selected === null ? (
          <p className="muted">{say('Выберите шаблон слева.', 'Pick a template on the left.')}</p>
        ) : (
          <div className="card template-detail">
            <span className="eyebrow">
              {selected.source === 'saved'
                ? say('Сохраненный шаблон', 'Saved template')
                : say('Встроенный шаблон', 'Built-in template')}
            </span>
            <h2 className="summary-title">{selected.template.name}</h2>
            {selected.template.description !== undefined && (
              <p className="summary-description">{selected.template.description}</p>
            )}
            {selectedComplexity !== undefined && (
              <p className="muted template-forecast">
                <SmlIcon name="timeline" size={16} aria-hidden="true" />
                {say(
                  `Прогноз: около ${formatMilliseconds(forecastMilliseconds(selectedComplexity, settings.shots))} на ${String(settings.shots)} выстрелов: первый ${formatMilliseconds(selectedComplexity.firstShotMilliseconds ?? selectedComplexity.meanShotMilliseconds)}, дальше ${formatMilliseconds(selectedComplexity.meanShotMilliseconds)} на выстрел по пробному прогону`,
                  `Forecast: about ${formatMilliseconds(forecastMilliseconds(selectedComplexity, settings.shots))} for ${String(settings.shots)} shots: the first ${formatMilliseconds(selectedComplexity.firstShotMilliseconds ?? selectedComplexity.meanShotMilliseconds)}, then ${formatMilliseconds(selectedComplexity.meanShotMilliseconds)} per shot from a pilot run`,
                )}
              </p>
            )}
            <ParameterForm
              defaults={selected.template.parameters}
              settings={settings}
              onChange={setSettings}
            />
            <div className="actions divided">
              <button type="button" className="cta with-icon" onClick={run}>
                <SmlIcon name="play" size={18} aria-hidden="true" />
                {say('Запустить', 'Run')}
              </button>
              <button
                type="button"
                className="secondary with-icon"
                onClick={() => onEdit(selected.template)}
              >
                <SmlIcon name="builder" size={16} aria-hidden="true" />
                {say('Открыть в конструкторе', 'Open in builder')}
              </button>
              {selected.source === 'saved' && (
                <button type="button" className="danger text with-icon push-right" onClick={remove}>
                  <SmlIcon name="delete" size={16} aria-hidden="true" />
                  {say('Удалить', 'Delete')}
                </button>
              )}
            </div>
            {catalog !== null && selected.template.steps.length > 0 && (
              <div className="summary-schema">
                <PlanSchema
                  plan={selected.template}
                  particles={catalog.particles}
                  elements={catalog.elements}
                  molecules={catalog.molecules}
                />
              </div>
            )}
            <details>
              <summary>
                {say('Шаги плана', 'Plan steps')} ({selected.template.steps.length})
              </summary>
              <pre>{JSON.stringify(selected.template.steps, null, 2)}</pre>
            </details>
          </div>
        )}
      </section>
    </div>
  );
}
