/* Pure editing operations on an ExperimentPlan used by the pipeline builder: steps, parameters and reports; groups of particles made by a create step with a count and their member labels. */
import type {
  EnvironmentPreset,
  ExperimentPlan,
  ExperimentStep,
  InfluenceDefinition,
  InfluenceParameterSpec,
  InfluenceStep,
  InfluenceStepScalar,
  InfluenceStepValue,
  ParticleName,
  ReportSpec,
  ReportStatistic,
  SpaceSpec,
  TemplateCategory,
} from '@standard-model/contracts';
import { MAXIMUM_GROUP_SIZE, groupMemberLabels } from '@standard-model/contracts';
import { WAVEPACKET_SHAPE_LABELS } from './glossary';
import { say } from './language';

export type Operation = ExperimentStep['operation'];

const DEFAULT_NUCLEUS = { protons: 26, massNumber: 56 } as const;
const DEFAULT_ATOM = { protons: 11 } as const;
const DEFAULT_MOLECULE = {
  atoms: [{ protons: 8 }, { protons: 1 }, { protons: 1 }],
  bonds: [
    { first: 0, second: 1, order: 1 },
    { first: 0, second: 2, order: 1 },
  ],
} as const;

const MATTER_CREATION: ReadonlySet<Operation> = new Set([
  'create',
  'createNucleus',
  'createAtom',
  'createMolecule',
]);

export function isCreation(
  step: ExperimentStep,
): step is Extract<
  ExperimentStep,
  { operation: 'create' | 'createNucleus' | 'createAtom' | 'createMolecule' }
> {
  return MATTER_CREATION.has(step.operation);
}

export function emptyPlan(name = 'newExperiment'): ExperimentPlan {
  return { name, parameters: {}, shots: 10_000, seed: 1, steps: [], report: [] };
}

export function defaultStep(operation: Operation, plan: ExperimentPlan): ExperimentStep {
  const labels = createdLabels(plan, plan.steps.length);
  const first = labels[0] ?? 'particle';
  const second = labels[1] ?? first;
  switch (operation) {
    case 'create':
      return {
        operation,
        label: `particle${String(plan.steps.length + 1)}`,
        particle: 'electron',
        spin: 'up',
      };
    case 'createNucleus':
      return {
        operation,
        label: `nucleus${String(plan.steps.length + 1)}`,
        ...DEFAULT_NUCLEUS,
      };
    case 'createAtom':
      return { operation, label: `atom${String(plan.steps.length + 1)}`, ...DEFAULT_ATOM };
    case 'createMolecule':
      return {
        operation,
        label: `molecule${String(plan.steps.length + 1)}`,
        ...DEFAULT_MOLECULE,
      };
    case 'entangle':
      return { operation, targets: [first, second], state: 'spinSinglet' };
    case 'influence':
      return { operation, influence: 'applyMagneticField', parameters: { zInTesla: 1 } };
    case 'evolve':
      return { operation, durationInSeconds: 1e-9 };
    case 'measure':
      return {
        operation,
        target: first,
        observable: 'spin',
        axis: { polarAngleDegrees: 0, azimuthDegrees: 0 },
        record: `record${String(plan.steps.length + 1)}`,
      };
    case 'combine':
      return {
        operation,
        targets: labels.slice(0, 3),
        label: `composite${String(plan.steps.length + 1)}`,
      };
    case 'diffract':
      return {
        operation,
        target: first,
        slitSeparationInMeters: 1e-6,
        slitWidthInMeters: 2e-7,
        screenDistanceInMeters: 1,
        whichPathDetector: 0,
        record: `screen${String(plan.steps.length + 1)}`,
      };
    case 'collide':
      return {
        operation,
        targets: [first, second],
        record: `collision${String(plan.steps.length + 1)}`,
      };
    case 'place':
      return {
        operation,
        target: first,
        centerInMeters: { x: 0, y: 0, z: 0 },
        widthInMeters: 2 * (Number(plan.space?.cellSizeInMeters) || 5e-11),
        shape: 'gaussian',
      };
    case 'propagate':
      return { operation, durationInSeconds: 1e-16 };
    case 'measurePosition':
      return { operation, target: first, record: `position${String(plan.steps.length + 1)}` };
    case 'measureSystem':
      return { operation, record: `system${String(plan.steps.length + 1)}` };
    case 'decay':
      return { operation, target: first, record: `decay${String(plan.steps.length + 1)}` };
  }
}

