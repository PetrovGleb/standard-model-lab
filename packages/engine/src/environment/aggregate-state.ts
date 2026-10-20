/* Aggregate state of a substance at a temperature and pressure: a charged species or a bare nucleus is plasma, an atom within a tenth of kT of ionization is plasma, an element with allotropes
   follows its phase diagram, a substance with NIST or CRC data follows its critical point, melting point and a Clausius–Clapeyron vapour curve (Guldberg and Trouton rules without a critical
   point; decomposed above its decomposition point), an untabulated organic molecule takes Joback–Reid group contributions and anything else the UFF Lennard-Jones well, marked estimated. */
import {
  AVOGADRO_CONSTANT,
  BOLTZMANN_CONSTANT,
  BOLTZMANN_CONSTANT_IN_EV_PER_KELVIN,
  ALLOTROPE_NAMES,
  MATTER_DATA,
  MOLAR_GAS_CONSTANT,
  criticalData,
  elementAllotropes,
  hasFormalCharges,
  matterIdentity,
  moleculeCharge,
  moleculeStructureOf,
  elementSymbol,
  phasePoints,
  type ElementAllotropes,
  type MeltingPoint,
  type SubstanceCriticalData,
  type SubstancePhasePoints,
} from '@standard-model/constants';
import {
  localizedText,
  type LocalizedText,
  type MediumAspect,
  type ParticleName,
  type Phase,
  type PhaseEstimateMethod,
} from '@standard-model/contracts';
import { bindingEnergyInEv } from '../collisions/atomic-processes.js';
import { isNuclearSpecies } from '../collisions/nuclear-reactions.js';
import { solventOf } from '../molecules/solution-chemistry.js';
import { isStronglyInteracting, mediumIsDeconfined } from '../particles/deconfinement.js';
import { groupContributionEstimate } from './group-contribution.js';

const STANDARD_ATMOSPHERE_IN_PASCALS = 101325;
const PLASMA_THERMAL_FRACTION_OF_IONIZATION = 0.1;
const LENNARD_JONES_CRITICAL_TEMPERATURE = 1.31;
const LENNARD_JONES_TRIPLE_TEMPERATURE = 0.69;
const LENNARD_JONES_CRITICAL_PRESSURE = 0.13;
const LENNARD_JONES_VAPORIZATION_HEAT = 7;
const SIXTH_ROOT_OF_TWO = 2 ** (1 / 6);
const JOULES_PER_KILOCALORIE = 4184;
const METERS_PER_ANGSTROM = 1e-10;
const GULDBERG_CRITICAL_TO_BOILING_RATIO = 3 / 2;
const TROUTON_VAPORIZATION_ENTROPY_IN_JOULES_PER_MOLE_KELVIN = 88;

export interface PhaseVerdict {
  readonly phase: Phase;
  readonly estimated: boolean;
  readonly estimateMethod?: PhaseEstimateMethod;
  readonly allotrope?: string;
}

interface PhaseCurve {
  readonly criticalTemperatureInKelvin: number;
  readonly criticalPressureInPascals: number;
  readonly meltingTemperatureInKelvin: number | null;
  readonly vaporSlope: number;
}

type CurvePoints = Pick<
  SubstanceCriticalData,
  | 'criticalTemperatureInKelvin'
  | 'criticalPressureInPascals'
  | 'boilingTemperatureInKelvin'
  | 'meltingTemperatureInKelvin'
>;

function curveFromTable(data: CurvePoints): PhaseCurve {
  return {
    criticalTemperatureInKelvin: data.criticalTemperatureInKelvin,
    criticalPressureInPascals: data.criticalPressureInPascals,
    meltingTemperatureInKelvin: data.meltingTemperatureInKelvin,
    vaporSlope:
      Math.log(STANDARD_ATMOSPHERE_IN_PASCALS / data.criticalPressureInPascals) /
      (1 - data.criticalTemperatureInKelvin / data.boilingTemperatureInKelvin),
  };
}

