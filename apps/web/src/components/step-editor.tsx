/* StepEditor: form fields for one plan step, specialised per operation; finite choices are guided dropdowns and numeric fields offer physical presets. */
import type {
  CatalogResponse,
  EntangledState,
  EntangleStep,
  ExperimentStep,
  InfluenceDefinition,
  InfluenceParameterSpec,
  InfluenceStep,
  InfluenceStepScalar,
  InfluenceStepValue,
  NumberOrParameter,
  ObservableName,
  ParticleName,
  Preset,
  SpaceSpec,
  WavepacketShape,
  SpinPreparation,
} from '@standard-model/contracts';
import {
  ENTANGLED_STATE_CATEGORIES,
  ENTANGLED_STATE_GLOSSARY,
  groupOf,
  influenceCategories,
  INFLUENCE_GLOSSARY,
  MEDIUM_COMPONENT_ACTIONS,
  MEDIUM_REACTION_MODES,
  BODY_SHAPE_LABELS,
  DENSITY_LAW_LABELS,
  OBSERVABLE_GLOSSARY,
  OPERATION_TITLES,
  PARAMETER_GLOSSARY,
  SPIN_PREPARATION_GLOSSARY,
  UNSET_PARAMETER_HINTS,
  VECTOR_GROUP_TITLES,
  WAVEPACKET_SHAPE_LABELS,
} from '../glossary';
import { SmlIcon, sml } from './sml-icon';
import {
  Fragment,
  useContext,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { api } from '../api';
import { formatNumber } from '../format';
import { FIELD_ICONS, FieldLabel, OperationBadge, parameterIcon } from '../icons';
import {
  defaultInfluenceParameters,
  defaultListItem,
  describeStep,
  groupInfluenceParameters,
  influenceParameters,
  isInfluenceScalar,
  isCreation,
  isMediumStep,
  placedAsBody,
  type KeyframeTarget,
  type KeyframeTargetKind,
} from '../plan-edits';
import { momentumPresets, presetsForParameter, scaleLandmarks, unitOfParameter } from '../presets';
import { speciesSymbolResolver, type SpeciesSymbolOf } from '../species';
import { speciesCaption } from '../species-tree';
import { SpeciesPicker } from './species-picker';
import { influenceVisual } from '../influence-visual';
import { isEnvironmentInfluence } from '../plan-diagram';
import { Subsection } from './subsection';
import { MatterStepFields } from './matter-step-fields';
import { EnvironmentPresetPicker } from './environment-preset-picker';
import { ScaleSlider } from './scale-slider';
import { MomentumField } from './momentum-field';
import {
  NumberOrParameterInput,
  PlanParameterSetterContext,
  PlanParametersContext,
  scaleBinding,
} from './number-or-parameter-input';
import { ParticlePicker } from './particle-picker';
import { Select } from './select';
import { KeyframeEditor } from './keyframe-editor';
import { TargetPicker } from './target-picker';
import { say } from '../language';

const SPIN_DIRECTION = 'direction';
const DENSITY_FIELD = 'numberDensityPerCubicMeter';
const NO_PATH_MARKER = 'none';
const CHOICE_LABELS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  densityLaw: DENSITY_LAW_LABELS,
  reactionMode: MEDIUM_REACTION_MODES,
  shape: BODY_SHAPE_LABELS,
};

function withoutAmplitudes(step: EntangleStep): EntangleStep {
  const { amplitudes, ...rest } = step;
  void amplitudes;
  return rest;
}

const NO_SPIN = 'none';
const ANY_CHANNEL = 'any';

function collisionChannels(
  targets: readonly string[],
  labelParticles: ReadonlyMap<string, ParticleName | null>,
  catalog: CatalogResponse,
): readonly string[] {
  const names = targets
    .map((target) => labelParticles.get(target))
    .filter((name): name is ParticleName => name !== null && name !== undefined);
  const key = [...names].sort().join('+');
  return (
    catalog.collisionPairs.find((pair) => [...pair.particles].sort().join('+') === key)?.channels ??
    []
  );
}

function centerPresets(space: SpaceSpec | undefined): readonly Preset[] {
  const cell = Number(space?.cellSizeInMeters);
  if (space === undefined || !Number.isFinite(cell)) {
    return [];
  }
  const half = (space.gridPointsPerAxis * cell) / 2;
  return [
    { label: say('центр куба', 'cube center'), value: 0, note: '' },
    { label: say('¼ полуребра', '¼ half-edge'), value: half / 4, note: '' },
    { label: say('½ полуребра', '½ half-edge'), value: half / 2, note: '' },
    { label: say('−¼ полуребра', '−¼ half-edge'), value: -half / 4, note: '' },
    { label: say('−½ полуребра', '−½ half-edge'), value: -half / 2, note: '' },
  ];
}
const AXES = ['x', 'y', 'z'] as const;
const DEFAULT_TRANSVERSE_MOMENTUM_IN_GEV = 20;
const PERCENT = 100;

interface Props {
  readonly step: ExperimentStep;
  readonly index: number;
  readonly labels: readonly string[];
  readonly labelGroups?: ReadonlyMap<string, readonly string[]>;
  readonly weight?: number;
  readonly labelParticles: ReadonlyMap<string, ParticleName | null>;
  readonly parameters: readonly string[];
  readonly catalog: CatalogResponse;
  readonly onChange: (step: ExperimentStep) => void;
  readonly onRemove: () => void;
  readonly onDuplicate: () => void;
  readonly onMove: (offset: number) => void;
  readonly onDragStart: () => void;
  readonly onDragEnd: () => void;
  readonly expanded: boolean;
  readonly space: SpaceSpec | undefined;
  readonly placed: readonly string[];
  readonly collisionEnergyInGev: number | null;
  readonly onToggle: () => void;
  readonly keyframeTargets?: readonly KeyframeTarget[];
  readonly keyframeQuantities?: (kind: KeyframeTargetKind) => readonly string[];
}

type InfluenceParameterValues = Record<string, InfluenceStepValue>;

function hasSpinObservable(catalog: CatalogResponse, particle: ParticleName): boolean {
  return (
    catalog.particles
      .find((entry) => entry.name === particle)
      ?.observables.some(
        (observable) => observable.name === 'spin' || observable.name === 'polarization',
      ) ?? false
  );
}

function observablesFor(
  label: string,
  labelParticles: ReadonlyMap<string, ParticleName | null>,
  catalog: CatalogResponse,
): readonly string[] {
  const particleName = labelParticles.get(label);
  const entry =
    particleName === null || particleName === undefined
      ? undefined
      : catalog.particles.find((particle) => particle.name === particleName);
  return entry === undefined
    ? catalog.observables
    : entry.observables.map((observable) => observable.name);
}

const STANDARD_ATMOSPHERE_IN_PASCALS = 101325;