export const DEFAULT_SPACE: SpaceSpec = {
  gridPointsPerAxis: 32,
  cellSizeInMeters: 5e-11,
  potential: 'free',
};

export function placedLabels(plan: ExperimentPlan, beforeIndex: number): readonly string[] {
  return [
    ...new Set(
      plan.steps
        .slice(0, beforeIndex)
        .filter(
          (step): step is Extract<ExperimentStep, { operation: 'place' }> =>
            step.operation === 'place',
        )
        .map((step) => step.target),
    ),
  ];
}

export interface CompositeSource {
  readonly name: ParticleName;
  readonly constituents: readonly ParticleName[] | null;
}

function sortedKey(names: readonly string[]): string {
  return [...names].sort().join('+');
}

export function compositeOf(
  constituents: readonly (ParticleName | null)[],
  particles: readonly CompositeSource[],
): ParticleName | null {
  if (constituents.some((name) => name === null)) {
    return null;
  }
  const key = sortedKey(constituents as readonly string[]);
  return (
    particles.find((entry) => entry.constituents !== null && sortedKey(entry.constituents) === key)
      ?.name ?? null
  );
}

export const GROUP_MEMBERS_SHOWN = 5;

export function groupCountOf(step: ExperimentStep, plan: ExperimentPlan): number {
  if (!isCreation(step) || step.count === undefined) {
    return 1;
  }
  const value =
    typeof step.count === 'number' ? step.count : (plan.parameters[step.count.slice(2, -2)] ?? 1);
  return Number.isInteger(value) && value >= 1 ? Math.min(value, MAXIMUM_GROUP_SIZE) : 1;
}

export function membersOf(step: ExperimentStep, plan: ExperimentPlan): readonly string[] {
  return isCreation(step) ? groupMemberLabels(step.label, groupCountOf(step, plan)) : [];
}

export function labelGroups(
  plan: ExperimentPlan,
  beforeIndex: number,
): ReadonlyMap<string, readonly string[]> {
  const alive = new Set(createdLabels(plan, beforeIndex));
  return new Map(
    plan.steps.slice(0, beforeIndex).flatMap((step) => {
      const members = membersOf(step, plan).filter((member) => alive.has(member));
      return isCreation(step) && groupCountOf(step, plan) > 1 && members.length > 0
        ? [[step.label, members] as const]
        : [];
    }),
  );
}

export function createdLabels(plan: ExperimentPlan, beforeIndex: number): readonly string[] {
  const labels: string[] = [];
  const gone = new Set<string>();
  plan.steps.slice(0, beforeIndex).forEach((step) => {
    if (isCreation(step)) {
      labels.push(...membersOf(step, plan));
    }
    if (step.operation === 'combine') {
      labels.push(step.label);
    }
    if (step.operation === 'combine') {
      step.targets.forEach((target) => gone.add(target));
    }
    if (step.operation === 'decay') {
      gone.add(step.target);
      labels.push(`${step.target}.0`, `${step.target}.1`, `${step.target}.2`);
    }
    if (step.operation === 'collide') {
      step.targets.forEach((target) => gone.add(target));
      labels.push(`${step.record}.0`, `${step.record}.1`);
    }
  });
  return labels.filter((label) => !gone.has(label));
}

const DECAY_NUMERIC_FIELDS = [
  'properTimeInSeconds',
  'labTimeInSeconds',
  'decayLengthInMeters',
  'product[0].energyInGev',
  'product[1].energyInGev',
  'product[2].energyInGev',
] as const;

export function categoricalRecords(plan: ExperimentPlan): readonly string[] {
  return plan.steps.flatMap((step) => {
    if (step.operation === 'measure') {
      return [step.record];
    }
    if (step.operation === 'decay') {
      return [step.record ?? `${step.target}.decay`];
    }
    if (step.operation === 'collide') {
      return [step.record, `${step.record}.partons`];
    }
    if (step.operation === 'measureSystem') {
      return [step.record, `${step.record}.heaviest`];
    }
    return [];
  });
}