function curveFromBoilingPoint(
  boilingTemperatureInKelvin: number,
  meltingTemperatureInKelvin: number | null,
): PhaseCurve {
  const vaporizationEntropy =
    TROUTON_VAPORIZATION_ENTROPY_IN_JOULES_PER_MOLE_KELVIN / MOLAR_GAS_CONSTANT.value;
  return {
    criticalTemperatureInKelvin: GULDBERG_CRITICAL_TO_BOILING_RATIO * boilingTemperatureInKelvin,
    criticalPressureInPascals:
      STANDARD_ATMOSPHERE_IN_PASCALS *
      Math.exp(vaporizationEntropy * (1 - 1 / GULDBERG_CRITICAL_TO_BOILING_RATIO)),
    meltingTemperatureInKelvin,
    vaporSlope: vaporizationEntropy / GULDBERG_CRITICAL_TO_BOILING_RATIO,
  };
}

function phaseFromPoints(
  points: SubstancePhasePoints,
  temperatureInKelvin: number,
  pressureInPascals: number,
): Phase {
  if (
    points.decompositionTemperatureInKelvin !== null &&
    temperatureInKelvin >= points.decompositionTemperatureInKelvin
  ) {
    return 'decomposed';
  }
  if (points.boilingTemperatureInKelvin === null) {
    return points.meltingTemperatureInKelvin !== null &&
      temperatureInKelvin >= points.meltingTemperatureInKelvin
      ? 'liquid'
      : 'solid';
  }
  return phaseOnCurve(
    curveFromBoilingPoint(points.boilingTemperatureInKelvin, points.meltingTemperatureInKelvin),
    temperatureInKelvin,
    pressureInPascals,
  );
}

function heaviestElement(name: ParticleName): number | null {
  if (name.startsWith('molecule:')) {
    return Math.max(...moleculeStructureOf(name).atoms.map((atom) => atom.protons));
  }
  const identity = matterIdentity(name);
  return identity !== null && identity.kind === 'atom' ? identity.protons : null;
}

function uffTypeOf(protons: number) {
  const symbol = elementSymbol(protons);
  return MATTER_DATA.uffAtomTypes.find(
    (candidate) => candidate.atomType.replace(/[_\d].*$/, '').replace(/\+.*$/, '') === symbol,
  );
}

export function lennardJonesDiameterInMeters(name: ParticleName): number | null {
  const protons = heaviestElement(name);
  const type = protons === null ? undefined : uffTypeOf(protons);
  return type === undefined
    ? null
    : (type.nonbondDistanceInAngstrom * METERS_PER_ANGSTROM) / SIXTH_ROOT_OF_TWO;
}

function curveFromLennardJones(protons: number): PhaseCurve | null {
  const type = uffTypeOf(protons);
  if (type === undefined) {
    return null;
  }
  const wellInJoules =
    (type.nonbondEnergyInKcalPerMole * JOULES_PER_KILOCALORIE) / AVOGADRO_CONSTANT.value;
  const diameterInMeters =
    (type.nonbondDistanceInAngstrom * METERS_PER_ANGSTROM) / SIXTH_ROOT_OF_TWO;
  const criticalTemperatureInKelvin =
    (LENNARD_JONES_CRITICAL_TEMPERATURE * wellInJoules) / BOLTZMANN_CONSTANT.value;
  return {
    criticalTemperatureInKelvin,
    criticalPressureInPascals:
      (LENNARD_JONES_CRITICAL_PRESSURE * wellInJoules) / diameterInMeters ** 3,
    meltingTemperatureInKelvin:
      (LENNARD_JONES_TRIPLE_TEMPERATURE * wellInJoules) / BOLTZMANN_CONSTANT.value,
    vaporSlope: LENNARD_JONES_VAPORIZATION_HEAT / LENNARD_JONES_CRITICAL_TEMPERATURE,
  };
}

function vaporPressureInPascals(curve: PhaseCurve, temperatureInKelvin: number): number {
  return (
    curve.criticalPressureInPascals *
    Math.exp(curve.vaporSlope * (1 - curve.criticalTemperatureInKelvin / temperatureInKelvin))
  );
}

