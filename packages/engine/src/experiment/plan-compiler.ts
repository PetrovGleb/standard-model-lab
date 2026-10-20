/* Plan compiler: validates a plan with ajv, merges parameters, substitutes {{placeholders}}, unfolds groups (a create step with a count makes label1…labelN, a group label in targets means its members) and checks labels and records statically. */
import {
  MATTER_DATA,
  coolingTransitionOf,
  elementSymbol,
  matterIdentity,
  particleSpec,
} from '@standard-model/constants';
import { partonStructureOf } from '../collisions/parton-distributions.js';
import { matterStepName, matterStepProblem } from './matter-steps.js';
import { heavyConstituents } from '../decay/spectator.js';
import { directionalObservableOf, observableNamesForSpec } from '../particles/capabilities.js';
import { compositeFor } from '../particles/combinations.js';
import { HADRONIZATION_TIME_IN_SECONDS } from '../particles/hadronization.js';
import { validateSpace, type ResolvedSpace } from '../space/space-lab.js';
import {
  LocalizedError,
  MAXIMUM_GROUP_SIZE,
  describePlanErrors,
  groupMemberLabels,
  localizedText,
  validateExperimentPlan,
  type ExperimentPlan,
  type LocalizedText,
  type ExperimentStep,
  type ParameterDefinitions,
  type ParameterReference,
  type ParticleName,
  type ReportSpec,
} from '@standard-model/contracts';

export type Resolved<T> = T extends ParameterReference
  ? number
  : T extends readonly (infer Item)[]
    ? readonly Resolved<Item>[]
    : T extends object
      ? { readonly [Key in keyof T]: Resolved<T[Key]> }
      : T;

const ENTANGLED_PAIR_DIMENSION = 4;

export type CompiledStep = Resolved<ExperimentStep> & { readonly members?: readonly string[] };

export interface CompiledPlan {
  readonly space: ResolvedSpace | null;
  readonly name: string;
  readonly shots: number;
  readonly seed: number;
  readonly parameters: ParameterDefinitions;
  readonly steps: readonly CompiledStep[];
  readonly report: readonly ReportSpec[];
}

export interface CompileOptions {
  readonly parameters?: Partial<ParameterDefinitions>;
  readonly shots?: number;
  readonly seed?: number;
}

function compilationText(message: LocalizedText | string, stepIndex: number | null): LocalizedText {
  const text = typeof message === 'string' ? localizedText(message, message) : message;
  return stepIndex === null
    ? text
    : localizedText(
        `шаг ${String(stepIndex)}: ${text.ru}`,
        `step ${String(stepIndex)}: ${text.en}`,
      );
}

export class PlanCompilationError extends LocalizedError {
  constructor(
    message: LocalizedText | string,
    readonly stepIndex: number | null = null,
  ) {
    super(compilationText(message, stepIndex));
    this.name = 'PlanCompilationError';
  }
}

const PLACEHOLDER = /^\{\{([A-Za-z][A-Za-z0-9]*)\}\}$/;
const DEFAULT_SEED = 1;
const PRODUCT_LABEL = /^(.+)\.(\d+)$/;
const COLLISION_NUMERIC_SUFFIX =
  /^(sqrtSInGev|crossSectionInNanobarns|cosThetaStar|product\[\d+\]\.(energyInGev|kineticEnergyInKev)|firstMomentumFraction|secondMomentumFraction|hardEnergyInGev|transverseMomentumInGev|kineticEnergyInKev|partons)$/;
const COLLIDING_COMPOSITE_FAMILIES = new Set(['nucleus', 'atom']);
const TEMPERATURE_DEPENDENT_INFLUENCES = new Set(['cool', 'heat', 'thermalize']);
const TEMPERATURE_CHANGES = new Set(['cool', 'heat']);
const SPIN_INFLUENCES = new Set(['rotateSpin', 'randomize', 'thermalize']);
const POSITION_SUFFIX = /^(x|y|z|r)$/;
const SYSTEM_SUFFIX =
  /^(particleCount|chargedCount|hadronCount|photonCount|hadronic|heaviest|heaviestMassNumber|phase|allotrope|pH|count\.[^.]+|[A-Za-z][A-Za-z0-9]*\.[A-Za-z]+)$/;
const DECAY_NUMERIC_SUFFIX =
  /^(properTimeInSeconds|labTimeInSeconds|decayLengthInMeters|product\[\d+\]\.energyInGev)$/;