export function numericRecords(plan: ExperimentPlan): readonly string[] {
  return plan.steps.flatMap((step, index) => {
    if (step.operation === 'measure' || step.operation === 'diffract') {
      return [step.record];
    }
    if (step.operation === 'decay') {
      const record = step.record ?? `${step.target}.decay`;
      return DECAY_NUMERIC_FIELDS.map((field) => `${record}.${field}`);
    }
    if (step.operation === 'collide') {
      return COLLISION_NUMERIC_FIELDS.map((field) => `${step.record}.${field}`);
    }
    if (step.operation === 'measurePosition') {
      return ['x', 'y', 'z', 'r'].map((axis) => `${step.record}.${axis}`);
    }
    if (step.operation === 'measureSystem') {
      return [
        ...[
          'particleCount',
          'chargedCount',
          'hadronCount',
          'photonCount',
          'hadronic',
          'heaviestMassNumber',
        ].map((field) => `${step.record}.${field}`),
        ...objectFields(plan, index).flatMap(({ label, fields }) =>
          fields.map((field) => `${step.record}.${label}.${field}`),
        ),
      ];
    }
    return [];
  });
}

const COMMON_OBJECT_FIELDS = [
  'massInGev',
  'chargeInElementaryUnits',
  'spin',
  'energyInGev',
  'momentumInGev',
  'speedFraction',
] as const;
const NUCLEUS_FIELDS = [
  'protons',
  'neutrons',
  'massNumber',
  'bindingEnergyPerNucleonInMev',
  'halfLifeInSeconds',
  'neutronSeparationEnergyInMev',
  'protonSeparationEnergyInMev',
] as const;
const ATOM_FIELDS = [
  'electrons',
  'ionizationEnergyInEv',
  'landeFactor',
  'magneticMomentInBohrMagnetons',
  'kineticTemperatureInKelvin',
] as const;
const MOLECULE_FIELDS = [
  'atomCount',
  'bondCount',
  'massInDaltons',
  'dipoleMomentInDebye',
  'largestRotationalConstantInGigahertz',
  'smallestRotationalConstantInGigahertz',
  'vibrationalModeCount',
  'lowestWavenumberInInverseCentimeters',
  'highestWavenumberInInverseCentimeters',
  'internalTemperatureInKelvin',
  'vibrationalQuanta',
  'bondEnergyInEv',
  'weakestBondInEv',
  'meanBondLengthInAngstrom',
  'kineticTemperatureInKelvin',
] as const;

export function objectFields(
  plan: ExperimentPlan,
  beforeIndex: number,
): readonly { readonly label: string; readonly fields: readonly string[] }[] {
  const alive = new Set(createdLabels(plan, beforeIndex));
  return plan.steps.slice(0, beforeIndex).flatMap((step) => {
    if (!isCreation(step)) {
      return [];
    }
    const members = membersOf(step, plan)
      .filter((member) => alive.has(member))
      .slice(0, GROUP_MEMBERS_SHOWN);
    if (members.length === 0) {
      return [];
    }
    const fields: readonly string[] =
      step.operation === 'createNucleus'
        ? [...COMMON_OBJECT_FIELDS, ...NUCLEUS_FIELDS]
        : step.operation === 'createAtom'
          ? [...COMMON_OBJECT_FIELDS, ...NUCLEUS_FIELDS, ...ATOM_FIELDS]
          : step.operation === 'createMolecule'
            ? [...COMMON_OBJECT_FIELDS, ...MOLECULE_FIELDS]
            : COMMON_OBJECT_FIELDS;
    return members.map((label) => ({ label, fields }));
  });
}

const COLLISION_NUMERIC_FIELDS = [
  'sqrtSInGev',
  'crossSectionInNanobarns',
  'cosThetaStar',
  'kineticEnergyInKev',
  'product[0].energyInGev',
  'product[1].energyInGev',
  'product[0].kineticEnergyInKev',
  'product[1].kineticEnergyInKev',
  'firstMomentumFraction',
  'secondMomentumFraction',
  'hardEnergyInGev',
  'transverseMomentumInGev',
] as const;

export function recordsForStatistic(
  plan: ExperimentPlan,
  statistic: ReportStatistic,
): readonly string[] {
  return statistic === 'frequency' ? categoricalRecords(plan) : numericRecords(plan);
}

export function recordNames(plan: ExperimentPlan): readonly string[] {
  return [...new Set([...categoricalRecords(plan), ...numericRecords(plan)])];
}