function enabledValue(
  name: string,
  values: InfluenceParameterValues,
  planParameters: Readonly<Record<string, number>>,
): number {
  if (name === 'pressureInPascals') {
    return STANDARD_ATMOSPHERE_IN_PASCALS;
  }
  const temperature = values.temperatureInKelvin;
  const reference =
    typeof temperature === 'string' ? /^\{\{(.+)\}\}$/.exec(temperature)?.[1] : undefined;
  const resolved =
    typeof temperature === 'number'
      ? temperature
      : reference === undefined
        ? undefined
        : planParameters[reference];
  return name === 'radiationTemperatureInKelvin' && resolved !== undefined ? resolved : 0;
}

function InfluenceParameterField({
  spec,
  values,
  parameters,
  catalog,
  symbolOf,
  onChange,
  bare = false,
}: {
  readonly spec: InfluenceParameterSpec;
  readonly values: InfluenceParameterValues;
  readonly parameters: readonly string[];
  readonly catalog: CatalogResponse;
  readonly symbolOf: SpeciesSymbolOf;
  readonly onChange: (values: InfluenceParameterValues) => void;
  readonly bare?: boolean;
}) {
  const current = values[spec.name];
  const planParameters = useContext(PlanParametersContext);
  const setPlanParameter = useContext(PlanParameterSetterContext);
  const [picking, setPicking] = useState(false);
  const title = PARAMETER_GLOSSARY[spec.name] ?? spec.name;
  const set = (value: InfluenceStepValue | undefined): void => {
    const next = { ...values };
    if (value === undefined) {
      delete next[spec.name];
    } else {
      next[spec.name] = value;
    }
    onChange(next);
  };
  const wrap = (control: ReactNode, below?: ReactNode) =>
    bare ? (
      <span className="table-cell" data-tooltip={title}>
        {control}
      </span>
    ) : (
      <label data-tooltip={spec.name}>
        <FieldLabel icon={parameterIcon(spec.name)}>
          {title}
          {spec.required && <span className="required">*</span>}
        </FieldLabel>
        {control}
        {below}
      </label>
    );
  if (spec.kind === 'text') {
    return wrap(
      <input
        type="text"
        value={typeof current === 'string' ? current : ''}
        placeholder={say('одно слово, например вода', 'one word, for example water')}
        onChange={(event) => set(event.target.value === '' ? undefined : event.target.value)}
      />,
    );
  }
  if (spec.kind === 'particleName') {
    const name = String(current ?? '');
    return wrap(
      <>
        <button
          type="button"
          className="species-button"
          data-tooltip={say('Выбрать вещество', 'Choose a species')}
          onClick={() => setPicking(true)}
        >
          <span className="species-avatar">{name === '' ? '?' : symbolOf(name)}</span>
          <span className="species-button-name">
            {name === '' ? say('выбрать', 'choose') : speciesCaption(catalog, name, symbolOf)}
          </span>
        </button>
        {picking && (
          <SpeciesPicker
            source={catalog}
            symbolOf={symbolOf}
            allowMixtures={false}
            onPick={([first]) => {
              setPicking(false);
              if (first !== undefined) {
                set(first.species);
              }
            }}
            onClose={() => setPicking(false)}
          />
        )}
      </>,
    );
  }
  if (spec.kind === 'choice') {
    return wrap(
      <Select
        value={String(current ?? spec.defaultValue ?? '')}
        options={spec.choices ?? []}
        labels={CHOICE_LABELS[spec.name] ?? MEDIUM_REACTION_MODES}
        titles={CHOICE_LABELS[spec.name] ?? MEDIUM_REACTION_MODES}
        onChange={set}
      />,
    );
  }
  if (spec.kind === 'list') {
    const records = isInfluenceScalar(current) ? [] : (current ?? []);
    const fields = spec.fields ?? [];
    const speciesField = fields.find((field) => field.kind === 'particleName');
    const setRecords = (next: readonly Record<string, InfluenceStepScalar>[]): void => set(next);
    const densityLandmarks = fields.some((field) => field.name === DENSITY_FIELD)
      ? scaleLandmarks(catalog.environmentScales, DENSITY_FIELD)
      : undefined;
    return (
      <Subsection
        className="wide-field"
        icon={parameterIcon(spec.name)}
        title={title}
        summary={say(
          `компонентов: ${String(records.length)}`,
          `components: ${String(records.length)}`,
        )}
      >
        <div className="list-table" style={{ '--fields': fields.length } as CSSProperties}>
          <div className="list-table-head">
            <span>#</span>
            {fields.map((field) => (
              <span key={field.name}>{PARAMETER_GLOSSARY[field.name] ?? field.name}</span>
            ))}
            <span />
          </div>
          {records.map((record, index) => {
            const density = scaleBinding(
              record[DENSITY_FIELD],
              (value) =>
                setRecords(
                  records.map((existing, position) =>
                    position === index ? { ...existing, [DENSITY_FIELD]: value } : existing,
                  ),
                ),
              planParameters,
              setPlanParameter,
            );
            return (
              <Fragment key={index}>
                <div className="list-table-row">
                  <span className="row-index">{index + 1}</span>
                  {fields.map((field) => (
                    <InfluenceParameterField
                      key={field.name}
                      bare
                      spec={field}
                      values={record}
                      parameters={parameters}
                      catalog={catalog}
                      symbolOf={symbolOf}
                      onChange={(next) =>
                        setRecords(
                          records.map((existing, position) =>
                            position === index
                              ? (next as Record<string, InfluenceStepScalar>)
                              : existing,
                          ),
                        )
                      }
                    />
                  ))}
                  <button
                    type="button"
                    className="icon-button round danger"
                    aria-label={MEDIUM_COMPONENT_ACTIONS.removeMediumComponent}
                    data-tooltip={MEDIUM_COMPONENT_ACTIONS.removeMediumComponent}
                    disabled={records.length <= 1}
                    onClick={() =>
                      setRecords(records.filter((unused, position) => position !== index))
                    }
                  >
                    <SmlIcon name="delete" size={16} aria-hidden="true" />
                  </button>
                </div>
                {densityLandmarks !== undefined && density !== null && (
                  <div className="list-row-scale">
                    <ScaleSlider
                      handles={[
                        { value: density.value, label: symbolOf(String(record.species ?? '')) },
                      ]}
                      landmarks={densityLandmarks}
                      unit={unitOfParameter(DENSITY_FIELD)}
                      onChange={(unused, value) => density.set(value)}
                    />
                  </div>
                )}{' '}
              </Fragment>
            );
          })}
        </div>
        <button
          type="button"
          className="add-row"
          onClick={() =>
            speciesField === undefined
              ? setRecords([...records, defaultListItem(fields)])
              : setPicking(true)
          }
        >
          <SmlIcon name="add-step" size={16} aria-hidden="true" />
          {MEDIUM_COMPONENT_ACTIONS.addMediumComponent}
        </button>
        {picking && speciesField !== undefined && (
          <SpeciesPicker
            source={catalog}
            symbolOf={symbolOf}
            onPick={(components) => {
              setPicking(false);
              setRecords([
                ...records,
                ...components.map((component) => ({
                  ...defaultListItem(fields),
                  [speciesField.name]: component.species,
                  ...(component.numberDensityPerCubicMeter !== undefined &&
                  fields.some((field) => field.name === DENSITY_FIELD)
                    ? { [DENSITY_FIELD]: component.numberDensityPerCubicMeter }
                    : {}),
                })),
              ]);
            }}
            onClose={() => setPicking(false)}
          />
        )}
      </Subsection>
    );
  }
  const isPresent = current !== undefined;
  const canBeAbsent = !spec.required && spec.defaultValue === undefined;
  const landmarks = scaleLandmarks(catalog.environmentScales, spec.name);
  const unit = unitOfParameter(spec.name);
  const binding = scaleBinding(current, set, planParameters, setPlanParameter);
  return wrap(
    <>
      {canBeAbsent && (
        <span className="checkbox toggle">
          <input
            type="checkbox"
            checked={isPresent}
            onChange={() =>
              set(isPresent ? undefined : enabledValue(spec.name, values, planParameters))
            }
          />
          {isPresent
            ? say('задано', 'set')
            : (UNSET_PARAMETER_HINTS[spec.name] ?? say('не задано', 'not set'))}
        </span>
      )}
      {(isPresent || !canBeAbsent) && (
        <NumberOrParameterInput
          value={
            (typeof current === 'number' || typeof current === 'string'
              ? current
              : (spec.defaultValue ?? 0)) as NumberOrParameter
          }
          parameters={parameters}
          presets={presetsForParameter(catalog.presets, spec.name)}
          unit={unit}
          onChange={set}
        />
      )}
    </>,
    !bare && landmarks !== undefined && binding !== null ? (
      <ScaleSlider
        handles={[{ value: binding.value }]}
        landmarks={landmarks}
        unit={unit}
        onChange={(unused, value) => binding.set(value)}
      />
    ) : null,
  );
}