export const DECAY_NUMERIC_FIELDS = [
  'properTimeInSeconds',
  'labTimeInSeconds',
  'decayLengthInMeters',
  'product[0].energyInGev',
  'product[1].energyInGev',
  'product[2].energyInGev',
] as const;

function substitute(value: unknown, parameters: ParameterDefinitions, stepIndex: number): unknown {
  if (typeof value === 'string') {
    const match = PLACEHOLDER.exec(value);
    if (match === null) {
      return value;
    }
    const name = match[1] ?? '';
    const resolved = parameters[name];
    if (resolved === undefined) {
      throw new PlanCompilationError(
        localizedText(`неизвестный параметр {{${name}}}`, `unknown parameter {{${name}}}`),
        stepIndex,
      );
    }
    return resolved;
  }
  if (Array.isArray(value)) {
    return value.map((item) => substitute(item, parameters, stepIndex));
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, substitute(item, parameters, stepIndex)]),
    );
  }
  return value;
}

function mergeParameters(
  plan: ExperimentPlan,
  overrides: Partial<ParameterDefinitions>,
): ParameterDefinitions {
  const unknown = Object.keys(overrides).filter((key) => !(key in plan.parameters));
  if (unknown.length > 0) {
    throw new PlanCompilationError(
      localizedText(
        `неизвестные параметры: ${unknown.join(', ')}`,
        `unknown parameters: ${unknown.join(', ')}`,
      ),
    );
  }
  const merged: Record<string, number> = { ...plan.parameters };
  Object.entries(overrides).forEach(([key, value]) => {
    if (typeof value === 'number') {
      merged[key] = value;
    }
  });
  return merged;
}