export function addStep(plan: ExperimentPlan, operation: Operation): ExperimentPlan {
  return { ...plan, steps: [...plan.steps, defaultStep(operation, plan)] };
}

export function updateStep(
  plan: ExperimentPlan,
  index: number,
  step: ExperimentStep,
): ExperimentPlan {
  return {
    ...plan,
    steps: plan.steps.map((existing, position) => (position === index ? step : existing)),
  };
}

export function removeStep(plan: ExperimentPlan, index: number): ExperimentPlan {
  return { ...plan, steps: plan.steps.filter((ignored, position) => position !== index) };
}

function takenNames(plan: ExperimentPlan): ReadonlySet<string> {
  return new Set(
    plan.steps.flatMap((step) => [
      ...('label' in step ? [step.label] : []),
      ...('record' in step && step.record !== undefined ? [step.record] : []),
    ]),
  );
}

export function freshName(name: string, taken: ReadonlySet<string>): string {
  const base = name.replace(/\d+$/, '');
  let number = Number(/\d+$/.exec(name)?.[0] ?? 1) + 1;
  while (taken.has(`${base}${String(number)}`)) {
    number += 1;
  }
  return `${base}${String(number)}`;
}

export function duplicateStep(plan: ExperimentPlan, index: number): ExperimentPlan {
  const original = plan.steps[index];
  if (original === undefined) {
    return plan;
  }
  const taken = takenNames(plan);
  const copy = {
    ...original,
    ...('label' in original ? { label: freshName(original.label, taken) } : {}),
    ...('record' in original && original.record !== undefined
      ? { record: freshName(original.record, taken) }
      : {}),
  } as ExperimentStep;
  const steps = [...plan.steps];
  steps.splice(index + 1, 0, copy);
  return { ...plan, steps };
}

export function moveStep(plan: ExperimentPlan, index: number, offset: number): ExperimentPlan {
  const target = index + offset;
  if (target < 0 || target >= plan.steps.length) {
    return plan;
  }
  const steps = [...plan.steps];
  const [moved] = steps.splice(index, 1);
  if (moved === undefined) {
    return plan;
  }
  steps.splice(target, 0, moved);
  return { ...plan, steps };
}

export function reorderStep(
  plan: ExperimentPlan,
  from: number,
  insertBefore: number,
): ExperimentPlan {
  const target = insertBefore > from ? insertBefore - 1 : insertBefore;
  if (from < 0 || from >= plan.steps.length || target === from || target < 0) {
    return plan;
  }
  const steps = [...plan.steps];
  const [moved] = steps.splice(from, 1);
  if (moved === undefined) {
    return plan;
  }
  steps.splice(Math.min(target, steps.length), 0, moved);
  return { ...plan, steps };
}

export function reorderedIndex(index: number, from: number, insertBefore: number): number {
  const target = insertBefore > from ? insertBefore - 1 : insertBefore;
  if (index === from) {
    return target;
  }
  if (from < index && index <= target) {
    return index - 1;
  }
  if (target <= index && index < from) {
    return index + 1;
  }
  return index;
}

export function toggleCategory(plan: ExperimentPlan, category: TemplateCategory): ExperimentPlan {
  const current = plan.categories ?? [];
  const categories = current.includes(category)
    ? current.filter((existing) => existing !== category)
    : [...current, category];
  return { ...plan, categories };
}

export function setParameter(plan: ExperimentPlan, name: string, value: number): ExperimentPlan {
  return { ...plan, parameters: { ...plan.parameters, [name]: value } };
}

export function removeParameter(plan: ExperimentPlan, name: string): ExperimentPlan {
  const parameters = { ...plan.parameters };
  delete parameters[name];
  return { ...plan, parameters };
}

export function addReport(plan: ExperimentPlan): ExperimentPlan {
  const [firstRecord] = categoricalRecords(plan);
  return {
    ...plan,
    report: [...plan.report, { statistic: 'frequency', records: [firstRecord ?? 'record1'] }],
  };
}

export function updateReport(
  plan: ExperimentPlan,
  index: number,
  report: ReportSpec,
): ExperimentPlan {
  return {
    ...plan,
    report: plan.report.map((existing, position) => (position === index ? report : existing)),
  };
}

