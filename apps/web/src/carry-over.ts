/* Carry-over: turns the last frame of a system report into a new plan with the surviving particles (molecular ions with their formal charges), their momenta, positions, spins,
   entanglement and probability clouds; particles whose create steps match in everything but the label fold into one step with a count, unless entanglement or a cloud names them. */
import { MAXIMUM_GROUP_SIZE, groupMemberLabels } from '@standard-model/contracts';
import type {
  CatalogParticleName,
  ExperimentPlan,
  ExperimentStep,
  ParticleView,
  QuantumSlotView,
  SystemReport,
  Vector3,
} from '@standard-model/contracts';
import { say } from './language';
import { moleculeFromSpecies } from './molecule-edits';

const DEGREES_PER_RADIAN = 180 / Math.PI;
const MINIMUM_CELLS_PER_PACKET_WIDTH = 1.5;
const DEFAULT_SHOTS = 1000;
const DIRECTION_DIGITS = 9;
const UNSAFE_LABEL_CHARACTER = /[^A-Za-z0-9_]/g;
const GROUP_SUFFIX = 'Group';

type CreationStep = Extract<
  ExperimentStep,
  { operation: 'create' | 'createNucleus' | 'createAtom' | 'createMolecule' }
>;

function safeLabel(label: string): string {
  return label.replace(UNSAFE_LABEL_CHARACTER, '_');
}

function isZero(vector: Vector3): boolean {
  return vector.x === 0 && vector.y === 0 && vector.z === 0;
}

function directionOf(bloch: Vector3): { polarAngleDegrees: number; azimuthDegrees: number } {
  const length = Math.hypot(bloch.x, bloch.y, bloch.z);
  const round = (value: number): number => Number(value.toFixed(DIRECTION_DIGITS));
  return {
    polarAngleDegrees: round(
      Math.acos(Math.max(-1, Math.min(1, bloch.z / length))) * DEGREES_PER_RADIAN,
    ),
    azimuthDegrees: round(Math.atan2(bloch.y, bloch.x) * DEGREES_PER_RADIAN),
  };
}

function twoLevelSlot(view: ParticleView): QuantumSlotView | undefined {
  return view.quantum.find((slot) => slot.dimension === 2 && slot.observable !== 'flavor');
}

function matterStep(view: ParticleView): CreationStep | null {
  const [kind = '', ...rest] = view.name.split(':');
  const motion = {
    label: safeLabel(view.label),
    ...(isZero(view.momentumInGev) ? {} : { momentumInGev: view.momentumInGev }),
    ...(isZero(view.positionInFemtometers)
      ? {}
      : { positionInFemtometers: view.positionInFemtometers }),
  };
  const [protons = 0, massNumber = 0, charge = 0] = rest.map(Number);
  if (kind === 'nucleus') {
    return { operation: 'createNucleus', protons, massNumber, ...motion };
  }
  if (kind === 'atom') {
    return { operation: 'createAtom', protons, massNumber, charge, ...motion };
  }
  const molecule = kind === 'molecule' ? moleculeFromSpecies(view.name, () => undefined) : null;
  return molecule === null ? null : { operation: 'createMolecule', ...molecule, ...motion };
}

function createStep(view: ParticleView): CreationStep {
  const matter = matterStep(view);
  if (matter !== null) {
    return matter;
  }
  const slot = twoLevelSlot(view);
  const bloch = slot?.blochVector;
  const pure = slot !== undefined && !slot.entangled && bloch !== null && bloch !== undefined;
  return {
    operation: 'create',
    label: safeLabel(view.label),
    particle: view.name as CatalogParticleName,
    ...(isZero(view.momentumInGev) ? {} : { momentumInGev: view.momentumInGev }),
    ...(isZero(view.positionInFemtometers)
      ? {}
      : { positionInFemtometers: view.positionInFemtometers }),
    ...(pure ? { spinDirection: directionOf(bloch) } : {}),
  };
}

function entangleSteps(alive: readonly ParticleView[]): readonly ExperimentStep[] {
  const labels = new Set(alive.map((view) => view.label));
  const seen = new Set<string>();
  return alive.flatMap((view) => {
    const slot = twoLevelSlot(view);
    const state = slot?.registerState;
    if (
      slot === undefined ||
      state === null ||
      state === undefined ||
      state.slots.length !== 2 ||
      state.closestNamedState === null ||
      !state.slots.every((label) => labels.has(label))
    ) {
      return [];
    }
    const key = state.slots.join('|');
    if (seen.has(key)) {
      return [];
    }
    seen.add(key);
    return [
      {
        operation: 'entangle',
        targets: state.slots.map(safeLabel),
        state: state.closestNamedState,
        amplitudes: { real: state.real, imaginary: state.imaginary },
        observable: slot.observable,
      },
    ];
  });
}

const MATTER_SYMBOL = /^(\d+)([A-Z][a-z]?)/;

export function groupBaseOf(view: ParticleView): string {
  const [kind = '', , , charge = '0'] = view.name.split(':');
  if (!view.name.includes(':')) {
    return safeLabel(view.name);
  }
  if (kind === 'molecule') {
    return safeLabel(`molecule${view.symbol}`);
  }
  const [, massNumber = '', element = ''] = MATTER_SYMBOL.exec(view.symbol) ?? [];
  const ionCharge = Number(charge);
  if (kind === 'nucleus') {
    return `nucleus${element}${massNumber}`;
  }
  return ionCharge === 0
    ? `atom${element}${massNumber}`
    : `ion${element}${massNumber}${ionCharge > 0 ? 'plus' : 'minus'}${String(Math.abs(ionCharge))}`;
}