function checkReferences(
  steps: readonly CompiledStep[],
  report: readonly ReportSpec[],
  hasSpace: boolean,
  groups: ReadonlyMap<string, readonly string[]>,
): void {
  const labels = new Set<string>();
  const createdParticles = new Map<string, ParticleName>();
  const decayedLabels = new Set<string>();
  const records = new Set<string>();
  const decayRecords = new Set<string>();
  const numericOnlyRecords = new Set<string>();
  const derivedFields = new Map<string, RegExp>();
  const placed = new Set<string>();
  const requireSpace = (stepIndex: number): void => {
    if (!hasSpace) {
      throw new PlanCompilationError(
        localizedText(
          'этому шагу нужно пространство: добавьте куб с сеткой, размером ячейки и потенциалом',
          'this step needs a space: add the space block with grid, cell size and potential',
        ),
        stepIndex,
      );
    }
  };
  const consumed = new Map<string, string>();
  let temperatureSet = false;
  let mediumSet = false;
  const atRest = new Set<string>();
  const confine = (durationInSeconds: number, stepIndex: number): void => {
    if (!(durationInSeconds >= HADRONIZATION_TIME_IN_SECONDS)) {
      return;
    }
    let free = [...createdParticles.entries()]
      .filter(
        ([label, particle]) =>
          !consumed.has(label) &&
          particleSpec(particle).colorRepresentation !== 'singlet' &&
          particleSpec(particle).constituents === null,
      )
      .map(([label]) => label);
    for (;;) {
      const triple = free.flatMap((first, firstIndex) =>
        free.slice(firstIndex + 1).flatMap((second, secondIndex) =>
          free
            .slice(firstIndex + secondIndex + 2)
            .map((third) => [first, second, third])
            .filter(
              (candidate) =>
                compositeFor(
                  candidate.map((label) => createdParticles.get(label) as ParticleName),
                ) !== null,
            ),
        ),
      )[0];
      if (triple === undefined) {
        break;
      }
      const composite = compositeFor(
        triple.map((label) => createdParticles.get(label) as ParticleName),
      );
      if (composite === null) {
        break;
      }
      let ordinal = 1;
      const nameFor = (): string => (ordinal === 1 ? composite : `${composite}${String(ordinal)}`);
      while (labels.has(nameFor())) {
        ordinal += 1;
      }
      const hadron = nameFor();
      labels.add(hadron);
      createdParticles.set(hadron, composite);
      triple.forEach((label) =>
        consumed.set(
          label,
          `it was bound into ${hadron} by confinement at step ${String(stepIndex)}`,
        ),
      );
      free = free.filter((label) => !triple.includes(label));
    }
    free.forEach((label) =>
      consumed.set(label, `it hadronized into mesons at step ${String(stepIndex)}`),
    );
  };
  const requireLabel = (label: string, stepIndex: number): void => {
    const consumedBy = consumed.get(label);
    if (consumedBy !== undefined) {
      throw new PlanCompilationError(
        localizedText(
          `${label} больше не существует: ${consumedBy}`,
          `${label} no longer exists: ${consumedBy}`,
        ),
        stepIndex,
      );
    }
    const productMatch = PRODUCT_LABEL.exec(label);
    if (labels.has(label) || (productMatch !== null && decayedLabels.has(productMatch[1] ?? ''))) {
      return;
    }
    const members = groups.get(label);
    if (members !== undefined) {
      throw new PlanCompilationError(
        localizedText(
          `${label} — группа из ${String(members.length)} частиц, а этому шагу нужна одна: возьмите ${members[0] ?? label} … ${members[members.length - 1] ?? label}`,
          `${label} is a group of ${String(members.length)} particles and this step needs one: take ${members[0] ?? label} … ${members[members.length - 1] ?? label}`,
        ),
        stepIndex,
      );
    }
    throw new PlanCompilationError(
      localizedText(`неизвестная метка частицы ${label}`, `unknown particle label ${label}`),
      stepIndex,
    );
  };
  const requireFreshLabels = (members: readonly string[], stepIndex: number): void => {
    const repeated = members.find((member) => labels.has(member) || groups.has(member));
    if (repeated !== undefined) {
      throw new PlanCompilationError(
        localizedText(
          `метка частицы ${repeated} повторяется`,
          `duplicate particle label ${repeated}`,
        ),
        stepIndex,
      );
    }
  };
  const addRecord = (record: string, stepIndex: number): void => {
    if (records.has(record)) {
      throw new PlanCompilationError(
        localizedText(`запись ${record} повторяется`, `duplicate record ${record}`),
        stepIndex,
      );
    }
    records.add(record);
  };
  steps.forEach((step, stepIndex) => {
    switch (step.operation) {
      case 'create':
        requireFreshLabels(step.members ?? [step.label], stepIndex);
        if (step.spin !== undefined && step.spinDirection !== undefined) {
          throw new PlanCompilationError(
            localizedText(
              'у создания задается spin или spinDirection, но не оба',
              'create takes spin or spinDirection, not both',
            ),
            stepIndex,
          );
        }
        if (
          (step.spin !== undefined || step.spinDirection !== undefined) &&
          directionalObservableOf(particleSpec(step.particle)) === null
        ) {
          throw new PlanCompilationError(
            localizedText(
              `у ${step.particle} спин 0, готовить нечего; уберите настройку спина`,
              `${step.particle} has spin 0, so it has no spin to prepare; remove the spin setting`,
            ),
            stepIndex,
          );
        }
        (step.members ?? [step.label]).forEach((member) => {
          labels.add(member);
          createdParticles.set(member, step.particle);
          if (Object.values(step.momentumInGev ?? {}).every((component) => component === 0)) {
            atRest.add(member);
          }
        });
        break;
      case 'createNucleus':
      case 'createAtom':
      case 'createMolecule': {
        requireFreshLabels(step.members ?? [step.label], stepIndex);
        const problem = matterStepProblem(step);
        if (problem !== null) {
          throw new PlanCompilationError(problem, stepIndex);
        }
        const name = matterStepName(step);
        if (
          step.operation === 'createAtom' &&
          step.spin !== undefined &&
          directionalObservableOf(particleSpec(name)) === null
        ) {
          throw new PlanCompilationError(
            localizedText(
              `у ${particleSpec(name).symbol} в основном уровне J = 0, готовить нечего; уберите настройку спина`,
              `${particleSpec(name).symbol} has J = 0 in its ground level, so it has no spin to prepare; remove the spin setting`,
            ),
            stepIndex,
          );
        }
        (step.members ?? [step.label]).forEach((member) => {
          labels.add(member);
          createdParticles.set(member, name);
          if (Object.values(step.momentumInGev ?? {}).every((component) => component === 0)) {
            atRest.add(member);
          }
        });
        break;
      }
      case 'entangle':
        if (step.targets.length !== 2 || step.targets[0] === step.targets[1]) {
          throw new PlanCompilationError(
            localizedText(
              'для запутывания нужны две разные частицы',
              'entangle needs two different targets',
            ),
            stepIndex,
          );
        }
        step.targets.forEach((target) => requireLabel(target, stepIndex));
        if (
          step.amplitudes !== undefined &&
          (step.amplitudes.real.length !== ENTANGLED_PAIR_DIMENSION ||
            step.amplitudes.imaginary.length !== ENTANGLED_PAIR_DIMENSION ||
            [...step.amplitudes.real, ...step.amplitudes.imaginary].every((value) => value === 0))
        ) {
          throw new PlanCompilationError(
            localizedText(
              `амплитудам запутывания нужны ${String(ENTANGLED_PAIR_DIMENSION)} пар действительных и мнимых частей, не все нулевые`,
              `entangle amplitudes need ${String(ENTANGLED_PAIR_DIMENSION)} real and imaginary parts, not all zero`,
            ),
            stepIndex,
          );
        }
        break;
      case 'influence':
      case 'evolve':
        step.targets?.forEach((target) => requireLabel(target, stepIndex));
        if (step.operation === 'influence') {
          if (step.influence === 'boost') {
            step.targets?.forEach((target) => atRest.delete(target));
          }
          const spinless = step.targets?.find((target) => {
            const particle = createdParticles.get(target);
            return (
              particle !== undefined && directionalObservableOf(particleSpec(particle)) === null
            );
          });
          if (SPIN_INFLUENCES.has(step.influence) && spinless !== undefined) {
            throw new PlanCompilationError(
              localizedText(
                `у ${spinless} спин 0, ${step.influence} не на что действовать: нет ни спина, ни поляризации`,
                `${spinless} has spin 0, so ${step.influence} has no spin or polarization to act on`,
              ),
              stepIndex,
            );
          }
          const resting = step.targets?.find((target) => atRest.has(target));
          if (step.influence === 'travel' && resting !== undefined) {
            throw new PlanCompilationError(
              localizedText(
                `${resting} покоится и не может пролететь расстояние: задайте импульс при создании или сначала сделайте буст`,
                `${resting} is at rest and cannot travel: give it momentum in create or boost it first`,
              ),
              stepIndex,
            );
          }
          const uncoolable = step.targets?.find((target) => {
            const particle = createdParticles.get(target);
            const identity = particle === undefined ? null : matterIdentity(particle);
            return (
              particle !== undefined &&
              (identity === null ||
                identity.kind !== 'atom' ||
                coolingTransitionOf(identity.protons, identity.charge) === null)
            );
          });
          if (step.influence === 'laserCool' && uncoolable !== undefined) {
            throw new PlanCompilationError(
              localizedText(
                `${uncoolable} нельзя охладить лазером: доплеровскому охлаждению нужен атом или ион с замкнутым переходом из NIST (${MATTER_DATA.coolingTransitions.map((transition) => `${elementSymbol(transition.protons)}${transition.charge === 0 ? '' : '+'}`).join(', ')})`,
                `${uncoolable} cannot be laser-cooled: Doppler cooling needs an atom or ion with a closed NIST transition (${MATTER_DATA.coolingTransitions.map((transition) => `${elementSymbol(transition.protons)}${transition.charge === 0 ? '' : '+'}`).join(', ')})`,
              ),
              stepIndex,
            );
          }
          const changesTemperature = TEMPERATURE_CHANGES.has(step.influence);
          if (step.influence === 'setTemperature') {
            temperatureSet = true;
          } else if (step.influence === 'setMedium') {
            mediumSet = true;
          } else if (
            TEMPERATURE_DEPENDENT_INFLUENCES.has(step.influence) &&
            !temperatureSet &&
            !(changesTemperature && mediumSet)
          ) {
            throw new PlanCompilationError(
              localizedText(
                `${step.influence} нужна температура: добавьте перед ним воздействие setTemperature${changesTemperature ? ' или setMedium' : ''}`,
                `${step.influence} needs a temperature: add influence setTemperature${changesTemperature ? ' or setMedium' : ''} before it`,
              ),
              stepIndex,
            );
          }
        }
        if (step.operation === 'evolve') {
          confine(Number(step.durationInSeconds), stepIndex);
        }
        break;
      case 'measure': {
        requireLabel(step.target, stepIndex);
        const particle = createdParticles.get(step.target);
        if (particle !== undefined) {
          const available = observableNamesForSpec(particleSpec(particle));
          if (!available.includes(step.observable)) {
            throw new PlanCompilationError(
              localizedText(
                `${step.target} — это ${particle}, у него нет ${step.observable}; есть ${available.length === 0 ? 'никаких измеримых наблюдаемых' : available.join(', ')}`,
                `${step.target} is a ${particle} and has no ${step.observable}; it has ${available.length === 0 ? 'no measurable observable' : available.join(', ')}`,
              ),
              stepIndex,
            );
          }
        }
        addRecord(step.record, stepIndex);
        break;
      }
      case 'combine': {
        step.targets.forEach((target) => requireLabel(target, stepIndex));
        if (labels.has(step.label)) {
          throw new PlanCompilationError(
            localizedText(
              `метка частицы ${step.label} повторяется`,
              `duplicate particle label ${step.label}`,
            ),
            stepIndex,
          );
        }
        const constituents = step.targets.map((target) => createdParticles.get(target));
        if (constituents.every((name): name is ParticleName => name !== undefined)) {
          const composite = compositeFor(constituents);
          if (composite === null) {
            throw new PlanCompilationError(
              localizedText(
                `нет частицы из ${constituents.join(' + ')}; протон это up + up + down, нейтрон up + down + down`,
                `no particle is made of ${constituents.join(' + ')}; proton is up + up + down, neutron is up + down + down`,
              ),
              stepIndex,
            );
          }
          createdParticles.set(step.label, composite);
        }
        step.targets.forEach((target) =>
          consumed.set(target, `it was combined into ${step.label} at step ${String(stepIndex)}`),
        );
        labels.add(step.label);
        break;
      }
      case 'diffract':
        requireLabel(step.target, stepIndex);
        if (step.pathMarker !== undefined) {
          requireLabel(step.pathMarker, stepIndex);
          if (step.pathMarker === step.target) {
            throw new PlanCompilationError(
              localizedText(
                'меткой пути должна быть другая частица, например запутанный холостой фотон',
                'the path marker must be another particle, for example the entangled idler photon',
              ),
              stepIndex,
            );
          }
        }
        addRecord(step.record, stepIndex);
        numericOnlyRecords.add(step.record);
        break;
      case 'collide': {
        if (step.targets.length !== 2 || step.targets[0] === step.targets[1]) {
          throw new PlanCompilationError(
            localizedText(
              'для столкновения нужны две разные частицы',
              'collide needs two different particles',
            ),
            stepIndex,
          );
        }
        step.targets.forEach((target) => requireLabel(target, stepIndex));
        const pair = step.targets.map((target) => createdParticles.get(target));
        const molecule = pair.find((name) => name?.startsWith('molecule:') === true);
        if (molecule !== undefined) {
          throw new PlanCompilationError(
            localizedText(
              `${particleSpec(molecule).symbol} — молекула; молекулы распадаются при облучении и эволюции при температуре, а не при столкновении`,
              `${particleSpec(molecule).symbol} is a molecule; molecules break up through irradiate and evolve at a temperature, not through collide`,
            ),
            stepIndex,
          );
        }
        const composite = pair.find(
          (name) =>
            name !== undefined &&
            particleSpec(name).constituents !== null &&
            !COLLIDING_COMPOSITE_FAMILIES.has(particleSpec(name).family) &&
            partonStructureOf(particleSpec(name)) === null,
        );
        if (composite !== undefined) {
          throw new PlanCompilationError(
            localizedText(
              `нет процесса столкновения для ${pair.join(' + ')}: ${composite} относится к классу ${particleSpec(composite).family}; столкновения поддерживаются для элементарных частиц, нуклонов и антинуклонов, легких ядер и атомов`,
              `no collision process for ${pair.join(' + ')}: ${composite} is a ${particleSpec(composite).family}; collisions cover elementary particles, nucleons and antinucleons, light nuclei and atoms`,
            ),
            stepIndex,
          );
        }
        addRecord(step.record, stepIndex);
        decayRecords.add(step.record);
        decayedLabels.add(step.record);
        derivedFields.set(step.record, COLLISION_NUMERIC_SUFFIX);
        step.targets.forEach((target) =>
          consumed.set(target, `it collided at step ${String(stepIndex)}`),
        );
        break;
      }
      case 'place': {
        requireSpace(stepIndex);
        requireLabel(step.target, stepIndex);
        const particle = createdParticles.get(step.target);
        if (particle !== undefined && particleSpec(particle).massInGev.value <= 0) {
          throw new PlanCompilationError(
            localizedText(
              `${step.target} — безмассовый ${particle}; в куб помещаются только массивные частицы`,
              `${step.target} is a massless ${particle}; only massive particles can be placed in the space`,
            ),
            stepIndex,
          );
        }
        placed.add(step.target);
        break;
      }
      case 'propagate':
        requireSpace(stepIndex);
        if (placed.size === 0) {
          throw new PlanCompilationError(
            localizedText(
              'для эволюции в кубе нужна хотя бы одна частица, помещенная в куб',
              'propagate needs at least one particle placed in the space',
            ),
            stepIndex,
          );
        }
        confine(Number(step.durationInSeconds), stepIndex);
        break;
      case 'measurePosition':
        requireSpace(stepIndex);
        requireLabel(step.target, stepIndex);
        if (!placed.has(step.target)) {
          throw new PlanCompilationError(
            localizedText(
              `${step.target} не помещен в куб; сначала добавьте шаг «В куб»`,
              `${step.target} is not placed in the space; add a place step first`,
            ),
            stepIndex,
          );
        }
        addRecord(step.record, stepIndex);
        derivedFields.set(step.record, POSITION_SUFFIX);
        break;
      case 'measureSystem':
        addRecord(step.record, stepIndex);
        derivedFields.set(step.record, SYSTEM_SUFFIX);
        break;
      case 'decay': {
        requireLabel(step.target, stepIndex);
        const particle = createdParticles.get(step.target);
        if (
          particle !== undefined &&
          particleSpec(particle).decays.length === 0 &&
          heavyConstituents(particleSpec(particle)) === null
        ) {
          throw new PlanCompilationError(
            localizedText(
              `${step.target} — это ${particle}: у него нет каналов распада, распасться он не может`,
              `${step.target} is a ${particle}, which has no decay channels and cannot decay`,
            ),
            stepIndex,
          );
        }
        const record = step.record ?? `${step.target}.decay`;
        addRecord(record, stepIndex);
        decayRecords.add(record);
        decayedLabels.add(step.target);
        derivedFields.set(record, DECAY_NUMERIC_SUFFIX);
        consumed.set(step.target, `it decayed at step ${String(stepIndex)}`);
        break;
      }
    }
  });
  report.forEach((spec) => {
    if (spec.when !== undefined) {
      const condition = spec.when.record;
      const conditionBase = [...derivedFields.keys()].find((base) =>
        condition.startsWith(`${base}.`),
      );
      const isDerivedNumber =
        conditionBase !== undefined &&
        (derivedFields.get(conditionBase)?.test(condition.slice(conditionBase.length + 1)) ??
          false);
      if (!isDerivedNumber && (!records.has(condition) || decayRecords.has(condition))) {
        throw new PlanCompilationError(
          localizedText(
            `условие ссылается на ${spec.when.record}, но это не числовая запись измерения`,
            `the condition refers to ${spec.when.record}, which is not a numeric measurement record`,
          ),
        );
      }
      if (spec.statistic === 'frequency') {
        throw new PlanCompilationError(
          localizedText(
            'условие работает со средним, гистограммой, корреляцией и другими числовыми статистиками, но не с частотой',
            'a condition works with mean, histogram, correlation and the other numeric statistics, not with frequency',
          ),
        );
      }
    }
    spec.records.forEach((record) => {
      const derivedFrom = [...derivedFields.keys()].find((base) => record.startsWith(`${base}.`));
      if (derivedFrom !== undefined) {
        if (!(
          derivedFields.get(derivedFrom)?.test(record.slice(derivedFrom.length + 1)) ?? false
        )) {
          throw new PlanCompilationError(
            localizedText(
              `отчет ссылается на неизвестное поле ${record}`,
              `report refers to unknown field ${record}`,
            ),
          );
        }
        return;
      }
      if (derivedFields.get(record) === POSITION_SUFFIX) {
        throw new PlanCompilationError(
          localizedText(
            `${record} — это положение; в отчет берите ${record}.x, ${record}.y, ${record}.z или ${record}.r`,
            `${record} is a position; report ${record}.x, ${record}.y, ${record}.z or ${record}.r`,
          ),
        );
      }
      if (!records.has(record)) {
        throw new PlanCompilationError(
          localizedText(
            `отчет ссылается на неизвестную запись ${record}`,
            `report refers to unknown record ${record}`,
          ),
        );
      }
      if (numericOnlyRecords.has(record) && spec.statistic === 'frequency') {
        throw new PlanCompilationError(
          localizedText(
            `${record} — положение на экране, непрерывное число; вместо частоты берите histogram, mean или standardDeviation`,
            `${record} is a screen position, a continuous number; use histogram, mean or standardDeviation instead of frequency`,
          ),
        );
      }
      if (decayRecords.has(record) && spec.statistic !== 'frequency') {
        throw new PlanCompilationError(
          localizedText(
            `${spec.statistic} нужно число, а ${record} — канал распада; берите frequency или ${record}.labTimeInSeconds, ${record}.product[0].energyInGev и подобные`,
            `${spec.statistic} needs a number, but ${record} is a decay channel; use frequency, or ${record}.labTimeInSeconds, ${record}.product[0].energyInGev and similar`,
          ),
        );
      }
    });
  });
}