export function removeReport(plan: ExperimentPlan, index: number): ExperimentPlan {
  return { ...plan, report: plan.report.filter((ignored, position) => position !== index) };
}

export function parseNumberOrParameter(text: string): number | `{{${string}}}` {
  const trimmed = text.trim();
  if (/^\{\{[A-Za-z][A-Za-z0-9]*\}\}$/.test(trimmed)) {
    return trimmed as `{{${string}}}`;
  }
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : 0;
}

export const RECORD_COUNTS: Readonly<Record<ReportStatistic, number>> = {
  frequency: 1,
  mean: 1,
  probabilitySameSign: 2,
  correlation: 2,
  chsh: 8,
  histogram: 1,
  standardDeviation: 1,
};

export function labelParticles(
  plan: ExperimentPlan,
  beforeIndex: number,
  particles: readonly CompositeSource[] = [],
): ReadonlyMap<string, ParticleName | null> {
  const known = new Map<string, ParticleName | null>();
  plan.steps.slice(0, beforeIndex).forEach((step) => {
    if (step.operation === 'create') {
      known.set(step.label, step.particle);
    }
    if (step.operation === 'combine') {
      known.set(
        step.label,
        compositeOf(
          step.targets.map((target) => known.get(target) ?? null),
          particles,
        ),
      );
    }
    if (step.operation === 'decay') {
      [0, 1, 2].forEach((index) => known.set(`${step.target}.${String(index)}`, null));
    }
  });
  return known;
}

export function collisionEnergyInGev(
  plan: ExperimentPlan,
  beforeIndex: number,
  targets: readonly string[],
  massOf: (particle: ParticleName) => number,
): number | null {
  const resolve = (entry: number | `{{${string}}}`): number | null =>
    typeof entry === 'number' ? entry : (plan.parameters[entry.slice(2, -2)] ?? null);
  const momenta = targets.map((target) => {
    const creation = plan.steps
      .slice(0, beforeIndex)
      .filter((step) => step.operation === 'create' && step.label === target)
      .at(-1);
    if (creation?.operation !== 'create') {
      return null;
    }
    const vector = creation.momentumInGev ?? { x: 0, y: 0, z: 0 };
    const [x, y, z] = [vector.x, vector.y, vector.z].map(resolve);
    if (
      x === null ||
      x === undefined ||
      y === null ||
      y === undefined ||
      z === null ||
      z === undefined
    ) {
      return null;
    }
    return { energy: Math.hypot(massOf(creation.particle), x, y, z), x, y, z };
  });
  const [first, second] = momenta;
  if (
    momenta.length !== 2 ||
    first === null ||
    first === undefined ||
    second === null ||
    second === undefined
  ) {
    return null;
  }
  const invariant =
    (first.energy + second.energy) ** 2 -
    (first.x + second.x) ** 2 -
    (first.y + second.y) ** 2 -
    (first.z + second.z) ** 2;
  return Math.sqrt(Math.max(invariant, 0));
}

function defaultScalar(spec: InfluenceParameterSpec): InfluenceStepScalar | undefined {
  if (spec.kind === 'particleName') {
    return 'electron';
  }
  if (spec.kind === 'choice') {
    return spec.defaultValue ?? spec.choices?.[0];
  }
  return spec.required ? 0 : spec.defaultValue;
}

export function defaultListItem(
  fields: readonly InfluenceParameterSpec[],
): Record<string, InfluenceStepScalar> {
  return Object.fromEntries(
    fields.flatMap((field) => {
      const value = defaultScalar(field);
      return value === undefined ? [] : [[field.name, value]];
    }),
  );
}

export function defaultInfluenceParameters(
  definition: InfluenceDefinition,
): Record<string, InfluenceStepValue> {
  return Object.fromEntries(
    definition.parameters.flatMap((spec) => {
      const value =
        spec.kind === 'list' ? [defaultListItem(spec.fields ?? [])] : defaultScalar(spec);
      return value === undefined ? [] : [[spec.name, value]];
    }),
  );
}

export function isInfluenceScalar(
  value: InfluenceStepValue | undefined,
): value is InfluenceStepScalar {
  return value !== undefined && !Array.isArray(value);
}

const LEGACY_MEDIUM_KEYS = ['species', 'numberDensityPerCubicMeter', 'crossSectionInSquareMeters'];

