/* BuilderView: tabs of experiment drafts; each draft is edited as forms or JSON beside a sticky schema on a pan-and-zoom canvas: the experiment card with run settings, parameters with their
   usage, the space, the steps and the report on the left, the schema with the run button on the right. */
import type {
  RunEstimate,
  CatalogResponse,
  ExperimentPlan,
  ReportSpec,
  ReportStatistic,
} from '@standard-model/contracts';
import { X } from 'lucide-react';
import { Fragment, useContext, useEffect, useRef, useState, type CSSProperties } from 'react';
import { api } from '../api';
import { CategoryChips } from '../components/category-chips';
import {
  PlanParameterSetterContext,
  PlanParametersContext,
} from '../components/number-or-parameter-input';
import { PlanSchema } from '../components/plan-schema';
import { RunForecast, stepShares } from '../components/run-forecast';
import { Select } from '../components/select';
import { SmlIcon, sml } from '../components/sml-icon';
import { SpaceCard } from '../components/space-card';
import { StepEditor } from '../components/step-editor';
import type { Draft } from '../drafts';
import {
  OPERATION_GLOSSARY,
  OPERATION_TITLES,
  PARAMETER_GLOSSARY,
  STATISTIC_GLOSSARY,
} from '../glossary';
import { FieldLabel, OperationBadge, type OperationName } from '../icons';
import {
  addReport,
  toggleCategory,
  collisionEnergyInGev,
  addStep,
  createdLabels,
  labelGroups,
  labelParticles,
  moveStep,
  parameterUsage,
  placedLabels,
  keyframeQuantities,
  keyframeTargets,
  withParticleWeight,
  reorderedIndex,
  reorderStep,
  planWarnings,
  mediumReplacements,
  nestedAsBodies,
  RECORD_COUNTS,
  recordsForStatistic,
  removeParameter,
  removeReport,
  duplicateStep,
  removeStep,
  resizeRecords,
  setParameter,
  updateReport,
  updateStep,
  type Operation,
} from '../plan-edits';
import { unitOfParameter } from '../presets';
import { HINTS } from '../hints';
import { LanguageContext, localize, say } from '../language';

const SEED_LIMIT = 2 ** 31 - 1;
const LONGEST_FULL_SIZE_TITLE = 22;
const TITLE_SIZE_IN_PIXELS = 42;
const SMALLEST_TITLE_SIZE_IN_PIXELS = 26;
const DESCRIPTION_CHARACTERS_PER_ROW = 64;
const DESCRIPTION_ROWS = { fewest: 3, most: 10 } as const;

function titleSize(name: string): number {
  return name.length <= LONGEST_FULL_SIZE_TITLE
    ? TITLE_SIZE_IN_PIXELS
    : Math.max(
        SMALLEST_TITLE_SIZE_IN_PIXELS,
        Math.floor((TITLE_SIZE_IN_PIXELS * LONGEST_FULL_SIZE_TITLE) / name.length),
      );
}

function descriptionRows(description: string): number {
  return Math.min(
    DESCRIPTION_ROWS.most,
    Math.max(
      DESCRIPTION_ROWS.fewest,
      Math.ceil(description.length / DESCRIPTION_CHARACTERS_PER_ROW),
    ),
  );
}

function randomSeed(): number {
  const [value = 1] = crypto.getRandomValues(new Uint32Array(1));
  return (value % SEED_LIMIT) + 1;
}

interface Props {
  readonly drafts: readonly Draft[];
  readonly activeId: number;
  readonly onSelect: (id: number) => void;
  readonly onNew: () => void;
  readonly onClose: (id: number) => void;
  readonly onChange: (id: number, plan: ExperimentPlan) => void;
  readonly onClear: (id: number) => void;
  readonly onRun: (id: number) => void;
}