function InfluenceFields({
  step,
  definition,
  labels,
  labelGroups,
  parameters,
  catalog,
  symbolOf,
  onChange,
}: {
  readonly step: InfluenceStep;
  readonly definition: InfluenceDefinition | undefined;
  readonly labels: readonly string[];
  readonly labelGroups: ReadonlyMap<string, readonly string[]>;
  readonly parameters: readonly string[];
  readonly catalog: CatalogResponse;
  readonly symbolOf: SpeciesSymbolOf;
  readonly onChange: (step: InfluenceStep) => void;
}) {
  const groups = groupInfluenceParameters(definition?.parameters ?? []);
  const values = influenceParameters(step);
  const setValues = (next: InfluenceParameterValues): void =>
    onChange({ ...step, parameters: next });
  const field = (spec: InfluenceParameterSpec) => (
    <InfluenceParameterField
      key={spec.name}
      spec={spec}
      values={values}
      parameters={parameters}
      catalog={catalog}
      symbolOf={symbolOf}
      onChange={setValues}
    />
  );
  const picked = step.targets?.length ?? 0;
  return (
    <>
      {groups.scalars.filter((spec) => spec.kind === 'text').map(field)}
      {isMediumStep(step) && (
        <div className="medium-place wide-field">
          <FieldLabel icon={sml('medium-gas')}>
            {say('Где среда', 'Where the medium is')}
          </FieldLabel>
          <span
            className="segmented"
            role="group"
            aria-label={say('Где среда', 'Where the medium is')}
          >
            <button
              type="button"
              className={step.influence === 'setMedium' ? 'active' : ''}
              aria-pressed={step.influence === 'setMedium'}
              data-tooltip={say(
                'Среда заполняет все пространство; следующая такая среда ее заменит',
                'The medium fills all space; the next such medium replaces it',
              )}
              onClick={() => onChange(placedAsBody(step, false))}
            >
              {say('все пространство', 'all space')}
            </button>
            <button
              type="button"
              className={step.influence === 'placeBody' ? 'active' : ''}
              aria-pressed={step.influence === 'placeBody'}
              data-tooltip={say(
                'Среда заполняет тело — шар или куб с размером и центром; тела вкладываются друг в друга',
                'The medium fills a body, a ball or a box with a size and a centre; bodies nest in each other',
              )}
              onClick={() => onChange(placedAsBody(step, true))}
            >
              {say('тело: шар или куб', 'a body: ball or box')}
            </button>
          </span>
        </div>
      )}
      {(step.influence === 'setMedium' || step.influence === 'placeBody') &&
        catalog.environments.length > 0 && (
          <EnvironmentPresetPicker step={step} presets={catalog.environments} onChange={onChange} />
        )}
      {groups.lists.map(field)}
      {groups.scalars.some((spec) => spec.kind !== 'text') && (
        <Subsection
          className="wide-field"
          icon={sml('temperature')}
          title={say('Условия', 'Conditions')}
        >
          <div className="form-grid">
            {groups.scalars.filter((spec) => spec.kind !== 'text').map(field)}
          </div>
        </Subsection>
      )}
      <div className="subsection-row wide-field">
        {groups.vectors.map((group) => {
          const components = group.specs.map((spec) => values[spec.name]);
          const resting = components.every(
            (component) => component === undefined || component === 0,
          );
          return (
            <Subsection
              key={group.suffix}
              icon={parameterIcon(group.specs[0]?.name ?? '')}
              title={VECTOR_GROUP_TITLES[group.suffix] ?? group.suffix}
              summary={resting ? say('ноль', 'zero') : undefined}
            >
              <div className="axis-rows">
                {group.specs.map((spec) => (
                  <div key={spec.name} className="axis-row">
                    <span className="axis-name">{spec.name.slice(0, 1)}</span>
                    <NumberOrParameterInput
                      value={
                        (typeof values[spec.name] === 'number' ||
                        typeof values[spec.name] === 'string'
                          ? values[spec.name]
                          : 0) as NumberOrParameter
                      }
                      parameters={parameters}
                      presets={presetsForParameter(catalog.presets, spec.name)}
                      unit={unitOfParameter(spec.name)}
                      onChange={(value) => setValues({ ...values, [spec.name]: value })}
                    />
                  </div>
                ))}
              </div>
            </Subsection>
          );
        })}
        <Subsection
          icon={FIELD_ICONS.target}
          title={say('Цели', 'Targets')}
          summary={
            picked === 0
              ? isEnvironmentInfluence(step.influence)
                ? say('вся система', 'whole system')
                : say('все живые', 'all alive')
              : say(`выбрано: ${String(picked)}`, `picked: ${String(picked)}`)
          }
        >
          <TargetPicker
            titled={false}
            environment={isEnvironmentInfluence(step.influence)}
            labels={labels}
            groups={labelGroups}
            targets={step.targets}
            onChange={(targets) => onChange({ ...step, targets })}
            tooltip={say(
              'Для среды, температуры и полей отмеченные частицы получают свое окружение: оно действует только на них, внутри заменяет общее того же вида, а продукты их реакций остаются внутри. Ничего не отмечено — окружение общее для всей системы',
              'For a medium, a temperature or a field the picked particles get their own environment: it acts on them only, replaces the shared one of the same kind inside, and the products of their reactions stay inside. Nothing picked means one environment for the whole system',
            )}
          />
        </Subsection>
      </div>
    </>
  );
}