export function influenceParameters(step: InfluenceStep): Record<string, InfluenceStepValue> {
  const parameters = { ...(step.parameters ?? {}) };
  if (step.influence !== 'setMedium' || 'components' in parameters || !('species' in parameters)) {
    return parameters;
  }
  const component = Object.fromEntries(
    LEGACY_MEDIUM_KEYS.flatMap((key) => {
      const value = parameters[key];
      return isInfluenceScalar(value) ? [[key, value]] : [];
    }),
  );
  return {
    ...Object.fromEntries(
      Object.entries(parameters).filter(([key]) => !LEGACY_MEDIUM_KEYS.includes(key)),
    ),
    components: [component],
  };
}

export function resizeRecords(
  records: readonly string[],
  count: number,
  fallback: string,
): readonly string[] {
  return Array.from(
    { length: count },
    (ignored, index) => records[index] ?? records[0] ?? fallback,
  );
}

export function formatValue(value: InfluenceStepValue): string {
  if (!isInfluenceScalar(value)) {
    return `[${value.map((record) => Object.values(record).map(formatValue).join(' ')).join('; ')}]`;
  }
  return typeof value === 'number' ? Number(value.toPrecision(6)).toString() : String(value);
}

export function planWarnings(plan: ExperimentPlan): readonly string[] {
  const warnings: string[] = [];
  const hasObservation = plan.steps.some(
    (step) =>
      step.operation === 'measure' ||
      step.operation === 'decay' ||
      step.operation === 'diffract' ||
      step.operation === 'collide' ||
      step.operation === 'measurePosition' ||
      step.operation === 'measureSystem',
  );
  if (!hasObservation) {
    warnings.push(
      say(
        'В плане нет ни измерения, ни распада: результат будет пустым.',
        'The plan has no measurement and no decay: the result will be empty.',
      ),
    );
  }
  if (plan.report.length === 0) {
    warnings.push(
      say(
        'В отчете нет статистик: добавьте хотя бы одну, иначе считать нечего.',
        'The report has no statistics: add at least one, otherwise there is nothing to compute.',
      ),
    );
  }
  return warnings;
}

function groupText(step: ExperimentStep): string {
  return !isCreation(step) || step.count === undefined || step.count === 1
    ? ''
    : say(
        `${formatValue(step.count)} объектов, группа `,
        `${formatValue(step.count)} objects, group `,
      );
}