export function BuilderView({
  drafts,
  activeId,
  onSelect,
  onNew,
  onClose,
  onChange,
  onClear,
  onRun,
}: Props) {
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const active = drafts.find((draft) => draft.id === activeId) ?? drafts[0];

  useEffect(() => {
    api
      .catalog()
      .then(setCatalog)
      .catch((failure: Error) => setCatalogError(failure.message));
  }, []);

  return (
    <div className="builder">
      <div className="draft-tabs" role="tablist">
        {drafts.map((draft) => (
          <span
            key={draft.id}
            className={draft.id === active?.id ? 'draft-tab active' : 'draft-tab'}
            role="presentation"
          >
            <button
              type="button"
              role="tab"
              aria-selected={draft.id === active?.id}
              data-tooltip={say('Переключиться на этот эксперимент', 'Switch to this experiment')}
              onClick={() => onSelect(draft.id)}
            >
              {draft.plan.name}
            </button>
            <button
              type="button"
              className="close"
              aria-label={say('Закрыть вкладку', 'Close tab')}
              data-tooltip={say('Закрыть вкладку', 'Close tab')}
              onClick={() => onClose(draft.id)}
            >
              <X size={14} strokeWidth={2.25} aria-hidden="true" />
            </button>
          </span>
        ))}
        <button
          type="button"
          className="draft-new"
          data-tooltip={say('Открыть новый пустой эксперимент', 'Open a new empty experiment')}
          onClick={onNew}
        >
          <SmlIcon name="add-step" size={16} aria-hidden="true" />
          {say('новый', 'new')}
        </button>
      </div>
      {catalog === null && (
        <p className="muted">{catalogError ?? say('Загружаю каталог…', 'Loading the catalog…')}</p>
      )}
      {catalog !== null && active !== undefined && (
        <DraftEditor
          key={active.id}
          draft={active}
          catalog={catalog}
          onChange={(plan) => onChange(active.id, plan)}
          onClear={() => onClear(active.id)}
          onRun={() => onRun(active.id)}
        />
      )}
    </div>
  );
}