function phaseOnCurve(
  curve: PhaseCurve,
  temperatureInKelvin: number,
  pressureInPascals: number,
): Phase {
  if (temperatureInKelvin >= curve.criticalTemperatureInKelvin) {
    return pressureInPascals >= curve.criticalPressureInPascals ? 'supercritical' : 'gas';
  }
  const condensed = pressureInPascals >= vaporPressureInPascals(curve, temperatureInKelvin);
  if (!condensed) {
    return 'gas';
  }
  return curve.meltingTemperatureInKelvin !== null &&
    temperatureInKelvin < curve.meltingTemperatureInKelvin
    ? 'solid'
    : 'liquid';
}

function isNeutralMatter(name: ParticleName): boolean {
  if (name.startsWith('molecule:')) {
    return moleculeCharge(moleculeStructureOf(name)) === 0;
  }
  const identity = matterIdentity(name);
  return identity !== null && identity.kind === 'atom' && identity.charge === 0;
}

function meltingTemperatureInKelvin(
  curve: readonly MeltingPoint[],
  pressureInPascals: number,
): number {
  const first = curve[0];
  const last = curve[curve.length - 1];
  if (first === undefined || last === undefined) {
    return Number.POSITIVE_INFINITY;
  }
  if (pressureInPascals <= first.pressureInPascals) {
    return first.temperatureInKelvin;
  }
  const upper = curve.findIndex((point) => point.pressureInPascals >= pressureInPascals);
  const high = curve[upper];
  const low = curve[upper - 1];
  if (high === undefined || low === undefined) {
    const before = curve[curve.length - 2] ?? first;
    return (
      last.temperatureInKelvin +
      ((pressureInPascals - last.pressureInPascals) *
        (last.temperatureInKelvin - before.temperatureInKelvin)) /
        (last.pressureInPascals - before.pressureInPascals)
    );
  }
  return (
    low.temperatureInKelvin +
    ((pressureInPascals - low.pressureInPascals) *
      (high.temperatureInKelvin - low.temperatureInKelvin)) /
      (high.pressureInPascals - low.pressureInPascals)
  );
}

function allotropeVerdict(
  allotropes: ElementAllotropes,
  temperatureInKelvin: number,
  pressureInPascals: number,
): PhaseVerdict {
  const vaporPressure =
    allotropes.vaporTriplePointPressureInPascals *
    Math.exp(
      (-allotropes.sublimationEnthalpyInJoulesPerMole / MOLAR_GAS_CONSTANT.value) *
        (1 / temperatureInKelvin - 1 / allotropes.vaporTriplePointTemperatureInKelvin),
    );
  if (pressureInPascals < vaporPressure) {
    return { phase: 'gas', estimated: false };
  }
  const boundary =
    allotropes.solidBoundaryInterceptInPascals +
    allotropes.solidBoundarySlopeInPascalsPerKelvin *
      (temperatureInKelvin - allotropes.solidBoundaryReferenceTemperatureInKelvin);
  const dense = pressureInPascals >= boundary;
  const melting = meltingTemperatureInKelvin(
    dense ? allotropes.highPressureMelting : allotropes.lowPressureMelting,
    pressureInPascals,
  );
  if (temperatureInKelvin >= melting) {
    return { phase: 'liquid', estimated: false };
  }
  return {
    phase: 'solid',
    estimated: false,
    allotrope: (dense ? allotropes.highPressureSolid : allotropes.lowPressureSolid).key,
  };
}