function resolveSpace(
  space: ExperimentPlan['space'],
  parameters: ParameterDefinitions,
): ResolvedSpace | null {
  if (space === undefined) {
    return null;
  }
  const resolved = substitute(space, parameters, -1) as Resolved<
    NonNullable<ExperimentPlan['space']>
  >;
  const result: ResolvedSpace = {
    gridPointsPerAxis: resolved.gridPointsPerAxis,
    cellSizeInMeters: resolved.cellSizeInMeters,
    potential: resolved.potential,
    potentialEnergyInEv: resolved.potentialEnergyInEv ?? 0,
    barrierThicknessInMeters: resolved.barrierThicknessInMeters ?? 0,
    nuclearCharge: resolved.nuclearCharge ?? 1,
    slitSeparationInMeters: resolved.slitSeparationInMeters ?? 0,
    slitWidthInMeters: resolved.slitWidthInMeters ?? 0,
    wellSeparationInMeters: resolved.wellSeparationInMeters ?? 0,
    boxSizeInMeters: resolved.boxSizeInMeters ?? 0,
  };
  try {
    validateSpace(result);
  } catch (error) {
    throw new PlanCompilationError(
      error instanceof LocalizedError
        ? localizedText(`куб: ${error.text.ru}`, `space: ${error.text.en}`)
        : `space: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return result;
}

function withGroups(
  step: CompiledStep,
  stepIndex: number,
  groups: Map<string, readonly string[]>,
): CompiledStep {
  if (
    step.operation === 'create' ||
    step.operation === 'createNucleus' ||
    step.operation === 'createAtom' ||
    step.operation === 'createMolecule'
  ) {
    const count = step.count ?? 1;
    if (!Number.isInteger(count) || count < 1 || count > MAXIMUM_GROUP_SIZE) {
      throw new PlanCompilationError(
        localizedText(
          `количество частиц в шаге создания должно быть целым от 1 до ${String(MAXIMUM_GROUP_SIZE)}`,
          `the particle count of a create step must be an integer from 1 to ${String(MAXIMUM_GROUP_SIZE)}`,
        ),
        stepIndex,
      );
    }
    const members = groupMemberLabels(step.label, count);
    if (count > 1) {
      groups.set(step.label, members);
    }
    return { ...step, members };
  }
  if (
    (step.operation === 'influence' || step.operation === 'evolve') &&
    step.targets !== undefined
  ) {
    return { ...step, targets: step.targets.flatMap((target) => groups.get(target) ?? [target]) };
  }
  return step;
}

export function compilePlan(plan: unknown, options: CompileOptions = {}): CompiledPlan {
  if (!validateExperimentPlan(plan)) {
    throw new PlanCompilationError(
      localizedText(
        `план не прошел проверку схемы: ${describePlanErrors()}`,
        `invalid plan: ${describePlanErrors()}`,
      ),
    );
  }
  const parameters = mergeParameters(plan, options.parameters ?? {});
  const groups = new Map<string, readonly string[]>();
  const steps = plan.steps.map((step, stepIndex) =>
    withGroups(substitute(step, parameters, stepIndex) as CompiledStep, stepIndex, groups),
  );
  const space = resolveSpace(plan.space, parameters);
  checkReferences(steps, plan.report, space !== null, groups);
  return {
    space,
    name: plan.name,
    shots: options.shots ?? plan.shots,
    seed: options.seed ?? plan.seed ?? DEFAULT_SEED,
    parameters,
    steps,
    report: plan.report,
  };
}