export function describeStep(step: ExperimentStep): string {
  switch (step.operation) {
    case 'create': {
      const momentum = step.momentumInGev;
      const momentumText =
        momentum === undefined
          ? ''
          : `, ${say('импульс', 'momentum')} (${formatValue(momentum.x)}, ${formatValue(momentum.y)}, ${formatValue(momentum.z)}) ${say('ГэВ', 'GeV')}`;
      const spinText =
        step.spinDirection === undefined
          ? step.spin === undefined
            ? ''
            : `, ${say('спин', 'spin')} ${step.spin}`
          : `, ${say('спин', 'spin')} θ = ${formatValue(step.spinDirection.polarAngleDegrees)}°, φ = ${formatValue(step.spinDirection.azimuthDegrees)}°`;
      return `${say('создать', 'create')} ${groupText(step)}${step.label}: ${step.particle}${spinText}${momentumText}`;
    }
    case 'createNucleus':
      return `${say('создать ядро', 'create nucleus')} ${groupText(step)}${step.label}: Z = ${String(step.protons)}, A = ${String(step.massNumber)}`;
    case 'createAtom':
      return `${say('создать', 'create')} ${step.charge === undefined || step.charge === 0 ? say('атом', 'atom') : `${say('ион', 'ion')} ${String(step.charge)}+`} ${groupText(step)}${step.label}: Z = ${String(step.protons)}${step.massNumber === undefined ? '' : `, A = ${String(step.massNumber)}`}${step.spin === undefined ? '' : `, ${say('спин', 'spin')} ${step.spin}`}`;
    case 'createMolecule':
      return say(
        `создать молекулу ${groupText(step)}${step.label}: ${String(step.atoms.length)} атомов, ${String(step.bonds.length)} связей`,
        `create molecule ${groupText(step)}${step.label}: ${String(step.atoms.length)} atoms, ${String(step.bonds.length)} bonds`,
      );
    case 'entangle':
      return say(
        `запутать ${step.targets.join(' и ')} в ${step.amplitudes === undefined ? step.state : `перенесенное состояние ≈ ${step.state}`}${step.observable === undefined ? '' : ` по ${step.observable}`}`,
        `entangle ${step.targets.join(' and ')} into ${step.amplitudes === undefined ? step.state : `the carried-over state ≈ ${step.state}`}${step.observable === undefined ? '' : ` in ${step.observable}`}`,
      );
    case 'influence': {
      const parameters = Object.entries(step.parameters ?? {})
        .map(([key, value]) => `${key} = ${formatValue(value)}`)
        .join(', ');
      return say(
        `воздействие ${step.influence}${parameters === '' ? '' : ` (${parameters})`} на ${step.targets?.join(', ') ?? 'все живые'}`,
        `influence ${step.influence}${parameters === '' ? '' : ` (${parameters})`} on ${step.targets?.join(', ') ?? 'all alive'}`,
      );
    }
    case 'evolve':
      return say(
        `эволюция ${formatValue(step.durationInSeconds)} с для ${step.targets?.join(', ') ?? 'всех живых'}`,
        `evolve ${formatValue(step.durationInSeconds)} s for ${step.targets?.join(', ') ?? 'all alive'}`,
      );
    case 'measure': {
      const axis =
        step.axis === undefined
          ? ''
          : ` ${say('по оси', 'along the axis')} (${formatValue(step.axis.polarAngleDegrees)}°, ${formatValue(step.axis.azimuthDegrees)}°)`;
      return say(
        `измерить ${step.observable} у ${step.target}${axis} → запись ${step.record}`,
        `measure ${step.observable} of ${step.target}${axis} → record ${step.record}`,
      );
    }
    case 'combine':
      return say(
        `собрать ${step.label} из ${step.targets.join(', ')}`,
        `combine ${step.targets.join(', ')} into ${step.label}`,
      );
    case 'diffract':
      return say(
        `${step.target} через две щели d = ${formatValue(step.slitSeparationInMeters)} м, a = ${formatValue(step.slitWidthInMeters)} м, экран ${formatValue(step.screenDistanceInMeters)} м${step.whichPathDetector === 0 ? '' : ', с детектором пути'}${step.pathMarker === undefined ? '' : `, путь помечен в ${step.pathMarker}`} → запись ${step.record}`,
        `${step.target} through two slits d = ${formatValue(step.slitSeparationInMeters)} m, a = ${formatValue(step.slitWidthInMeters)} m, screen at ${formatValue(step.screenDistanceInMeters)} m${step.whichPathDetector === 0 ? '' : ', with a which-path detector'}${step.pathMarker === undefined ? '' : `, path marked in ${step.pathMarker}`} → record ${step.record}`,
      );
    case 'collide':
      return say(
        `столкнуть ${step.targets.join(' и ')}${step.channel === undefined ? '' : `, только канал ${step.channel}`} → запись ${step.record}`,
        `collide ${step.targets.join(' and ')}${step.channel === undefined ? '' : `, channel ${step.channel} only`} → record ${step.record}`,
      );
    case 'place':
      return say(
        `поместить ${step.target} в куб: ${step.shape === 'gaussian' || step.shape === 'catState' ? `${WAVEPACKET_SHAPE_LABELS[step.shape] ?? step.shape} σ = ${formatValue(step.widthInMeters)} м` : (WAVEPACKET_SHAPE_LABELS[step.shape] ?? step.shape)} в (${formatValue(step.centerInMeters.x)}, ${formatValue(step.centerInMeters.y)}, ${formatValue(step.centerInMeters.z)}) м`,
        `place ${step.target} in the cube: ${step.shape === 'gaussian' || step.shape === 'catState' ? `${WAVEPACKET_SHAPE_LABELS[step.shape] ?? step.shape} σ = ${formatValue(step.widthInMeters)} m` : (WAVEPACKET_SHAPE_LABELS[step.shape] ?? step.shape)} at (${formatValue(step.centerInMeters.x)}, ${formatValue(step.centerInMeters.y)}, ${formatValue(step.centerInMeters.z)}) m`,
      );
    case 'propagate':
      return say(
        `эволюция в кубе ${formatValue(step.durationInSeconds)} с`,
        `evolve in the cube for ${formatValue(step.durationInSeconds)} s`,
      );
    case 'measurePosition':
      return say(
        `найти положение ${step.target} → запись ${step.record}`,
        `find the position of ${step.target} → record ${step.record}`,
      );
    case 'measureSystem':
      return say(
        `замер системы: какие частицы есть → запись ${step.record}`,
        `system snapshot: which particles are present → record ${step.record}`,
      );
    case 'decay':
      return say(
        `распад ${step.target} → запись ${step.record ?? `${step.target}.decay`}`,
        `decay of ${step.target} → record ${step.record ?? `${step.target}.decay`}`,
      );
  }
}