function DraftEditor({
  draft,
  catalog,
  onChange,
  onClear,
  onRun,
}: {
  readonly draft: Draft;
  readonly catalog: CatalogResponse;
  readonly onChange: (plan: ExperimentPlan) => void;
  readonly onClear: () => void;
  readonly onRun: () => void;
}) {
  const plan = draft.plan;
  const language = useContext(LanguageContext);
  const [jsonMode, setJsonMode] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newParameter, setNewParameter] = useState('');
  const [newParameterValue, setNewParameterValue] = useState('');
  const [focused, setFocused] = useState<number | null>(null);
  const [pane, setPane] = useState<'editor' | 'schema'>('editor');
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(() => new Set());
  const [dragged, setDragged] = useState<number | null>(null);
  const [dropBefore, setDropBefore] = useState<number | null>(null);
  const [estimate, setEstimate] = useState<RunEstimate | null>(null);
  const weights = stepShares(estimate?.stepMeanMilliseconds);
  const chain = useRef<HTMLDivElement>(null);

  const toggleStep = (index: number): void => {
    setFocused(expanded.has(index) ? null : index);
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const focusStep = (index: number): void => {
    setPane('editor');
    setFocused(index);
    setExpanded(new Set([index]));
    window.requestAnimationFrame(() => {
      document
        .getElementById(`step-${String(index)}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  const removeStepAt = (index: number): void => {
    setExpanded(
      (current) =>
        new Set(
          [...current]
            .filter((open) => open !== index)
            .map((open) => (open > index ? open - 1 : open)),
        ),
    );
    onChange(removeStep(plan, index));
  };

  const duplicateStepAt = (index: number): void => {
    setExpanded(
      (current) =>
        new Set([
          ...[...current].map((open) => (open > index ? open + 1 : open)),
          ...(current.has(index) ? [index + 1] : []),
        ]),
    );
    onChange(duplicateStep(plan, index));
  };

  const moveStepAt = (index: number, offset: number): void => {
    const target = index + offset;
    if (target < 0 || target >= plan.steps.length) {
      return;
    }
    setExpanded(
      (current) =>
        new Set(
          [...current].map((open) => (open === index ? target : open === target ? index : open)),
        ),
    );
    onChange(moveStep(plan, index, offset));
  };

  const draggedIndex = useRef<number | null>(null);

  const startDrag = (index: number): void => {
    draggedIndex.current = index;
    setTimeout(() => setDragged(draggedIndex.current), 0);
  };

  const finishDrag = (): void => {
    draggedIndex.current = null;
    setDragged(null);
    setDropBefore(null);
  };

  useEffect(() => {
    const slotAt = (pointerY: number): number =>
      [...(chain.current?.querySelectorAll(':scope > .step') ?? [])].filter((card) => {
        const box = card.getBoundingClientRect();
        return pointerY > box.top + box.height / 2;
      }).length;
    const over = (event: DragEvent): void => {
      if (draggedIndex.current === null) {
        return;
      }
      event.preventDefault();
      if (event.dataTransfer !== null) {
        event.dataTransfer.dropEffect = 'move';
      }
      setDropBefore(slotAt(event.clientY));
    };
    const drop = (event: DragEvent): void => {
      const source = draggedIndex.current;
      if (source === null) {
        return;
      }
      event.preventDefault();
      const target = slotAt(event.clientY);
      setExpanded(
        (current) => new Set([...current].map((open) => reorderedIndex(open, source, target))),
      );
      onChange(reorderStep(plan, source, target));
      draggedIndex.current = null;
      setDragged(null);
      setDropBefore(null);
    };
    document.addEventListener('dragover', over);
    document.addEventListener('drop', drop);
    return () => {
      document.removeEventListener('dragover', over);
      document.removeEventListener('drop', drop);
    };
  }, [plan, onChange]);

  const addStepOf = (operation: Operation): void => {
    onChange(addStep(plan, operation));
    focusStep(plan.steps.length);
  };

  const toggleJson = (): void => {
    if (jsonMode) {
      try {
        onChange(JSON.parse(jsonText) as ExperimentPlan);
        setError(null);
        setJsonMode(false);
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : String(failure));
      }
      return;
    }
    setJsonText(JSON.stringify(plan, null, 2));
    setJsonMode(true);
  };

  const validate = (): void => {
    setMessage(null);
    setError(null);
    api
      .validate(plan)
      .then((response) => {
        if (response.valid) {
          setMessage(say('План валиден.', 'The plan is valid.'));
        } else {
          setError(response.errors.map((text) => localize(text)).join('; '));
        }
      })
      .catch((failure: Error) => setError(failure.message));
  };

  const save = (): void => {
    setMessage(null);
    setError(null);
    api
      .saveTemplate(plan)
      .then((detail) =>
        setMessage(
          say(
            `Шаблон ${detail.template.name} сохранен.`,
            `Template ${detail.template.name} saved.`,
          ),
        ),
      )
      .catch((failure: Error) => setError(failure.message));
  };

  const clear = (): void => {
    if (
      window.confirm(
        say(
          'Очистить конструктор? Все шаги, параметры и отчет будут удалены.',
          'Clear the builder? All steps, parameters and the report will be removed.',
        ),
      )
    ) {
      setMessage(null);
      setError(null);
      setJsonMode(false);
      onClear();
    }
  };

  const usage = parameterUsage(plan);
  const labelCount = createdLabels(plan, plan.steps.length).length;
  const counts = say(
    `шагов: ${String(plan.steps.length)} · меток: ${String(labelCount)}`,
    `steps: ${String(plan.steps.length)} · labels: ${String(labelCount)}`,
  );
  const addParameter = (): void => {
    const name = newParameter.trim();
    if (name === '') {
      return;
    }
    const value = Number(newParameterValue);
    onChange(setParameter(plan, name, Number.isFinite(value) ? value : 0));
    setNewParameter('');
    setNewParameterValue('');
  };

  return (
    <PlanParametersContext.Provider value={plan.parameters}>
      <PlanParameterSetterContext.Provider
        value={(name, value) => onChange(setParameter(plan, name, value))}
      >
        <div className="builder-switch">
          <div className="segmented" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={pane === 'editor'}
              className={pane === 'editor' ? 'active' : ''}
              onClick={() => setPane('editor')}
            >
              <SmlIcon name="builder" size={16} aria-hidden="true" />
              {say('Шаги', 'Steps')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={pane === 'schema'}
              className={pane === 'schema' ? 'active' : ''}
              onClick={() => setPane('schema')}
            >
              <SmlIcon name="feynman-diagram" size={16} aria-hidden="true" />
              {say('Схема', 'Schema')}
            </button>
          </div>
          <button
            type="button"
            className="cta small with-icon"
            aria-label={say('Запустить эксперимент', 'Run experiment')}
            onClick={onRun}
            disabled={draft.busy}
          >
            <SmlIcon name="play" size={16} aria-hidden="true" />
            {draft.busy ? say('Считаю…', 'Computing…') : say('Запустить', 'Run')}
          </button>
        </div>
        <div className={`builder-layout show-${pane}`}>
          <div className="builder-main">
            <section className="card meta-card">
              <div className="meta-grid">
                <div className="meta-main">
                  <span className="eyebrow">{say('Эксперимент', 'Experiment')}</span>
                  <label className="title-field">
                    <input
                      className="title-input"
                      value={plan.name}
                      size={Math.max(8, plan.name.length)}
                      style={
                        { '--title-size': `${String(titleSize(plan.name))}px` } as CSSProperties
                      }
                      aria-label={say('Имя эксперимента', 'Experiment name')}
                      onChange={(event) => onChange({ ...plan, name: event.target.value })}
                    />
                    <SmlIcon name="label" size={18} aria-hidden="true" />
                  </label>
                  <span className="hint">
                    {say(
                      'Имя — это заголовок. Нажмите, чтобы переименовать; латиница, без пробелов.',
                      'The name is the title. Click to rename; Latin letters, no spaces.',
                    )}
                  </span>
                  <label>
                    <FieldLabel icon={sml('info')}>{say('Описание', 'Description')}</FieldLabel>
                    <textarea
                      className="prose"
                      rows={descriptionRows(plan.description ?? '')}
                      value={plan.description ?? ''}
                      placeholder={say(
                        'Что происходит в эксперименте и что смотрим',
                        'What happens in the experiment and what we look at',
                      )}
                      onChange={(event) => onChange({ ...plan, description: event.target.value })}
                    />
                  </label>
                  <div className="field-group">
                    <FieldLabel icon={sml('filter')}>
                      {say('Категории', 'Categories')}
                      <span className="label-note">
                        {say('· можно несколько', '· several allowed')}
                      </span>
                    </FieldLabel>
                    <CategoryChips
                      categories={catalog.templateCategories}
                      selected={plan.categories ?? []}
                      onToggle={(category) => onChange(toggleCategory(plan, category))}
                    />
                  </div>
                </div>
                <div className="run-settings">
                  <div className="field-group">
                    <FieldLabel icon={sml('shots')}>
                      <span data-tooltip={HINTS.shots}>{say('Выстрелов', 'Shots')}</span>
                    </FieldLabel>
                    <input
                      type="number"
                      min={1}
                      value={plan.shots}
                      onChange={(event) => onChange({ ...plan, shots: Number(event.target.value) })}
                    />
                    <div className="mini-chips">
                      {catalog.presets.shots.map((preset) => (
                        <button
                          key={preset.value}
                          type="button"
                          className={
                            preset.value === plan.shots ? 'mini-chip selected' : 'mini-chip'
                          }
                          data-tooltip={localize(preset.note)}
                          onClick={() => onChange({ ...plan, shots: preset.value })}
                        >
                          {preset.value.toLocaleString(language)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="field-group">
                    <FieldLabel icon={sml('duplicate')}>
                      <span data-tooltip={HINTS.particleWeight}>
                        {say('Вес частицы', 'Particle weight')}
                      </span>
                    </FieldLabel>
                    <input
                      type="number"
                      min={0}
                      value={plan.particleWeight ?? 1}
                      onChange={(event) =>
                        onChange(withParticleWeight(plan, Number(event.target.value)))
                      }
                    />
                  </div>
                  <div className="field-group">
                    <FieldLabel icon={sml('seed')}>
                      <span data-tooltip={HINTS.seed}>Seed</span>
                    </FieldLabel>
                    <span className="input-with-action">
                      <input
                        type="number"
                        value={plan.seed ?? 1}
                        onChange={(event) =>
                          onChange({ ...plan, seed: Number(event.target.value) })
                        }
                      />
                      <button
                        type="button"
                        className="mini-chip"
                        data-tooltip={say('Взять случайный seed', 'Take a random seed')}
                        onClick={() => onChange({ ...plan, seed: randomSeed() })}
                      >
                        <SmlIcon name="randomize" size={14} aria-hidden="true" />
                        {say('случайный', 'random')}
                      </button>
                    </span>
                    <span className="hint">
                      {say(
                        'Один и тот же seed дает воспроизводимый прогон.',
                        'The same seed gives a reproducible run.',
                      )}
                    </span>
                  </div>
                </div>
              </div>
              <div className="actions divided">
                <button
                  type="button"
                  className="primary with-icon"
                  data-tooltip={say(
                    'Проверить план на сервере без запуска',
                    'Check the plan on the server without running it',
                  )}
                  onClick={validate}
                >
                  <SmlIcon name="validate" size={16} aria-hidden="true" />
                  {say('Проверить', 'Validate')}
                </button>
                <button
                  type="button"
                  className="secondary with-icon"
                  data-tooltip={say(
                    'Сохранить план как шаблон в базе',
                    'Save the plan as a template in the database',
                  )}
                  onClick={save}
                >
                  <SmlIcon name="save-template" size={16} aria-hidden="true" />
                  {say('Сохранить как шаблон', 'Save as template')}
                </button>
                <button
                  type="button"
                  className="with-icon"
                  data-tooltip={say(
                    'Показать и править план как JSON',
                    'Show and edit the plan as JSON',
                  )}
                  onClick={toggleJson}
                >
                  <SmlIcon name="json-mode" size={16} aria-hidden="true" />
                  {jsonMode ? say('Применить JSON', 'Apply JSON') : 'JSON'}
                </button>
                <button
                  type="button"
                  className="danger text with-icon push-right"
                  data-tooltip={say(
                    'Удалить все шаги, параметры и отчет',
                    'Remove all steps, parameters and the report',
                  )}
                  onClick={clear}
                >
                  <SmlIcon name="delete" size={16} aria-hidden="true" />
                  {say('Очистить', 'Clear')}
                </button>
              </div>
              {message !== null && <p className="ok">{message}</p>}
              {error !== null && <p className="error">{error}</p>}
            </section>

            {jsonMode ? (
              <section className="card">
                <textarea
                  className="code"
                  rows={30}
                  value={jsonText}
                  onChange={(event) => setJsonText(event.target.value)}
                />
              </section>
            ) : (
              <>
                <section className="card">
                  <div className="card-head">
                    <h3>{say('Параметры', 'Parameters')}</h3>
                    <span className="card-sub">
                      {say('подставляются в шаги как', 'go into the steps as')}{' '}
                      <code>{say('{{имя}}', '{{name}}')}</code>
                    </span>
                  </div>
                  <div className="parameter-table">
                    <div className="parameter-head">
                      <span>{say('Имя', 'Name')}</span>
                      <span>{say('Значение', 'Value')}</span>
                      <span>{say('Где используется', 'Used in')}</span>
                      <span />
                    </div>
                    {Object.entries(plan.parameters).map(([name, value]) => (
                      <div key={name} className="parameter-row">
                        <span
                          className="parameter-name"
                          data-tooltip={PARAMETER_GLOSSARY[name] ?? HINTS.parameter}
                        >
                          <SmlIcon name="parameter" size={16} aria-hidden="true" />
                          <span>{name}</span>
                        </span>
                        <span className="value-field">
                          <input
                            type="number"
                            step="any"
                            aria-label={name}
                            value={value}
                            onChange={(event) =>
                              onChange(setParameter(plan, name, Number(event.target.value)))
                            }
                          />
                          <span className="value-unit">{unitOfParameter(name)}</span>
                        </span>
                        <span className="parameter-usage">
                          {(usage.get(name) ?? []).length === 0 ? (
                            <span className="tag faint">{say('не используется', 'unused')}</span>
                          ) : (
                            (usage.get(name) ?? []).map((index) => (
                              <button
                                key={index}
                                type="button"
                                className="tag"
                                data-tooltip={say('Открыть шаг', 'Open the step')}
                                onClick={() => focusStep(index)}
                              >
                                {say('шаг', 'step')} {index + 1}
                              </button>
                            ))
                          )}
                        </span>
                        <button
                          type="button"
                          className="icon-button round danger"
                          aria-label={say('Удалить параметр', 'Remove parameter')}
                          data-tooltip={say('Удалить параметр', 'Remove parameter')}
                          onClick={() => onChange(removeParameter(plan, name))}
                        >
                          <SmlIcon name="delete" size={16} aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                    <div className="parameter-row adding">
                      <input
                        className="dashed mono"
                        value={newParameter}
                        placeholder={say('имя параметра', 'parameter name')}
                        onChange={(event) => setNewParameter(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            addParameter();
                          }
                        }}
                      />
                      <input
                        className="dashed"
                        type="number"
                        step="any"
                        value={newParameterValue}
                        placeholder={say('значение', 'value')}
                        onChange={(event) => setNewParameterValue(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            addParameter();
                          }
                        }}
                      />
                      <button type="button" className="link-button" onClick={addParameter}>
                        <SmlIcon name="add-step" size={16} aria-hidden="true" />
                        {say('добавить', 'add')}
                      </button>
                      <span />
                    </div>
                  </div>
                </section>

                <SpaceCard plan={plan} catalog={catalog} onChange={onChange} />

                <section className="steps-section">
                  <div className="section-head">
                    <h3>{say('Шаги', 'Steps')}</h3>
                    <span className="card-sub" data-tooltip={HINTS.schemaCounts}>
                      {counts}
                    </span>
                    {plan.steps.length > 0 && (
                      <span className="section-actions">
                        <button
                          type="button"
                          className="small with-icon"
                          data-tooltip={say(
                            'Свернуть все шаги в карточки',
                            'Collapse all steps into cards',
                          )}
                          onClick={() => setExpanded(new Set())}
                        >
                          <SmlIcon name="collapse-panel" size={16} aria-hidden="true" />
                          {say('Свернуть все', 'Collapse all')}
                        </button>
                        <button
                          type="button"
                          className="small with-icon"
                          data-tooltip={say('Развернуть все шаги', 'Expand all steps')}
                          onClick={() =>
                            setExpanded(new Set(plan.steps.map((ignored, index) => index)))
                          }
                        >
                          <SmlIcon name="expand" size={16} aria-hidden="true" />
                          {say('Развернуть все', 'Expand all')}
                        </button>
                      </span>
                    )}
                  </div>
                  <div
                    ref={chain}
                    className={dragged === null ? 'step-chain' : 'step-chain dragging'}
                  >
                    {plan.steps.map((step, index) => (
                      <Fragment key={index}>
                        {dragged !== null && (
                          <div
                            className={dropBefore === index ? 'drop-slot active' : 'drop-slot'}
                            aria-hidden="true"
                          />
                        )}
                        <StepEditor
                          step={step}
                          index={index}
                          labels={createdLabels(plan, index)}
                          labelGroups={labelGroups(plan, index)}
                          {...(weights[index] === undefined ? {} : { weight: weights[index] })}
                          labelParticles={labelParticles(plan, index, catalog.particles)}
                          parameters={Object.keys(plan.parameters)}
                          catalog={catalog}
                          onChange={(updated) => onChange(updateStep(plan, index, updated))}
                          onRemove={() => removeStepAt(index)}
                          onDuplicate={() => duplicateStepAt(index)}
                          onMove={(offset) => moveStepAt(index, offset)}
                          onDragStart={() => startDrag(index)}
                          onDragEnd={finishDrag}
                          expanded={dragged === null && expanded.has(index)}
                          onToggle={() => toggleStep(index)}
                          space={plan.space}
                          placed={placedLabels(plan, index)}
                          keyframeTargets={keyframeTargets(plan, index)}
                          keyframeQuantities={(kind) => keyframeQuantities(plan, kind)}
                          collisionEnergyInGev={
                            step.operation === 'collide'
                              ? collisionEnergyInGev(
                                  plan,
                                  index,
                                  step.targets,
                                  (particle) =>
                                    catalog.particles.find((entry) => entry.name === particle)
                                      ?.massInGev.value ?? 0,
                                )
                              : null
                          }
                        />
                      </Fragment>
                    ))}
                    {dragged !== null && (
                      <div
                        className={
                          dropBefore === plan.steps.length ? 'drop-slot active' : 'drop-slot'
                        }
                        aria-hidden="true"
                      />
                    )}
                  </div>
                  <div className="add-steps">
                    <span className="add-steps-title">
                      <SmlIcon name="add-step" size={16} aria-hidden="true" />
                      {say('Добавить шаг', 'Add a step')}
                    </span>
                    <div className="add-steps-list">
                      {catalog.operations.map((operation) => (
                        <button
                          key={operation}
                          type="button"
                          className="add-step"
                          data-tooltip={`${operation}: ${OPERATION_GLOSSARY[operation] ?? ''}`}
                          onClick={() => addStepOf(operation as Operation)}
                        >
                          <OperationBadge operation={operation as OperationName} size={16} />
                          {OPERATION_TITLES[operation] ?? operation}
                        </button>
                      ))}
                    </div>
                  </div>
                </section>

                <section className="card">
                  <div className="card-head">
                    <h3>{say('Отчет', 'Report')}</h3>
                    <span className="card-sub">
                      {say(
                        'что посчитать по записям измерений и распадов',
                        'what to compute from the measurement and decay records',
                      )}
                    </span>
                  </div>
                  <div className="report-list">
                    {plan.report.map((report, index) => (
                      <ReportRow
                        key={index}
                        report={report}
                        statistics={catalog.statistics}
                        plan={plan}
                        onChange={(updated) => onChange(updateReport(plan, index, updated))}
                        onRemove={() => onChange(removeReport(plan, index))}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    className="link-button"
                    data-tooltip={say(
                      'Добавить статистику в отчет',
                      'Add a statistic to the report',
                    )}
                    onClick={() => onChange(addReport(plan))}
                  >
                    <SmlIcon name="add-step" size={16} aria-hidden="true" />
                    {say('добавить статистику', 'add a statistic')}
                  </button>
                </section>
              </>
            )}
          </div>

          <aside className="schema-panel">
            <div className="schema-head">
              <h3>{say('Схема', 'Schema')}</h3>
              <span className="card-sub">{counts}</span>
            </div>
            {plan.steps.length === 0 ? (
              <p className="muted schema-empty">
                {say(
                  'Добавьте шаги, и здесь появится схема эксперимента.',
                  'Add steps and the experiment schema appears here.',
                )}
              </p>
            ) : (
              <PlanSchema
                plan={plan}
                particles={catalog.particles}
                elements={catalog.elements}
                molecules={catalog.molecules}
                activeRow={focused}
                onSelect={focusStep}
              />
            )}
            <div className="schema-legend">
              <span data-tooltip={HINTS.legendInfluence}>
                <i className="legend-band" />
                {say('область действия воздействия', 'reach of an influence')}
              </span>
              <span data-tooltip={HINTS.legendLife}>
                <i className="legend-lane" />
                {say('жизнь частицы с меткой', 'life of a labelled particle')}
              </span>
            </div>
            <div className="schema-run">
              <RunForecast plan={plan} onEstimate={setEstimate} />
              {planWarnings(plan).map((warning) => (
                <p key={warning} className="warning">
                  {warning}
                </p>
              ))}
              {mediumReplacements(plan).map((replacement) => (
                <p key={replacement.row} className="warning medium-replacement">
                  {say(
                    `Шаг ${String(replacement.row + 1)} заменяет среду шага ${String(replacement.replacedRow + 1)}: среда на все пространство у системы одна. Чтобы вложить одну среду в другую, сделайте их телами.`,
                    `Step ${String(replacement.row + 1)} replaces the medium of step ${String(replacement.replacedRow + 1)}: the system has one medium for all space. To put one medium inside the other, make them bodies.`,
                  )}{' '}
                  <button
                    type="button"
                    className="secondary"
                    data-tooltip={say(
                      'Превратить обе среды в вложенные тела: позже заданная внутри, раньше заданная снаружи',
                      'Turn both media into nested bodies: the later one inside, the earlier one outside',
                    )}
                    onClick={() => onChange(nestedAsBodies(plan, replacement))}
                  >
                    {say('Сделать телами', 'Make them bodies')}
                  </button>
                </p>
              ))}
              <button
                type="button"
                className="cta with-icon"
                data-tooltip={say(
                  'Запустить эксперимент и открыть страницу результата',
                  'Run the experiment and open the result page',
                )}
                onClick={onRun}
                disabled={draft.busy}
              >
                <SmlIcon name="play" size={18} aria-hidden="true" />
                {draft.busy
                  ? say('Считаю…', 'Computing…')
                  : say('Запустить эксперимент', 'Run experiment')}
              </button>
              {draft.result !== null && (
                <span className="hint">
                  {say(
                    'Последний результат на странице «Результат».',
                    'The latest result is on the “Result” page.',
                  )}
                </span>
              )}
              {draft.error !== null && <p className="error">{draft.error}</p>}
            </div>
          </aside>
        </div>
      </PlanParameterSetterContext.Provider>
    </PlanParametersContext.Provider>
  );
}

const ALL_SHOTS = 'all';
const HALF_SPIN = 0.5;

function ReportRow({
  report,
  statistics,
  plan,
  onChange,
  onRemove,
}: {
  readonly report: ReportSpec;
  readonly statistics: readonly string[];
  readonly plan: ExperimentPlan;
  readonly onChange: (report: ReportSpec) => void;
  readonly onRemove: () => void;
}) {
  const count = RECORD_COUNTS[report.statistic];
  const records = recordsForStatistic(plan, report.statistic);
  const fallback = records[0] ?? '';
  const measurements = plan.steps.flatMap((step) =>
    step.operation === 'measure' ? [step.record] : [],
  );
  return (
    <div className="row report-row">
      <Select
        value={report.statistic}
        options={statistics}
        titles={STATISTIC_GLOSSARY}
        onChange={(value) => {
          const statistic = value as ReportStatistic;
          const allowed = recordsForStatistic(plan, statistic);
          const kept = report.records.filter((record) => allowed.includes(record));
          onChange({
            ...report,
            statistic,
            records: resizeRecords(kept, RECORD_COUNTS[statistic], allowed[0] ?? ''),
          });
        }}
      />
      {Array.from({ length: count }, (ignored, position) => (
        <Select
          key={position}
          value={report.records[position] ?? ''}
          options={records}
          onChange={(value) =>
            onChange({
              ...report,
              records: resizeRecords(report.records, count, fallback).map((record, slot) =>
                slot === position ? value : record,
              ),
            })
          }
        />
      ))}
      {report.statistic !== 'frequency' && measurements.length > 0 && (
        <Select
          value={report.when?.record ?? ALL_SHOTS}
          options={[ALL_SHOTS, ...measurements]}
          labels={{ [ALL_SHOTS]: say('все выстрелы', 'all shots') }}
          titles={Object.fromEntries(
            [ALL_SHOTS, ...measurements].map((option) => [
              option,
              say(
                'Совпадения: считать только выстрелы, где выбранное измерение дало заданный результат',
                'Coincidences: count only the shots where the chosen measurement gave the given outcome',
              ),
            ]),
          )}
          onChange={(value) => {
            const { when, ...rest } = report;
            void when;
            onChange(
              value === ALL_SHOTS
                ? rest
                : { ...rest, when: { record: value, equals: report.when?.equals ?? HALF_SPIN } },
            );
          }}
        />
      )}
      {report.when !== undefined && (
        <Select
          value={String(report.when.equals)}
          options={[String(HALF_SPIN), String(-HALF_SPIN)]}
          labels={{ [String(HALF_SPIN)]: '= +½', [String(-HALF_SPIN)]: '= −½' }}
          onChange={(value) =>
            onChange({
              ...report,
              when: { record: report.when?.record ?? '', equals: Number(value) },
            })
          }
        />
      )}
      <input
        value={report.label ?? ''}
        placeholder={say('подпись', 'caption')}
        data-tooltip={say(
          'Подпись статистики в результате',
          'Caption of the statistic in the result',
        )}
        onChange={(event) => onChange({ ...report, label: event.target.value })}
      />
      <button
        type="button"
        className="icon-button round danger"
        aria-label={say('Удалить статистику', 'Remove statistic')}
        data-tooltip={say('Удалить статистику', 'Remove statistic')}
        onClick={onRemove}
      >
        <SmlIcon name="delete" size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