export function aggregateState(
  species: ParticleName,
  temperatureInKelvin: number,
  pressureInPascals: number,
): PhaseVerdict {
  if (!isNeutralMatter(species)) {
    return { phase: 'plasma', estimated: false };
  }
  if (
    !species.startsWith('molecule:') &&
    BOLTZMANN_CONSTANT_IN_EV_PER_KELVIN.value * temperatureInKelvin >=
      PLASMA_THERMAL_FRACTION_OF_IONIZATION * bindingEnergyInEv(species)
  ) {
    return { phase: 'plasma', estimated: false };
  }
  const identity = matterIdentity(species);
  const allotropes =
    identity !== null && identity.kind === 'atom' ? elementAllotropes(identity.protons) : null;
  if (allotropes !== null) {
    return allotropeVerdict(allotropes, temperatureInKelvin, pressureInPascals);
  }
  const tabulated = criticalData(species);
  if (tabulated !== null) {
    return {
      phase: phaseOnCurve(curveFromTable(tabulated), temperatureInKelvin, pressureInPascals),
      estimated: false,
    };
  }
  const points = phasePoints(species);
  if (points !== null) {
    return {
      phase: phaseFromPoints(points, temperatureInKelvin, pressureInPascals),
      estimated: false,
    };
  }
  const groups = species.startsWith('molecule:')
    ? groupContributionEstimate(moleculeStructureOf(species))
    : null;
  if (groups !== null) {
    return {
      phase: phaseOnCurve(curveFromTable(groups), temperatureInKelvin, pressureInPascals),
      estimated: true,
      estimateMethod: 'groupContribution',
    };
  }
  const protons = heaviestElement(species);
  const estimated = protons === null ? null : curveFromLennardJones(protons);
  return {
    phase:
      estimated === null ? 'gas' : phaseOnCurve(estimated, temperatureInKelvin, pressureInPascals),
    estimated: true,
    estimateMethod: 'lennardJones',
  };
}

export function idealGasPressureInPascals(
  components: readonly { readonly numberDensityPerCubicMeter: number }[],
  temperatureInKelvin: number,
): number {
  return (
    components.reduce((sum, component) => sum + component.numberDensityPerCubicMeter, 0) *
    BOLTZMANN_CONSTANT.value *
    temperatureInKelvin
  );
}

export const PHASE_NAMES: Readonly<Record<Phase, LocalizedText>> = {
  solid: localizedText('твердое тело', 'solid'),
  liquid: localizedText('жидкость', 'liquid'),
  gas: localizedText('газ', 'gas'),
  supercritical: localizedText('сверхкритический флюид', 'supercritical fluid'),
  plasma: localizedText('плазма', 'plasma'),
  solvated: localizedText('в растворе', 'in solution'),
  quarkGluonPlasma: localizedText('кварк-глюонная плазма', 'quark–gluon plasma'),
  decomposed: localizedText('разложилось', 'decomposed'),
};

export const PHASE_ESTIMATE_NAMES: Readonly<Record<PhaseEstimateMethod, LocalizedText>> = {
  groupContribution: localizedText(
    'оценка по групповым вкладам Джобака и Рида',
    'Joback–Reid group-contribution estimate',
  ),
  lennardJones: localizedText(
    'оценка по соответственным состояниям Леннард-Джонса',
    'corresponding-states estimate from Lennard-Jones',
  ),
};

export function phaseText(verdict: PhaseVerdict): LocalizedText {
  const allotrope = ALLOTROPE_NAMES.find((name) => name.key === verdict.allotrope);
  return allotrope === undefined
    ? PHASE_NAMES[verdict.phase]
    : localizedText(
        `${PHASE_NAMES[verdict.phase].ru}, ${allotrope.ru}`,
        `${PHASE_NAMES[verdict.phase].en}, ${allotrope.en}`,
      );
}

export function hasAggregateState(name: ParticleName): boolean {
  return name.startsWith('molecule:') || matterIdentity(name) !== null || isNuclearSpecies(name);
}

export function mediumPhase(name: ParticleName, medium: MediumAspect): PhaseVerdict {
  if (mediumIsDeconfined(medium) && isStronglyInteracting(name)) {
    return { phase: 'quarkGluonPlasma', estimated: false };
  }
  const identity = matterIdentity(name);
  const ionic =
    (identity !== null && identity.kind === 'atom' && identity.charge !== 0) ||
    hasFormalCharges(name);
  if (ionic && solventOf(medium) !== null) {
    return { phase: 'solvated', estimated: false };
  }
  return aggregateState(
    name,
    medium.temperatureInKelvin,
    medium.pressureInPascals ??
      idealGasPressureInPascals(medium.components, medium.temperatureInKelvin),
  );
}