function influenceSummary(step: InfluenceStep, symbolOf: SpeciesSymbolOf): string {
  const caption = influenceVisual(step, null, symbolOf).caption;
  const targets =
    step.targets === undefined || step.targets.length === 0
      ? say('на все живые', 'on all alive')
      : say(`на ${step.targets.join(', ')}`, `on ${step.targets.join(', ')}`);
  return `${caption} · ${targets}`;
}

export function StepEditor({
  step,
  index,
  labels,
  labelGroups = new Map(),
  weight,
  labelParticles,
  parameters,
  catalog,
  onChange,
  onRemove,
  onDuplicate,
  onMove,
  onDragStart,
  onDragEnd,
  expanded,
  onToggle,
  space,
  placed,
  collisionEnergyInGev,
  keyframeTargets = [],
  keyframeQuantities = () => [],
}: Props) {
  const symbolOf = useMemo(() => speciesSymbolResolver(catalog), [catalog]);
  const collisionTargets = step.operation === 'collide' ? step.targets : [];
  const knownChannels = collisionChannels(collisionTargets, labelParticles, catalog);
  const pairNames = collisionTargets.map((target) => labelParticles.get(target) ?? '');
  const pairKey = pairNames.join('+');
  const [fetchedChannels, setFetchedChannels] = useState<{
    readonly key: string;
    readonly channels: readonly string[];
  }>({
    key: '',
    channels: [],
  });
  useEffect(() => {
    const [first, second] = pairNames;
    if (
      knownChannels.length > 0 ||
      first === undefined ||
      second === undefined ||
      first === '' ||
      second === ''
    ) {
      return;
    }
    let active = true;
    api
      .channels(first, second)
      .then((channels) => {
        if (active) {
          setFetchedChannels({ key: pairKey, channels });
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [pairKey]);
  const channelOptions =
    knownChannels.length > 0
      ? knownChannels
      : fetchedChannels.key === pairKey
        ? fetchedChannels.channels
        : [];
  const influenceDefinition = (name: string): InfluenceDefinition | undefined =>
    catalog.influences.find((influence) => influence.name === name);
  const categories = influenceCategories(catalog.influences.map((influence) => influence.name));
  const changeInfluence = (name: string): void => {
    if (step.operation !== 'influence') {
      return;
    }
    const definition = influenceDefinition(name);
    onChange({
      ...step,
      influence: name,
      parameters: definition === undefined ? {} : defaultInfluenceParameters(definition),
    });
  };

  return (
    <div
      className={
        expanded ? `step op-card-${step.operation} expanded` : `step op-card-${step.operation}`
      }
      id={`step-${String(index)}`}
    >
      <div className="step-header">
        <button
          type="button"
          className="step-toggle"
          aria-expanded={expanded}
          data-tooltip={
            expanded ? say('Свернуть шаг', 'Collapse step') : say('Развернуть шаг', 'Expand step')
          }
          onClick={onToggle}
        >
          <OperationBadge operation={step.operation} size={24} />
          <span className="step-heading">
            <span className="step-name">
              <span className="step-index">{index + 1}</span>
              {OPERATION_TITLES[step.operation] ?? step.operation}
              <span className="step-code">
                {step.operation === 'influence'
                  ? `${step.operation} · ${step.influence}`
                  : step.operation}
              </span>
            </span>
            <span className="step-summary">
              {step.operation === 'influence'
                ? influenceSummary(step, symbolOf)
                : describeStep(step)}
            </span>
          </span>
        </button>
        {weight !== undefined && (
          <span
            className="step-weight"
            data-tooltip={say(
              'Доля времени выстрела, которую занимает этот шаг, по пробному прогону',
              'The share of a shot this step takes, from the pilot run',
            )}
          >
            <span
              className="step-weight-bar"
              style={{ width: `${String(Math.round(weight * PERCENT))}%` }}
            />
            <span className="step-weight-text">{Math.round(weight * PERCENT)}%</span>
          </span>
        )}
        <span className="step-actions">
          <button
            type="button"
            className="icon-button plain"
            aria-expanded={expanded}
            aria-label={
              expanded ? say('Свернуть шаг', 'Collapse step') : say('Развернуть шаг', 'Expand step')
            }
            data-tooltip={
              expanded ? say('Свернуть шаг', 'Collapse step') : say('Развернуть шаг', 'Expand step')
            }
            onClick={onToggle}
          >
            <SmlIcon name="expand" className="chevron" aria-hidden="true" size={18} />
          </button>
          <span
            className="icon-button plain drag-handle"
            role="button"
            tabIndex={0}
            draggable
            aria-label={say('Перетащить шаг', 'Drag step')}
            data-tooltip={say(
              'Потяните, чтобы переставить шаг; стрелки вверх и вниз двигают его с клавиатуры',
              'Drag to reorder the step; the up and down arrow keys move it from the keyboard',
            )}
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('text/plain', String(index));
              const header = event.currentTarget.closest('.step-header');
              if (header instanceof HTMLElement) {
                event.dataTransfer.setDragImage(header, 24, 24);
              }
              onDragStart();
            }}
            onDragEnd={onDragEnd}
            onKeyDown={(event) => {
              if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                event.preventDefault();
                onMove(event.key === 'ArrowUp' ? -1 : 1);
              }
            }}
          >
            <SmlIcon name="drag-handle" aria-hidden="true" size={16} />
          </span>
          <button
            type="button"
            className="icon-button round"
            aria-label={say('Дублировать', 'Duplicate')}
            data-tooltip={say(
              'Вставить копию шага сразу под ним; новая частица или запись получит свободное имя',
              'Insert a copy of the step right below it; a new particle or record gets a free name',
            )}
            onClick={onDuplicate}
          >
            <SmlIcon name="duplicate" aria-hidden="true" size={16} />
          </button>
          <button
            type="button"
            className="icon-button round danger"
            aria-label={say('Удалить', 'Delete')}
            data-tooltip={say('Удалить шаг', 'Delete step')}
            onClick={onRemove}
          >
            <SmlIcon name="delete" aria-hidden="true" size={16} />
          </button>
        </span>
      </div>
      {expanded && (
        <div className="step-body form-grid">
          {step.operation === 'create' && (
            <>
              <label
                data-tooltip={say(
                  'Имя, по которому на частицу ссылаются следующие шаги',
                  'The name later steps use to refer to the particle',
                )}
              >
                <FieldLabel icon={FIELD_ICONS.label}>{say('Метка', 'Label')}</FieldLabel>
                <input
                  value={step.label}
                  onChange={(event) => onChange({ ...step, label: event.target.value })}
                />
              </label>
              <ParticlePicker
                value={step.particle}
                particles={catalog.particles}
                onChange={(particle) => {
                  const { spin, spinDirection, ...rest } = step;
                  void spin;
                  void spinDirection;
                  onChange(
                    hasSpinObservable(catalog, particle)
                      ? { ...step, particle }
                      : { ...rest, particle },
                  );
                }}
              />
              {!hasSpinObservable(catalog, step.particle) && (
                <p className="hint">
                  {say(
                    'У этой частицы спин 0: спин и поляризацию готовить нечего.',
                    'This particle has spin 0: there is no spin or polarization to prepare.',
                  )}
                </p>
              )}
              {hasSpinObservable(catalog, step.particle) && (
                <label
                  data-tooltip={say(
                    'Состояние спина, у фотона поляризации, сразу после создания; без подготовки его нельзя измерять. Для спина 1 и выше готовится состояние с максимальной проекцией на выбранную ось',
                    'The spin state (polarization for a photon) right after creation; without preparation it cannot be measured. For spin 1 and above the state with the largest projection on the chosen axis is prepared',
                  )}
                >
                  <FieldLabel icon={FIELD_ICONS.spin}>
                    {say('Спин или поляризация', 'Spin or polarization')}
                  </FieldLabel>
                  <Select
                    value={
                      step.spinDirection === undefined ? (step.spin ?? NO_SPIN) : SPIN_DIRECTION
                    }
                    options={[NO_SPIN, ...catalog.spinPreparations, SPIN_DIRECTION]}
                    labels={{
                      [NO_SPIN]: say('не готовить', 'do not prepare'),
                      [SPIN_DIRECTION]: say('направление θ, φ', 'direction θ, φ'),
                    }}
                    titles={SPIN_PREPARATION_GLOSSARY}
                    onChange={(value) => {
                      const { spin, spinDirection, ...rest } = step;
                      void spin;
                      void spinDirection;
                      if (value === NO_SPIN) {
                        onChange(rest);
                      } else if (value === SPIN_DIRECTION) {
                        onChange({
                          ...rest,
                          spinDirection: { polarAngleDegrees: 90, azimuthDegrees: 0 },
                        });
                      } else {
                        onChange({ ...rest, spin: value as SpinPreparation });
                      }
                    }}
                  />
                </label>
              )}
              {step.spinDirection !== undefined && (
                <>
                  <label
                    data-tooltip={say(
                      'Полярный угол оси спина от оси z, градусы',
                      'Polar angle of the spin axis from the z axis, degrees',
                    )}
                  >
                    <FieldLabel icon={FIELD_ICONS.angle}>
                      {say('Спин: θ, °', 'Spin: θ, °')}
                    </FieldLabel>
                    <input
                      type="number"
                      value={step.spinDirection.polarAngleDegrees}
                      onChange={(event) =>
                        onChange({
                          ...step,
                          spinDirection: {
                            polarAngleDegrees: Number(event.target.value),
                            azimuthDegrees: step.spinDirection?.azimuthDegrees ?? 0,
                          },
                        })
                      }
                    />
                  </label>
                  <label
                    data-tooltip={say(
                      'Азимут оси спина от оси x в плоскости xy, градусы',
                      'Azimuth of the spin axis from the x axis in the xy plane, degrees',
                    )}
                  >
                    <FieldLabel icon={FIELD_ICONS.angle}>
                      {say('Спин: φ, °', 'Spin: φ, °')}
                    </FieldLabel>
                    <input
                      type="number"
                      value={step.spinDirection.azimuthDegrees}
                      onChange={(event) =>
                        onChange({
                          ...step,
                          spinDirection: {
                            polarAngleDegrees: step.spinDirection?.polarAngleDegrees ?? 0,
                            azimuthDegrees: Number(event.target.value),
                          },
                        })
                      }
                    />
                  </label>
                </>
              )}
              <MomentumField
                value={step.momentumInGev}
                parameters={parameters}
                presets={momentumPresets(catalog.presets, step.particle)}
                onChange={(momentumInGev) => onChange({ ...step, momentumInGev })}
              />
            </>
          )}
          {(step.operation === 'createNucleus' ||
            step.operation === 'createAtom' ||
            step.operation === 'createMolecule') && (
            <MatterStepFields
              step={step}
              catalog={catalog}
              parameters={parameters}
              onChange={onChange}
            />
          )}
          {isCreation(step) && (
            <label
              data-tooltip={say(
                'Сколько одинаковых частиц создать одним шагом. Больше одной — это группа: частицы получают метки метка1…меткаN, каждая живет отдельно, а в целях воздействия группу можно выбрать целиком',
                'How many identical particles to create in one step. More than one makes a group: the particles get the labels label1…labelN, each lives on its own, and an influence can target the whole group',
              )}
            >
              <FieldLabel icon={FIELD_ICONS.count}>{say('Количество', 'Count')}</FieldLabel>
              <NumberOrParameterInput
                value={step.count ?? 1}
                parameters={parameters}
                onChange={(value) => {
                  const { count, ...single } = step;
                  void count;
                  onChange(value === 1 ? single : { ...step, count: value });
                }}
              />
            </label>
          )}
          {step.operation === 'entangle' && (
            <>
              {[0, 1].map((position) => (
                <label
                  key={position}
                  data-tooltip={say(
                    'Частица, созданная раньше и еще не запутанная ни с кем',
                    'A particle created earlier and not yet entangled with anything',
                  )}
                >
                  <FieldLabel icon={FIELD_ICONS.target}>
                    {say(say('Частица', 'Particle'), 'Particle')} {position + 1}
                  </FieldLabel>
                  <Select
                    value={step.targets[position] ?? ''}
                    options={labels}
                    onChange={(value) =>
                      onChange({
                        ...step,
                        targets: step.targets.map((target, slot) =>
                          slot === position ? value : target,
                        ),
                      })
                    }
                  />
                </label>
              ))}
              <label
                data-tooltip={say('Семейство двухкубитных состояний', 'Family of two-qubit states')}
              >
                <FieldLabel icon={FIELD_ICONS.stateFamily}>
                  {say('Тип состояния', 'State type')}
                </FieldLabel>
                <Select
                  value={groupOf(ENTANGLED_STATE_CATEGORIES, step.state)?.label ?? ''}
                  options={ENTANGLED_STATE_CATEGORIES.map((group) => group.label)}
                  onChange={(label) => {
                    const first = ENTANGLED_STATE_CATEGORIES.find((group) => group.label === label)
                      ?.names[0];
                    if (first !== undefined) {
                      onChange({ ...withoutAmplitudes(step), state: first as EntangledState });
                    }
                  }}
                />
              </label>
              <label data-tooltip={ENTANGLED_STATE_GLOSSARY[step.state] ?? ''}>
                <FieldLabel icon={FIELD_ICONS.state}>{say('Состояние', 'State')}</FieldLabel>
                <Select
                  value={step.state}
                  options={
                    groupOf(ENTANGLED_STATE_CATEGORIES, step.state)?.names ??
                    catalog.entangledStates
                  }
                  titles={ENTANGLED_STATE_GLOSSARY}
                  onChange={(value) =>
                    onChange({ ...withoutAmplitudes(step), state: value as EntangledState })
                  }
                />
              </label>
              {step.amplitudes !== undefined && (
                <p className="muted hint">
                  {say(
                    `Точные амплитуды перенесены из прошлого эксперимента, ближайшее именованное состояние: ${step.state}. Выбор состояния заменит их.`,
                    `Exact amplitudes carried over from the previous experiment, the nearest named state: ${step.state}. Picking a state replaces them.`,
                  )}
                </p>
              )}
              <label
                data-tooltip={say(
                  'Какая наблюдаемая запутывается: спин у фермионов, поляризация у фотонов',
                  'Which observable is entangled: spin for fermions, polarization for photons',
                )}
              >
                <FieldLabel icon={FIELD_ICONS.observable}>
                  {say('Наблюдаемая', 'Observable')}
                </FieldLabel>
                <Select
                  value={step.observable ?? 'spin'}
                  options={observablesFor(step.targets[0] ?? '', labelParticles, catalog)}
                  titles={OBSERVABLE_GLOSSARY}
                  onChange={(value) => onChange({ ...step, observable: value as ObservableName })}
                />
              </label>
            </>
          )}
          {step.operation === 'influence' && (
            <>
              <label data-tooltip={say('Группа воздействий', 'Group of influences')}>
                <FieldLabel icon={FIELD_ICONS.category}>{say('Категория', 'Category')}</FieldLabel>
                <Select
                  value={groupOf(categories, step.influence)?.label ?? ''}
                  options={categories.map((group) => group.label)}
                  onChange={(label) => {
                    const first = categories.find((group) => group.label === label)?.names[0];
                    if (first !== undefined) {
                      changeInfluence(first);
                    }
                  }}
                />
              </label>
              <label data-tooltip={INFLUENCE_GLOSSARY[step.influence] ?? ''}>
                <FieldLabel icon={FIELD_ICONS.influence}>
                  {say('Воздействие', 'Influence')}
                </FieldLabel>
                <Select
                  value={step.influence}
                  options={
                    groupOf(categories, step.influence)?.names ??
                    catalog.influences.map((influence) => influence.name)
                  }
                  titles={INFLUENCE_GLOSSARY}
                  onChange={changeInfluence}
                />
              </label>
              <p className="muted hint">
                {INFLUENCE_GLOSSARY[step.influence] ??
                  influenceDefinition(step.influence)?.description ??
                  ''}
              </p>
              <InfluenceFields
                step={step}
                definition={influenceDefinition(step.influence)}
                labels={labels}
                labelGroups={labelGroups}
                parameters={parameters}
                catalog={catalog}
                symbolOf={symbolOf}
                onChange={onChange}
              />
            </>
          )}
          {step.operation === 'evolve' && (
            <>
              <label
                data-tooltip={say(
                  'Сколько времени частицы эволюционируют в текущем окружении',
                  'How long the particles evolve in the current environment',
                )}
              >
                <FieldLabel icon={FIELD_ICONS.duration}>
                  {say('Длительность, с', 'Duration, s')}
                </FieldLabel>
                <NumberOrParameterInput
                  value={step.durationInSeconds}
                  parameters={parameters}
                  presets={catalog.presets.durationInSeconds}
                  onChange={(value) => onChange({ ...step, durationInSeconds: value })}
                />
              </label>
              <TargetPicker
                labels={labels}
                groups={labelGroups}
                targets={step.targets}
                onChange={(targets) => onChange({ ...step, targets })}
              />
            </>
          )}
          {step.operation === 'measure' && (
            <>
              <label
                data-tooltip={say(
                  'Частица с подготовленной наблюдаемой',
                  'A particle with a prepared observable',
                )}
              >
                <FieldLabel icon={FIELD_ICONS.target}>{say('Цель', 'Target')}</FieldLabel>
                <Select
                  value={step.target}
                  options={labels}
                  onChange={(value) => onChange({ ...step, target: value })}
                />
              </label>
              <label data-tooltip={OBSERVABLE_GLOSSARY[step.observable] ?? ''}>
                <FieldLabel icon={FIELD_ICONS.observable}>
                  {say('Наблюдаемая', 'Observable')}
                </FieldLabel>
                <Select
                  value={step.observable}
                  options={observablesFor(step.target, labelParticles, catalog)}
                  titles={OBSERVABLE_GLOSSARY}
                  onChange={(value) => onChange({ ...step, observable: value as ObservableName })}
                />
              </label>
              <label
                data-tooltip={say(
                  'Угол оси измерения от оси z',
                  'Angle of the measurement axis from the z axis',
                )}
              >
                <FieldLabel icon={FIELD_ICONS.angle}>
                  {say('Полярный угол, °', 'Polar angle, °')}
                </FieldLabel>
                <NumberOrParameterInput
                  value={step.axis?.polarAngleDegrees ?? 0}
                  parameters={parameters}
                  presets={catalog.presets.angleDegrees}
                  onChange={(value) =>
                    onChange({
                      ...step,
                      axis: {
                        polarAngleDegrees: value,
                        azimuthDegrees: step.axis?.azimuthDegrees ?? 0,
                      },
                    })
                  }
                />
              </label>
              <label
                data-tooltip={say(
                  'Поворот оси измерения вокруг z',
                  'Rotation of the measurement axis about z',
                )}
              >
                <FieldLabel icon={FIELD_ICONS.angle}>{say('Азимут, °', 'Azimuth, °')}</FieldLabel>
                <NumberOrParameterInput
                  value={step.axis?.azimuthDegrees ?? 0}
                  parameters={parameters}
                  presets={catalog.presets.angleDegrees}
                  onChange={(value) =>
                    onChange({
                      ...step,
                      axis: {
                        polarAngleDegrees: step.axis?.polarAngleDegrees ?? 0,
                        azimuthDegrees: value,
                      },
                    })
                  }
                />
              </label>
              <label
                data-tooltip={say(
                  'Под этим именем исход попадет в отчет',
                  'The outcome goes into the report under this name',
                )}
              >
                <FieldLabel icon={FIELD_ICONS.record}>
                  {say('Имя записи', 'Record name')}
                </FieldLabel>
                <input
                  value={step.record}
                  onChange={(event) => onChange({ ...step, record: event.target.value })}
                />
              </label>
            </>
          )}
          {step.operation === 'combine' && (
            <>
              <TargetPicker
                labels={labels}
                targets={step.targets}
                onChange={(targets) => onChange({ ...step, targets: targets ?? [] })}
              />
              <label
                data-tooltip={say(
                  'Метка собранной частицы; ее можно измерять, распадать и запутывать дальше',
                  'Label of the composite particle; it can be measured, decayed and entangled further',
                )}
              >
                <FieldLabel icon={FIELD_ICONS.label}>
                  {say('Метка составной частицы', 'Composite particle label')}
                </FieldLabel>
                <input
                  value={step.label}
                  onChange={(event) => onChange({ ...step, label: event.target.value })}
                />
              </label>
            </>
          )}
          {step.operation === 'collide' && (
            <>
              {[0, 1].map((position) => (
                <label
                  key={position}
                  data-tooltip={say(
                    'Любые две элементарные частицы: лептоны, кварки, фотоны, глюоны, W, Z, Хиггс. Энергия столкновения √s берется из их импульсов, заданных в шагах «Создать», или из кинематики распада',
                    'Any two elementary particles: leptons, quarks, photons, gluons, W, Z, Higgs. The collision energy √s comes from their momenta set in the “Create” steps or from decay kinematics',
                  )}
                >
                  <FieldLabel icon={FIELD_ICONS.target}>
                    {say(say('Частица', 'Particle'), 'Particle')} {position + 1}
                  </FieldLabel>
                  <Select
                    value={step.targets[position] ?? ''}
                    options={labels}
                    onChange={(value) =>
                      onChange({
                        ...step,
                        targets: step.targets.map((target, slot) =>
                          slot === position ? value : target,
                        ),
                      })
                    }
                  />
                </label>
              ))}
              <p className="hint">
                {collisionEnergyInGev === null
                  ? say(
                      'Энергия столкновения √s посчитается из импульсов частиц в момент шага: задайте их в шагах «Создать», у продуктов распадов они берутся из кинематики.',
                      'The collision energy √s is computed from the particle momenta at this step: set them in the “Create” steps; decay products take them from the kinematics.',
                    )
                  : say(
                      `Энергия столкновения √s = ${formatNumber(collisionEnergyInGev)} ГэВ из импульсов частиц; меняйте импульсы в шагах «Создать», чтобы сменить энергию.`,
                      `Collision energy √s = ${formatNumber(collisionEnergyInGev)} GeV from the particle momenta; change the momenta in the “Create” steps to change the energy.`,
                    )}
              </p>
              <label
                data-tooltip={say(
                  'Отбор канала, как триггер детектора; без отбора канал разыгрывается по сечениям',
                  'Channel selection, like a detector trigger; without it the channel is sampled by cross section',
                )}
              >
                <FieldLabel icon={FIELD_ICONS.category}>{say('Канал', 'Channel')}</FieldLabel>
                <Select
                  value={step.channel ?? ANY_CHANNEL}
                  options={[ANY_CHANNEL, ...channelOptions]}
                  labels={{ [ANY_CHANNEL]: say('любой, по сечениям', 'any, by cross section') }}
                  onChange={(value) => {
                    const { channel, ...rest } = step;
                    void channel;
                    onChange(value === ANY_CHANNEL ? rest : { ...rest, channel: value });
                  }}
                />
              </label>
              <label
                data-tooltip={say(
                  'Для протонов и нейтронов: порог поперечного импульса жесткого рассеяния партонов, ниже него сечение мягкое и не считается; по умолчанию 20 ГэВ. Для элементарных частиц, ядер и атомов не используется',
                  'For protons and neutrons: the transverse momentum threshold of hard parton scattering, below it the cross section is soft and not computed; 20 GeV by default. Not used for elementary particles, nuclei and atoms',
                )}
              >
                <FieldLabel icon={FIELD_ICONS.momentum}>
                  {say('Порог p_T, ГэВ', 'p_T threshold, GeV')}
                </FieldLabel>
                <NumberOrParameterInput
                  value={step.minimumTransverseMomentumInGev ?? DEFAULT_TRANSVERSE_MOMENTUM_IN_GEV}
                  parameters={parameters}
                  presets={[]}
                  onChange={(value) => onChange({ ...step, minimumTransverseMomentumInGev: value })}
                />
              </label>
              <label
                data-tooltip={say(
                  'Канал, √s, сечение, угол и энергии продуктов попадут в отчет под этим именем; продукты получат метки имя.0 и имя.1',
                  'The channel, √s, cross section, angle and product energies go into the report under this name; the products get the labels name.0 and name.1',
                )}
              >
                <FieldLabel icon={FIELD_ICONS.record}>
                  {say('Имя записи', 'Record name')}
                </FieldLabel>
                <input
                  value={step.record}
                  onChange={(event) => onChange({ ...step, record: event.target.value })}
                />
              </label>
            </>
          )}
          {step.operation === 'place' && (
            <>
              {space === undefined && (
                <p className="warning hint">
                  {say(
                    'Сначала добавьте пространство в карточке «Пространство» выше.',
                    'First add a space in the “Space” card above.',
                  )}
                </p>
              )}
              <label
                data-tooltip={say(
                  'Массивная частица; фотоны и нейтрино в куб не помещаются',
                  'A massive particle; photons and neutrinos do not go into the cube',
                )}
              >
                <FieldLabel icon={FIELD_ICONS.target}>{say('Частица', 'Particle')}</FieldLabel>
                <Select
                  value={step.target}
                  options={labels}
                  onChange={(value) => onChange({ ...step, target: value })}
                />
              </label>
              <label
                data-tooltip={say(
                  'Гауссов пакет заданной ширины, основное состояние ловушки либо атома, орбитали 2s, 2p_z, 3d_z² и суперпозиция 1s + 2p_z у кулоновского центра, или кот: два пакета в ±центре, левый с импульсом частицы, правый с обратным',
                  'A Gaussian packet of the given width, the ground state of a trap or an atom, the 2s, 2p_z, 3d_z² orbitals and the 1s + 2p_z superposition around a Coulomb center, or a cat: two packets at ±center, the left one with the particle momentum, the right one with the opposite',
                )}
              >
                <FieldLabel icon={FIELD_ICONS.stateFamily}>
                  {say('Форма облака', 'Cloud shape')}
                </FieldLabel>
                <Select
                  value={step.shape}
                  options={Object.keys(WAVEPACKET_SHAPE_LABELS)}
                  labels={WAVEPACKET_SHAPE_LABELS}
                  onChange={(value) => onChange({ ...step, shape: value as WavepacketShape })}
                />
              </label>
              {(step.shape === 'gaussian' || step.shape === 'catState') && (
                <label
                  data-tooltip={say(
                    'σ облака вероятности; не меньше 1.5 ячейки',
                    'σ of the probability cloud; at least 1.5 cells',
                  )}
                >
                  <FieldLabel icon={FIELD_ICONS.momentum}>
                    {say('Ширина σ, м', 'Width σ, m')}
                  </FieldLabel>
                  <NumberOrParameterInput
                    value={step.widthInMeters}
                    parameters={parameters}
                    presets={presetsForParameter(catalog.presets, 'widthInMeters')}
                    onChange={(value) => onChange({ ...step, widthInMeters: value })}
                  />
                </label>
              )}
              <fieldset
                className="vector-field"
                data-tooltip={say(
                  'Центр облака относительно центра куба, в метрах',
                  'Cloud center relative to the cube center, in meters',
                )}
              >
                <legend>
                  <FieldLabel icon={FIELD_ICONS.target}>
                    {say('Центр облака, м', 'Cloud center, m')}
                  </FieldLabel>
                </legend>
                <div className="vector-axes">
                  {AXES.map((axis) => (
                    <label key={axis} className="axis">
                      <span className="axis-name">{axis}</span>
                      <NumberOrParameterInput
                        value={step.centerInMeters[axis]}
                        parameters={parameters}
                        presets={centerPresets(space)}
                        onChange={(value) =>
                          onChange({
                            ...step,
                            centerInMeters: { ...step.centerInMeters, [axis]: value },
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
              </fieldset>
            </>
          )}
          {step.operation === 'propagate' && (
            <label
              data-tooltip={say(
                'Сколько времени все облака в кубе эволюционируют по уравнению Шредингера',
                'How long all clouds in the cube evolve by the Schrödinger equation',
              )}
            >
              <FieldLabel icon={FIELD_ICONS.duration}>
                {say('Длительность, с', 'Duration, s')}
              </FieldLabel>
              <NumberOrParameterInput
                value={step.durationInSeconds}
                parameters={parameters}
                presets={presetsForParameter(catalog.presets, 'spaceDurationInSeconds')}
                onChange={(value) => onChange({ ...step, durationInSeconds: value })}
              />
            </label>
          )}
          {step.operation === 'measureSystem' && (
            <label
              data-tooltip={say(
                'Состав системы попадет в отчет как категория, например electron+positron; мезоны из струн и их распадов сводятся в hadrons. Числа: имя.particleCount, имя.chargedCount, имя.hadronCount, имя.photonCount, имя.hadronic и имя.count.pionPlus для любой частицы',
                'The system composition goes into the report as a category, e.g. electron+positron; mesons from strings and their decays are grouped as hadrons. Numbers: name.particleCount, name.chargedCount, name.hadronCount, name.photonCount, name.hadronic and name.count.pionPlus for any particle',
              )}
            >
              <FieldLabel icon={FIELD_ICONS.record}>{say('Имя записи', 'Record name')}</FieldLabel>
              <input
                value={step.record}
                onChange={(event) => onChange({ ...step, record: event.target.value })}
              />
            </label>
          )}
          {step.operation === 'keyframe' && (
            <KeyframeEditor
              step={step}
              targets={keyframeTargets}
              quantitiesOf={keyframeQuantities}
              symbolOf={symbolOf}
              onChange={onChange}
            />
          )}
          {step.operation === 'measurePosition' && (
            <>
              <label
                data-tooltip={say('Частица, помещенная в куб', 'A particle placed in the cube')}
              >
                <FieldLabel icon={FIELD_ICONS.target}>{say('Частица', 'Particle')}</FieldLabel>
                <Select
                  value={step.target}
                  options={placed.length > 0 ? placed : labels}
                  onChange={(value) => onChange({ ...step, target: value })}
                />
              </label>
              <label
                data-tooltip={say(
                  'Координаты попадут в отчет как имя.x, имя.y, имя.z и расстояние от центра имя.r',
                  'The coordinates go into the report as name.x, name.y, name.z and the distance from the center as name.r',
                )}
              >
                <FieldLabel icon={FIELD_ICONS.record}>
                  {say('Имя записи', 'Record name')}
                </FieldLabel>
                <input
                  value={step.record}
                  onChange={(event) => onChange({ ...step, record: event.target.value })}
                />
              </label>
            </>
          )}
          {step.operation === 'diffract' && (
            <>
              <label
                data-tooltip={say(
                  'Частица с ненулевым импульсом: длина волны де Бройля λ = h/p',
                  'A particle with nonzero momentum: de Broglie wavelength λ = h/p',
                )}
              >
                <FieldLabel icon={FIELD_ICONS.target}>{say('Частица', 'Particle')}</FieldLabel>
                <Select
                  value={step.target}
                  options={labels}
                  onChange={(value) => onChange({ ...step, target: value })}
                />
              </label>
              {(
                ['slitSeparationInMeters', 'slitWidthInMeters', 'screenDistanceInMeters'] as const
              ).map((field) => (
                <label key={field} data-tooltip={field}>
                  <FieldLabel icon={parameterIcon(field)}>
                    {PARAMETER_GLOSSARY[field] ?? field}
                  </FieldLabel>
                  <NumberOrParameterInput
                    value={step[field]}
                    parameters={parameters}
                    presets={presetsForParameter(catalog.presets, field)}
                    onChange={(value) => onChange({ ...step, [field]: value })}
                  />
                </label>
              ))}
              <label
                data-tooltip={say(
                  'Детектор у щелей узнает, через какую прошла частица, и интерференция исчезает',
                  'A detector at the slits learns which slit the particle took, and the interference disappears',
                )}
              >
                <FieldLabel icon={FIELD_ICONS.observable}>
                  {say('Детектор пути', 'Which-path detector')}
                </FieldLabel>
                <Select
                  value={String(step.whichPathDetector)}
                  options={['0', '1', ...parameters.map((name) => `{{${name}}}`)]}
                  labels={{
                    '0': say('нет, интерференция', 'no, interference'),
                    '1': say('есть, путь известен', 'yes, path known'),
                  }}
                  onChange={(value) =>
                    onChange({
                      ...step,
                      whichPathDetector:
                        value === '0' || value === '1' ? Number(value) : (value as `{{${string}}}`),
                    })
                  }
                />
              </label>
              <label
                data-tooltip={say(
                  'Квантовый ластик: путь записывается в поляризацию или спин другой, запутанной частицы. На экране полос нет, но они появляются в совпадениях с ее измерением в базисе ластика',
                  'Quantum eraser: the path is written into the polarization or spin of another, entangled particle. The screen shows no fringes, but they appear in coincidence with its measurement in the eraser basis',
                )}
              >
                <FieldLabel icon={FIELD_ICONS.state}>{say('Метка пути', 'Path marker')}</FieldLabel>
                <Select
                  value={step.pathMarker ?? NO_PATH_MARKER}
                  options={[NO_PATH_MARKER, ...labels.filter((label) => label !== step.target)]}
                  labels={{ [NO_PATH_MARKER]: say('нет', 'none') }}
                  onChange={(value) => {
                    const { pathMarker, ...rest } = step;
                    void pathMarker;
                    onChange(value === NO_PATH_MARKER ? rest : { ...rest, pathMarker: value });
                  }}
                />
              </label>
              <label
                data-tooltip={say(
                  'Под этим именем попадание на экран в микрометрах попадет в отчет; стройте по нему гистограмму',
                  'The hit position on the screen in micrometers goes into the report under this name; plot a histogram of it',
                )}
              >
                <FieldLabel icon={FIELD_ICONS.record}>
                  {say('Имя записи', 'Record name')}
                </FieldLabel>
                <input
                  value={step.record}
                  onChange={(event) => onChange({ ...step, record: event.target.value })}
                />
              </label>
            </>
          )}
          {step.operation === 'decay' && (
            <>
              <label
                data-tooltip={say(
                  'Нестабильная частица: мюон, тау, нейтрон, W, Z, Хиггс, топ-кварк',
                  'An unstable particle: muon, tau, neutron, W, Z, Higgs, top quark',
                )}
              >
                <FieldLabel icon={FIELD_ICONS.target}>{say('Цель', 'Target')}</FieldLabel>
                <Select
                  value={step.target}
                  options={labels.filter((label) => {
                    const particle = labelParticles.get(label);
                    if (particle === null || particle === undefined) {
                      return true;
                    }
                    return (
                      (catalog.particles.find((entry) => entry.name === particle)?.decays.length ??
                        0) > 0
                    );
                  })}
                  onChange={(value) => onChange({ ...step, target: value })}
                />
              </label>
              <label
                data-tooltip={say(
                  'Под этим именем канал и кинематика распада попадут в отчет',
                  'The decay channel and kinematics go into the report under this name',
                )}
              >
                <FieldLabel icon={FIELD_ICONS.record}>
                  {say('Имя записи', 'Record name')}
                </FieldLabel>
                <input
                  value={step.record ?? ''}
                  onChange={(event) => onChange({ ...step, record: event.target.value })}
                />
              </label>
            </>
          )}
        </div>
      )}
    </div>
  );
}