export interface CarriedStep {
  readonly step: CreationStep;
  readonly base: string;
}

function freeGroupLabel(base: string, count: number, taken: Set<string>): string {
  for (let attempt = 0; ; attempt += 1) {
    const label =
      attempt === 0 ? base : `${base}${GROUP_SUFFIX}${attempt === 1 ? '' : String(attempt)}`;
    const members = groupMemberLabels(label, count);
    if (!taken.has(label) && members.every((member) => !taken.has(member))) {
      [label, ...members].forEach((used) => taken.add(used));
      return label;
    }
  }
}

export function foldIdenticalSteps(
  carried: readonly CarriedStep[],
  pinned: ReadonlySet<string>,
): readonly CreationStep[] {
  const groups = new Map<string, CarriedStep[]>();
  carried.forEach((entry, index) => {
    const key = pinned.has(entry.step.label)
      ? `pinned:${String(index)}`
      : JSON.stringify({ ...entry.step, label: '' });
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  });
  const chunks = [...groups.values()].flatMap((members) =>
    Array.from({ length: Math.ceil(members.length / MAXIMUM_GROUP_SIZE) }, (unused, index) =>
      members.slice(index * MAXIMUM_GROUP_SIZE, (index + 1) * MAXIMUM_GROUP_SIZE),
    ),
  );
  const taken = new Set(
    chunks.flatMap((members) =>
      members.length === 1 ? members.map((entry) => entry.step.label) : [],
    ),
  );
  return chunks.flatMap((members) => {
    const [first] = members;
    if (first === undefined || members.length === 1) {
      return members.map((entry) => entry.step);
    }
    return [
      {
        ...first.step,
        label: freeGroupLabel(first.base, members.length, taken),
        count: members.length,
      },
    ];
  });
}

export function carryOverPlan(report: SystemReport, sourceName: string): ExperimentPlan {
  const last = report.frames[report.frames.length - 1];
  const alive = (last?.particles ?? []).filter((view) => view.status === 'alive');
  const aliveLabels = new Set(alive.map((view) => view.label));
  const space = last?.space ?? null;
  const placements: ExperimentStep[] =
    space === null
      ? []
      : space.clouds
          .filter((cloud) => aliveLabels.has(cloud.label))
          .map((cloud) => ({
            operation: 'place',
            target: safeLabel(cloud.label),
            centerInMeters: cloud.meanPositionInMeters,
            widthInMeters: Math.max(
              (cloud.spreadInMeters.x + cloud.spreadInMeters.y + cloud.spreadInMeters.z) / 3,
              MINIMUM_CELLS_PER_PACKET_WIDTH * space.cellSizeInMeters,
            ),
            shape: 'gaussian',
          }));
  const entanglements = entangleSteps(alive);
  const pinned = new Set(
    [...entanglements, ...placements].flatMap((step) =>
      step.operation === 'entangle'
        ? step.targets
        : step.operation === 'place'
          ? [step.target]
          : [],
    ),
  );
  return {
    name: `${sourceName}Next`,
    description: say(
      `Продолжение «${sourceName}»: ${String(alive.length)} частиц из последнего кадра выстрела с seed ${String(report.seed)}. Перенесены импульсы, положения, спины, запутанность с точными амплитудами и облака как гауссовы пакеты с тем же центром и шириной. Одинаковые частицы собраны в группы со счётчиком. Окружение и фаза аромата нейтрино не переносятся.`,
      `Continuation of “${sourceName}”: ${String(alive.length)} particles from the last frame of the shot with seed ${String(report.seed)}. Momenta, positions, spins, entanglement with exact amplitudes and clouds as Gaussian packets of the same center and width are carried over. Identical particles are folded into groups with a count. The environment and the neutrino flavor phase are not.`,
    ),
    parameters: {},
    shots: DEFAULT_SHOTS,
    seed: report.seed,
    ...(space === null
      ? {}
      : {
          space: {
            gridPointsPerAxis: space.gridPointsPerAxis,
            cellSizeInMeters: space.cellSizeInMeters,
            potential: space.potential,
            potentialEnergyInEv: space.potentialEnergyInEv,
            barrierThicknessInMeters: space.barrierThicknessInMeters,
            nuclearCharge: space.nuclearCharge,
            ...(space.slitSeparationInMeters === undefined
              ? {}
              : { slitSeparationInMeters: space.slitSeparationInMeters }),
            ...(space.slitWidthInMeters === undefined
              ? {}
              : { slitWidthInMeters: space.slitWidthInMeters }),
            ...(space.wellSeparationInMeters === undefined
              ? {}
              : { wellSeparationInMeters: space.wellSeparationInMeters }),
            ...(space.boxSizeInMeters === undefined
              ? {}
              : { boxSizeInMeters: space.boxSizeInMeters }),
          },
        }),
    steps: [
      ...foldIdenticalSteps(
        alive.map((view) => ({ step: createStep(view), base: groupBaseOf(view) })),
        pinned,
      ),
      ...entanglements,
      ...placements,
    ],
    report: [],
  };
}