const PRESET_KEYS = [
  'components',
  'temperatureInKelvin',
  'pressureInPascals',
  'radiationTemperatureInKelvin',
] as const;

function presetSignature(parameters: Record<string, InfluenceStepValue>): string {
  const components = parameters.components;
  return JSON.stringify([
    (isInfluenceScalar(components) ? [] : (components ?? [])).map((component) => [
      component.species,
      component.numberDensityPerCubicMeter,
    ]),
    ...PRESET_KEYS.slice(1).map((key) => parameters[key] ?? null),
  ]);
}

export function applyEnvironmentPreset(
  step: InfluenceStep,
  preset: EnvironmentPreset,
): InfluenceStep {
  const { radiationTemperatureInKelvin, ...rest } = influenceParameters(step);
  void radiationTemperatureInKelvin;
  return {
    ...step,
    parameters: {
      ...rest,
      components: preset.components.map((component) => ({
        species: component.species,
        numberDensityPerCubicMeter: component.numberDensityPerCubicMeter,
      })),
      temperatureInKelvin: preset.temperatureInKelvin,
      pressureInPascals: preset.pressureInPascals,
      ...(preset.radiationTemperatureInKelvin === null
        ? {}
        : { radiationTemperatureInKelvin: preset.radiationTemperatureInKelvin }),
    },
  };
}

export function environmentPresetOf(
  step: InfluenceStep,
  presets: readonly EnvironmentPreset[],
): EnvironmentPreset | undefined {
  const current = presetSignature(influenceParameters(step));
  return presets.find(
    (preset) => presetSignature(applyEnvironmentPreset(step, preset).parameters ?? {}) === current,
  );
}

const PARAMETER_REFERENCE = /\{\{([A-Za-z][A-Za-z0-9]*)\}\}/g;

export function parameterUsage(plan: ExperimentPlan): ReadonlyMap<string, readonly number[]> {
  const usage = new Map<string, number[]>();
  plan.steps.forEach((step, index) => {
    const names = new Set(
      [...JSON.stringify(step).matchAll(PARAMETER_REFERENCE)].map((match) => match[1] ?? ''),
    );
    names.forEach((name) => usage.set(name, [...(usage.get(name) ?? []), index]));
  });
  return usage;
}

const VECTOR_COMPONENT = /^([xyz])([A-Z]\w*)$/;

export interface VectorParameterGroup {
  readonly suffix: string;
  readonly specs: readonly InfluenceParameterSpec[];
}

export interface InfluenceParameterGroups {
  readonly lists: readonly InfluenceParameterSpec[];
  readonly vectors: readonly VectorParameterGroup[];
  readonly scalars: readonly InfluenceParameterSpec[];
}

export function groupInfluenceParameters(
  specs: readonly InfluenceParameterSpec[],
): InfluenceParameterGroups {
  const suffixOf = (spec: InfluenceParameterSpec): string | null => {
    const match = VECTOR_COMPONENT.exec(spec.name);
    if (match === null) {
      return null;
    }
    const suffix = match[2] ?? '';
    return ['x', 'y', 'z'].every((axis) => specs.some((other) => other.name === `${axis}${suffix}`))
      ? suffix
      : null;
  };
  const suffixes = [...new Set(specs.map(suffixOf).filter((suffix) => suffix !== null))];
  return {
    lists: specs.filter((spec) => spec.kind === 'list'),
    vectors: suffixes.map((suffix) => ({
      suffix,
      specs: specs.filter((spec) => suffixOf(spec) === suffix),
    })),
    scalars: specs.filter((spec) => spec.kind !== 'list' && suffixOf(spec) === null),
  };
}
