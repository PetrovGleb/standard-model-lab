/* SpaceLab: one-particle wavefunctions on an N³ grid, split-operator FFT evolution in free space, a barrier, a wall with two slits, a harmonic trap, a quartic double well, a box or a Coulomb
   centre; Gaussian packets, ground states, the hydrogenic 2s, 2p_z, 3d_z² orbitals, the 1s + 2p_z superposition and a two-packet cat state; Born sampling of position and snapshots;
   only physically valid scales are accepted; the caches depend on the physics alone and are shared by every engine in the process, so traced shots and repeated runs reuse an evolution. */
import {
  ELEMENTARY_CHARGE,
  REDUCED_PLANCK_CONSTANT,
  SPEED_OF_LIGHT_IN_VACUUM,
  VACUUM_ELECTRIC_PERMITTIVITY,
} from '@standard-model/constants';
import type {
  Particle,
  PotentialKind,
  ProbabilityCloud,
  SpaceWalls,
  RandomSource,
  Vector3,
  WavepacketShape,
} from '@standard-model/contracts';
import { EV_PER_GEV, gevToKilograms, vectorMagnitude } from '@standard-model/utils';
import { fft3d } from './fft.js';
import { LocalizedError, localizedText } from '@standard-model/contracts';
import { WALL_LAWS } from './geometry.js';
import { POTENTIAL_LAWS, mirrorWallEnergyInJoules } from './potentials.js';

export interface ResolvedSpace {
  readonly gridPointsPerAxis: number;
  readonly cellSizeInMeters: number;
  readonly potential: PotentialKind;
  readonly potentialEnergyInEv: number;
  readonly barrierThicknessInMeters: number;
  readonly nuclearCharge: number;
  readonly slitSeparationInMeters?: number;
  readonly slitWidthInMeters?: number;
  readonly wellSeparationInMeters?: number;
  readonly boxSizeInMeters?: number;
  readonly walls?: SpaceWalls;
}

export interface SpatialState {
  readonly key: string;
  readonly massInKilograms: number;
  readonly chargeInElementaryUnits: number;
  readonly real: Float64Array;
  readonly imaginary: Float64Array;
}

export const VALID_GRID_SIZES = [32, 64] as const;
const MINIMUM_CELLS_PER_COMPTON_WAVELENGTH = 10;
const MAXIMUM_VELOCITY_FRACTION = 0.1;
const MINIMUM_CELLS_PER_WAVELENGTH = 4;
const MINIMUM_CELLS_PER_PACKET_WIDTH = 1.5;
const ABSORBING_FRACTION = 1 / 8;
const MAXIMUM_STEPS: Readonly<Record<number, number>> = { 32: 4000, 64: 500 };
const CACHE_LIMIT = 12;
const SNAPSHOT_RESOLUTION = 16;
const QUANTIZATION_LEVELS = 255;
const HBAR = REDUCED_PLANCK_CONSTANT.value;
const JOULES_PER_EV = ELEMENTARY_CHARGE.value;
const COULOMB_CONSTANT = 1 / (4 * Math.PI * VACUUM_ELECTRIC_PERMITTIVITY.value);
const SECOND_SHELL = 2;
const THIRD_SHELL = 3;
const THREE_D_ANGULAR_FACTOR = 3;
const TWO_P_NORM = 32;
const HYDROGEN_SHAPES: ReadonlySet<WavepacketShape> = new Set([
  'hydrogen2s',
  'hydrogen2p',
  'hydrogen3d',
  'hydrogen1s2p',
]);
const TRAPPING_POTENTIALS: ReadonlySet<PotentialKind> = new Set([
  'harmonic',
  'barrier',
  'doubleSlit',
  'doubleWell',
  'box',
]);

export class SpaceValidationError extends LocalizedError {}

function spaceKey(space: ResolvedSpace): string {
  return [
    space.gridPointsPerAxis,
    space.cellSizeInMeters,
    space.potential,
    space.potentialEnergyInEv,
    space.barrierThicknessInMeters,
    space.nuclearCharge,
    space.slitSeparationInMeters ?? 0,
    space.slitWidthInMeters ?? 0,
    space.wellSeparationInMeters ?? 0,
    space.boxSizeInMeters ?? 0,
    space.walls ?? 'open',
  ]
    .map(String)
    .join('|');
}

function coordinate(index: number, space: ResolvedSpace): number {
  return (index - space.gridPointsPerAxis / 2 + 0.5) * space.cellSizeInMeters;
}

function absorbingWidth(space: ResolvedSpace): number {
  return Math.max(2, Math.round(space.gridPointsPerAxis * ABSORBING_FRACTION));
}

function waveNumber(index: number, space: ResolvedSpace): number {
  const size = space.gridPointsPerAxis;
  const shifted = index < size / 2 ? index : index - size;
  return (2 * Math.PI * shifted) / (size * space.cellSizeInMeters);
}

class LimitedCache<T> {
  private readonly entries = new Map<string, T>();

  get(key: string): T | undefined {
    const value = this.entries.get(key);
    if (value !== undefined) {
      this.entries.delete(key);
      this.entries.set(key, value);
    }
    return value;
  }

  set(key: string, value: T): void {
    this.entries.set(key, value);
    if (this.entries.size > CACHE_LIMIT) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) {
        this.entries.delete(oldest);
      }
    }
  }
}

const SHARED_POTENTIALS = new LimitedCache<Float64Array>();
const SHARED_PEAKS = new LimitedCache<number>();
const SHARED_PLACEMENTS = new LimitedCache<SpatialState>();
const SHARED_EVOLUTIONS = new LimitedCache<SpatialState>();
const SHARED_DISTRIBUTIONS = new LimitedCache<Float64Array>();
const SHARED_CLOUDS = new LimitedCache<Omit<ProbabilityCloud, 'label'>>();

export function validateSpace(space: ResolvedSpace): void {
  const {
    slitSeparationInMeters = 0,
    slitWidthInMeters = 0,
    wellSeparationInMeters = 0,
    boxSizeInMeters = 0,
  } = space;
  if (!(VALID_GRID_SIZES as readonly number[]).includes(space.gridPointsPerAxis)) {
    throw new SpaceValidationError(
      localizedText(
        `Сетка куба может быть ${VALID_GRID_SIZES.join(' или ')} ячеек на ребро`,
        `The cube grid can have ${VALID_GRID_SIZES.join(' or ')} cells per edge`,
      ),
    );
  }
  if (!(space.cellSizeInMeters > 0)) {
    throw new SpaceValidationError(
      localizedText('Размер ячейки должен быть положительным', 'The cell size must be positive'),
    );
  }
  if (space.potential === 'barrier' && !(space.barrierThicknessInMeters > 0)) {
    throw new SpaceValidationError(
      localizedText(
        'Для барьера нужна толщина больше нуля',
        'A barrier needs a thickness above zero',
      ),
    );
  }
  if (TRAPPING_POTENTIALS.has(space.potential) && !(space.potentialEnergyInEv > 0)) {
    throw new SpaceValidationError(
      localizedText(
        'Для барьера, щелей, ловушки, двойной ямы и ящика нужна положительная энергия в эВ',
        'A barrier, slits, a trap, a double well or a box needs a positive energy in eV',
      ),
    );
  }
  const halfEdge = (space.gridPointsPerAxis * space.cellSizeInMeters) / 2;
  if (
    space.potential === 'doubleSlit' &&
    !(
      space.barrierThicknessInMeters > 0 &&
      slitWidthInMeters > 0 &&
      slitSeparationInMeters > slitWidthInMeters &&
      slitSeparationInMeters / 2 + slitWidthInMeters / 2 < halfEdge
    )
  ) {
    throw new SpaceValidationError(
      localizedText(
        'Стене с двумя щелями нужны толщина, ширина щели и расстояние между щелями больше ширины, и обе щели внутри куба',
        'A wall with two slits needs a thickness, a slit width and a slit separation above the width, with both slits inside the cube',
      ),
    );
  }
  if (
    space.potential === 'doubleWell' &&
    !(wellSeparationInMeters > 0 && wellSeparationInMeters / 2 < halfEdge)
  ) {
    throw new SpaceValidationError(
      localizedText(
        'Двойной яме нужно расстояние между минимумами больше нуля и внутри куба',
        'A double well needs a separation of its minima above zero and inside the cube',
      ),
    );
  }
  if (space.potential === 'box' && !(boxSizeInMeters > 0 && boxSizeInMeters / 2 < halfEdge)) {
    throw new SpaceValidationError(
      localizedText(
        'Ящику нужен размер больше нуля и меньше ребра куба',
        'A box needs a size above zero and below the cube edge',
      ),
    );
  }
  if (space.potential === 'coulomb' && !(space.nuclearCharge >= 1)) {
    throw new SpaceValidationError(
      localizedText(
        'Заряд ядра для кулоновского центра должен быть не меньше 1',
        'The nuclear charge of a Coulomb center must be at least 1',
      ),
    );
  }
}

export function validateParticleInSpace(space: ResolvedSpace, particle: Particle): void {
  const massInGev = particle.spec.massInGev.value;
  if (massInGev <= 0) {
    throw new SpaceValidationError(
      localizedText(
        `${particle.spec.name} безмассовая: уравнение Шредингера к ней неприменимо, в кубе моделируются только массивные частицы`,
        `${particle.spec.name} is massless: the Schrödinger equation does not apply, the cube models only massive particles`,
      ),
    );
  }
  const reducedCompton = HBAR / (gevToKilograms(massInGev) * SPEED_OF_LIGHT_IN_VACUUM.value);
  if (space.cellSizeInMeters < MINIMUM_CELLS_PER_COMPTON_WAVELENGTH * reducedCompton) {
    throw new SpaceValidationError(
      localizedText(
        `Ячейка ${space.cellSizeInMeters.toExponential(2)} м меньше 10 комптоновских длин ${particle.spec.name} (${(10 * reducedCompton).toExponential(2)} м): на этом масштабе нужна релятивистская теория, увеличьте ячейку`,
        `The cell of ${space.cellSizeInMeters.toExponential(2)} m is below 10 Compton wavelengths of ${particle.spec.name} (${(10 * reducedCompton).toExponential(2)} m): this scale needs a relativistic theory, enlarge the cell`,
      ),
    );
  }
  const momentum = vectorMagnitude(particle.kinematics.fourMomentumInGev.momentum);
  const energy = particle.kinematics.fourMomentumInGev.energy;
  if (momentum / energy > MAXIMUM_VELOCITY_FRACTION) {
    throw new SpaceValidationError(
      localizedText(
        `${particle.spec.name} движется со скоростью ${(momentum / energy).toFixed(2)} c: куб нерелятивистский, нужна скорость меньше 0.1 c`,
        `${particle.spec.name} moves at ${(momentum / energy).toFixed(2)} c: the cube is nonrelativistic and needs a speed below 0.1 c`,
      ),
    );
  }
  if (momentum > 0) {
    const wavelength =
      (2 * Math.PI * HBAR) /
      ((momentum * EV_PER_GEV * JOULES_PER_EV) / SPEED_OF_LIGHT_IN_VACUUM.value);
    if (wavelength < MINIMUM_CELLS_PER_WAVELENGTH * space.cellSizeInMeters) {
      throw new SpaceValidationError(
        localizedText(
          `Длина волны ${particle.spec.name} ${wavelength.toExponential(2)} м короче 4 ячеек: уменьшите ячейку или импульс`,
          `The wavelength of ${particle.spec.name}, ${wavelength.toExponential(2)} m, is shorter than 4 cells: reduce the cell or the momentum`,
        ),
      );
    }
  }
}

export class SpaceLab {
  private readonly potentials = SHARED_POTENTIALS;
  private readonly peaks = SHARED_PEAKS;
  private readonly placements = SHARED_PLACEMENTS;
  private readonly evolutions = SHARED_EVOLUTIONS;
  private readonly distributions = SHARED_DISTRIBUTIONS;
  private readonly clouds = SHARED_CLOUDS;

  constructor(private readonly random: RandomSource) {}

  place(
    space: ResolvedSpace,
    particle: Particle,
    centerInMeters: Vector3,
    widthInMeters: number,
    shape: WavepacketShape,
  ): SpatialState {
    validateSpace(space);
    validateParticleInSpace(space, particle);
    const size = space.gridPointsPerAxis;
    const half = (size / 2) * space.cellSizeInMeters;
    [centerInMeters.x, centerInMeters.y, centerInMeters.z].forEach((value) => {
      if (Math.abs(value) >= half) {
        throw new SpaceValidationError(
          localizedText(
            `Центр пакета ${value.toExponential(2)} м вне куба с полуребром ${half.toExponential(2)} м`,
            `The packet center at ${value.toExponential(2)} m is outside the cube with half-edge ${half.toExponential(2)} m`,
          ),
        );
      }
    });
    const mass = gevToKilograms(particle.spec.massInGev.value);
    const charge = particle.spec.electricChargeInElementaryUnits;
    const momentum = particle.kinematics.fourMomentumInGev.momentum;
    const placementKey = `place|${spaceKey(space)}|${String(mass)}|${String(charge)}|${JSON.stringify(centerInMeters)}|${String(widthInMeters)}|${shape}|${JSON.stringify(momentum)}`;
    const cachedPlacement = this.placements.get(placementKey);
    if (cachedPlacement !== undefined) {
      return cachedPlacement;
    }
    const toWaveNumber = (EV_PER_GEV * JOULES_PER_EV) / SPEED_OF_LIGHT_IN_VACUUM.value / HBAR;
    const wave = {
      x: momentum.x * toWaveNumber,
      y: momentum.y * toWaveNumber,
      z: momentum.z * toWaveNumber,
    };
    if (HYDROGEN_SHAPES.has(shape) && space.potential !== 'coulomb') {
      throw new SpaceValidationError(
        localizedText(
          'Орбитали водорода живут только у кулоновского центра',
          'Hydrogen orbitals exist only around a Coulomb center',
        ),
      );
    }
    const width =
      shape === 'groundState' || HYDROGEN_SHAPES.has(shape)
        ? this.groundStateWidth(space, mass, charge)
        : widthInMeters;
    if (
      (shape === 'gaussian' || shape === 'catState') &&
      width < MINIMUM_CELLS_PER_PACKET_WIDTH * space.cellSizeInMeters
    ) {
      throw new SpaceValidationError(
        localizedText(
          `Ширина пакета должна быть хотя бы 1.5 ячейки (${(1.5 * space.cellSizeInMeters).toExponential(2)} м)`,
          `The packet width must be at least 1.5 cells (${(1.5 * space.cellSizeInMeters).toExponential(2)} m)`,
        ),
      );
    }
    const total = size * size * size;
    const real = new Float64Array(total);
    const imaginary = new Float64Array(total);
    const amplitudeAt = shapeAmplitude(shape, space.potential, width, centerInMeters, wave);
    for (let zIndex = 0; zIndex < size; zIndex += 1) {
      const z = coordinate(zIndex, space);
      for (let yIndex = 0; yIndex < size; yIndex += 1) {
        const y = coordinate(yIndex, space);
        for (let xIndex = 0; xIndex < size; xIndex += 1) {
          const x = coordinate(xIndex, space);
          const index = xIndex + size * (yIndex + size * zIndex);
          const [realPart, imaginaryPart] = amplitudeAt(x, y, z);
          real[index] = realPart;
          imaginary[index] = imaginaryPart;
        }
      }
    }
    normalize(real, imaginary);
    const placed = {
      key: placementKey,
      massInKilograms: mass,
      chargeInElementaryUnits: charge,
      real,
      imaginary,
    };
    this.placements.set(placementKey, placed);
    return placed;
  }

  stepsFor(space: ResolvedSpace, state: SpatialState, durationInSeconds: number): number {
    const kineticLimit =
      (2 * state.massInKilograms * space.cellSizeInMeters ** 2) / (HBAR * Math.PI * Math.PI);
    const potentialPeak = this.potentialPeak(
      space,
      state.massInKilograms,
      state.chargeInElementaryUnits,
    );
    const potentialLimit = potentialPeak > 0 ? HBAR / potentialPeak : Infinity;
    const maximumStep = Math.min(kineticLimit, potentialLimit);
    const steps = Math.max(1, Math.ceil(durationInSeconds / maximumStep));
    const stepLimit = MAXIMUM_STEPS[space.gridPointsPerAxis] ?? 0;
    if (steps > stepLimit) {
      throw new SpaceValidationError(
        localizedText(
          `Эволюция на ${durationInSeconds.toExponential(2)} с требует ${String(steps)} шагов при пределе ${String(stepLimit)}: уменьшите время, возьмите крупнее ячейку или сетку 32³`,
          `Evolving for ${durationInSeconds.toExponential(2)} s needs ${String(steps)} steps with a limit of ${String(stepLimit)}: shorten the time, take a larger cell or the 32³ grid`,
        ),
      );
    }
    return steps;
  }

  overlapDensityPerCubicMeter(
    space: ResolvedSpace,
    first: SpatialState,
    second: SpatialState,
  ): number {
    let sum = 0;
    for (let index = 0; index < first.real.length; index += 1) {
      sum +=
        ((first.real[index] ?? 0) ** 2 + (first.imaginary[index] ?? 0) ** 2) *
        ((second.real[index] ?? 0) ** 2 + (second.imaginary[index] ?? 0) ** 2);
    }
    return sum / space.cellSizeInMeters ** 3;
  }

  propagate(space: ResolvedSpace, state: SpatialState, durationInSeconds: number): SpatialState {
    if (durationInSeconds < 0) {
      throw new SpaceValidationError(
        localizedText(
          'Время эволюции не может быть отрицательным',
          'The evolution time cannot be negative',
        ),
      );
    }
    const key = `${state.key}|propagate|${String(durationInSeconds)}`;
    const cached = this.evolutions.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const size = space.gridPointsPerAxis;
    const potential = this.potential(space, state.massInKilograms, state.chargeInElementaryUnits);
    const steps = this.stepsFor(space, state, durationInSeconds);
    const timeStep = durationInSeconds / steps;
    const real = Float64Array.from(state.real);
    const imaginary = Float64Array.from(state.imaginary);
    const halfPotentialCosine = new Float64Array(potential.length);
    const halfPotentialSine = new Float64Array(potential.length);
    potential.forEach((value, index) => {
      const angle = (-value * timeStep) / (2 * HBAR);
      halfPotentialCosine[index] = Math.cos(angle);
      halfPotentialSine[index] = Math.sin(angle);
    });
    const kineticCosine = new Float64Array(potential.length);
    const kineticSine = new Float64Array(potential.length);
    for (let zIndex = 0; zIndex < size; zIndex += 1) {
      const waveNumberZ = waveNumber(zIndex, space);
      for (let yIndex = 0; yIndex < size; yIndex += 1) {
        const waveNumberY = waveNumber(yIndex, space);
        for (let xIndex = 0; xIndex < size; xIndex += 1) {
          const waveNumberX = waveNumber(xIndex, space);
          const index = xIndex + size * (yIndex + size * zIndex);
          const angle =
            (-HBAR *
              (waveNumberX * waveNumberX + waveNumberY * waveNumberY + waveNumberZ * waveNumberZ) *
              timeStep) /
            (2 * state.massInKilograms);
          kineticCosine[index] = Math.cos(angle);
          kineticSine[index] = Math.sin(angle);
        }
      }
    }
    const mask = WALL_LAWS[space.walls ?? 'open'].reflectsWaves ? null : this.absorbingMask(space);
    for (let step = 0; step < steps; step += 1) {
      rotate(real, imaginary, halfPotentialCosine, halfPotentialSine);
      fft3d(real, imaginary, size, false);
      rotate(real, imaginary, kineticCosine, kineticSine);
      fft3d(real, imaginary, size, true);
      rotate(real, imaginary, halfPotentialCosine, halfPotentialSine);
      for (let index = 0; mask !== null && index < real.length; index += 1) {
        const damping = mask[index] ?? 1;
        real[index] = (real[index] ?? 0) * damping;
        imaginary[index] = (imaginary[index] ?? 0) * damping;
      }
    }
    const evolved = {
      key,
      massInKilograms: state.massInKilograms,
      chargeInElementaryUnits: state.chargeInElementaryUnits,
      real,
      imaginary,
    };
    this.evolutions.set(key, evolved);
    return evolved;
  }

  measure(
    space: ResolvedSpace,
    state: SpatialState,
  ): {
    readonly positionInMeters: Vector3;
    readonly collapsed: SpatialState;
    readonly probabilityInside: number;
  } {
    const size = space.gridPointsPerAxis;
    let cumulative = this.distributions.get(state.key);
    if (cumulative === undefined) {
      cumulative = new Float64Array(state.real.length);
      let running = 0;
      for (let index = 0; index < state.real.length; index += 1) {
        running += (state.real[index] ?? 0) ** 2 + (state.imaginary[index] ?? 0) ** 2;
        cumulative[index] = running;
      }
      this.distributions.set(state.key, cumulative);
    }
    const totalProbability = cumulative[cumulative.length - 1] ?? 0;
    if (totalProbability <= 0) {
      throw new SpaceValidationError(
        localizedText(
          'Частица полностью покинула куб: увеличьте куб или уменьшите время',
          'The particle has left the cube entirely: enlarge the cube or shorten the time',
        ),
      );
    }
    const draw = this.random.nextUnit() * totalProbability;
    let low = 0;
    let high = cumulative.length - 1;
    while (low < high) {
      const middle = (low + high) >> 1;
      if ((cumulative[middle] ?? 0) < draw) {
        low = middle + 1;
      } else {
        high = middle;
      }
    }
    const xIndex = low % size;
    const yIndex = Math.floor(low / size) % size;
    const zIndex = Math.floor(low / (size * size));
    const jitter = (): number => (this.random.nextUnit() - 0.5) * space.cellSizeInMeters;
    const positionInMeters = {
      x: coordinate(xIndex, space) + jitter(),
      y: coordinate(yIndex, space) + jitter(),
      z: coordinate(zIndex, space) + jitter(),
    };
    const real = new Float64Array(state.real.length);
    const imaginary = new Float64Array(state.real.length);
    real[low] = 1;
    return {
      positionInMeters,
      collapsed: {
        key: `collapse|${state.key}|${String(low)}`,
        massInKilograms: state.massInKilograms,
        chargeInElementaryUnits: state.chargeInElementaryUnits,
        real,
        imaginary,
      },
      probabilityInside: totalProbability,
    };
  }

  cloud(space: ResolvedSpace, state: SpatialState, label: string): ProbabilityCloud {
    const cached = this.clouds.get(state.key);
    if (cached !== undefined) {
      return { label, ...cached };
    }
    const size = space.gridPointsPerAxis;
    const block = size / SNAPSHOT_RESOLUTION;
    const density = new Float64Array(SNAPSHOT_RESOLUTION ** 3);
    const projectionXy = new Float64Array(size * size);
    const projectionXz = new Float64Array(size * size);
    const projectionYz = new Float64Array(size * size);
    const mean = { x: 0, y: 0, z: 0 };
    const square = { x: 0, y: 0, z: 0 };
    let total = 0;
    for (let zIndex = 0; zIndex < size; zIndex += 1) {
      const z = coordinate(zIndex, space);
      for (let yIndex = 0; yIndex < size; yIndex += 1) {
        const y = coordinate(yIndex, space);
        for (let xIndex = 0; xIndex < size; xIndex += 1) {
          const x = coordinate(xIndex, space);
          const index = xIndex + size * (yIndex + size * zIndex);
          const probability = (state.real[index] ?? 0) ** 2 + (state.imaginary[index] ?? 0) ** 2;
          total += probability;
          mean.x += probability * x;
          mean.y += probability * y;
          mean.z += probability * z;
          square.x += probability * x * x;
          square.y += probability * y * y;
          square.z += probability * z * z;
          const coarse =
            Math.floor(xIndex / block) +
            SNAPSHOT_RESOLUTION *
              (Math.floor(yIndex / block) + SNAPSHOT_RESOLUTION * Math.floor(zIndex / block));
          density[coarse] = (density[coarse] ?? 0) + probability;
          projectionXy[xIndex + size * yIndex] =
            (projectionXy[xIndex + size * yIndex] ?? 0) + probability;
          projectionXz[xIndex + size * zIndex] =
            (projectionXz[xIndex + size * zIndex] ?? 0) + probability;
          projectionYz[yIndex + size * zIndex] =
            (projectionYz[yIndex + size * zIndex] ?? 0) + probability;
        }
      }
    }
    const normalizer = total > 0 ? total : 1;
    const meanPosition = { x: mean.x / normalizer, y: mean.y / normalizer, z: mean.z / normalizer };
    const spread = {
      x: Math.sqrt(Math.max(square.x / normalizer - meanPosition.x ** 2, 0)),
      y: Math.sqrt(Math.max(square.y / normalizer - meanPosition.y ** 2, 0)),
      z: Math.sqrt(Math.max(square.z / normalizer - meanPosition.z ** 2, 0)),
    };
    const result: Omit<ProbabilityCloud, 'label'> = {
      resolution: SNAPSHOT_RESOLUTION,
      density: quantize(density),
      projectionResolution: size,
      projectionXy: quantize(projectionXy),
      projectionXz: quantize(projectionXz),
      projectionYz: quantize(projectionYz),
      meanPositionInMeters: meanPosition,
      spreadInMeters: spread,
      probabilityInside: Math.min(total, 1),
      energyInEv: this.energy(space, state, normalizer),
    };
    this.clouds.set(state.key, result);
    return { label, ...result };
  }

  private energy(space: ResolvedSpace, state: SpatialState, normalizer: number): number {
    const size = space.gridPointsPerAxis;
    const potential = this.potential(space, state.massInKilograms, state.chargeInElementaryUnits);
    let potentialEnergy = 0;
    for (let index = 0; index < state.real.length; index += 1) {
      potentialEnergy +=
        ((state.real[index] ?? 0) ** 2 + (state.imaginary[index] ?? 0) ** 2) *
        (potential[index] ?? 0);
    }
    const real = Float64Array.from(state.real);
    const imaginary = Float64Array.from(state.imaginary);
    fft3d(real, imaginary, size, false);
    let kinetic = 0;
    let weight = 0;
    for (let zIndex = 0; zIndex < size; zIndex += 1) {
      const waveNumberZ = waveNumber(zIndex, space);
      for (let yIndex = 0; yIndex < size; yIndex += 1) {
        const waveNumberY = waveNumber(yIndex, space);
        for (let xIndex = 0; xIndex < size; xIndex += 1) {
          const waveNumberX = waveNumber(xIndex, space);
          const index = xIndex + size * (yIndex + size * zIndex);
          const probability = (real[index] ?? 0) ** 2 + (imaginary[index] ?? 0) ** 2;
          weight += probability;
          kinetic +=
            probability *
            ((HBAR *
              HBAR *
              (waveNumberX * waveNumberX + waveNumberY * waveNumberY + waveNumberZ * waveNumberZ)) /
              (2 * state.massInKilograms));
        }
      }
    }
    const kineticEnergy = weight > 0 ? kinetic / weight : 0;
    return (kineticEnergy + potentialEnergy / normalizer) / JOULES_PER_EV;
  }

  private groundStateWidth(space: ResolvedSpace, mass: number, charge: number): number {
    if (space.potential === 'coulomb') {
      if (charge >= 0) {
        throw new SpaceValidationError(
          localizedText(
            'Кулоновский центр притягивает только отрицательные частицы; у положительной или нейтральной частицы нет основного состояния',
            'A Coulomb center attracts only negative particles; a positive or neutral particle has no ground state',
          ),
        );
      }
      return (
        (HBAR * HBAR) /
        (mass *
          COULOMB_CONSTANT *
          space.nuclearCharge *
          Math.abs(charge) *
          JOULES_PER_EV *
          JOULES_PER_EV)
      );
    }
    if (space.potential === 'harmonic') {
      const angularFrequency = (space.potentialEnergyInEv * JOULES_PER_EV) / HBAR;
      return Math.sqrt(HBAR / (2 * mass * angularFrequency));
    }
    throw new SpaceValidationError(
      localizedText(
        'Основное состояние есть только у ловушки и кулоновского центра; для свободного пространства и барьера используйте гауссов пакет',
        'Only a trap and a Coulomb center have a ground state; for free space and a barrier use a Gaussian packet',
      ),
    );
  }

  private potentialPeak(space: ResolvedSpace, mass: number, charge: number): number {
    const key = `peak|${spaceKey(space)}|${String(mass)}|${String(charge)}`;
    const cached = this.peaks.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const peak = this.potential(space, mass, charge).reduce(
      (largest, value) => Math.max(largest, Math.abs(value)),
      0,
    );
    this.peaks.set(key, peak);
    return peak;
  }

  private potential(space: ResolvedSpace, mass: number, charge: number): Float64Array {
    const key = `${spaceKey(space)}|${String(mass)}|${String(charge)}`;
    const cached = this.potentials.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const size = space.gridPointsPerAxis;
    const values = new Float64Array(size * size * size);
    const particle = { massInKilograms: mass, chargeInElementaryUnits: charge };
    const law = POTENTIAL_LAWS[space.potential];
    const wall = WALL_LAWS[space.walls ?? 'open'].reflectsWaves
      ? mirrorWallEnergyInJoules(space, particle)
      : 0;
    const layer = absorbingWidth(space);
    const inWall = (index: number): boolean => Math.min(index, size - 1 - index) < layer;
    for (let zIndex = 0; zIndex < size; zIndex += 1) {
      const z = coordinate(zIndex, space);
      for (let yIndex = 0; yIndex < size; yIndex += 1) {
        const y = coordinate(yIndex, space);
        for (let xIndex = 0; xIndex < size; xIndex += 1) {
          const x = coordinate(xIndex, space);
          const index = xIndex + size * (yIndex + size * zIndex);
          const value = law(x, y, z, space, particle);
          values[index] =
            wall > 0 && (inWall(xIndex) || inWall(yIndex) || inWall(zIndex))
              ? Math.max(value, wall)
              : value;
        }
      }
    }
    this.potentials.set(key, values);
    return values;
  }

  private absorbingMask(space: ResolvedSpace): Float64Array {
    const key = `mask|${String(space.gridPointsPerAxis)}`;
    const cached = this.potentials.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const size = space.gridPointsPerAxis;
    const width = absorbingWidth(space);
    const edge = (index: number): number => {
      const distance = Math.min(index, size - 1 - index);
      return distance >= width
        ? 1
        : Math.pow(Math.sin((Math.PI / 2) * ((distance + 1) / (width + 1))), 1 / 8);
    };
    const mask = new Float64Array(size * size * size);
    for (let zIndex = 0; zIndex < size; zIndex += 1) {
      for (let yIndex = 0; yIndex < size; yIndex += 1) {
        for (let xIndex = 0; xIndex < size; xIndex += 1) {
          mask[xIndex + size * (yIndex + size * zIndex)] =
            edge(xIndex) * edge(yIndex) * edge(zIndex);
        }
      }
    }
    this.potentials.set(key, mask);
    return mask;
  }
}

function gaussianLobe(
  width: number,
  center: Vector3,
  wave: Vector3,
): (x: number, y: number, z: number) => readonly [number, number] {
  return (x, y, z) => {
    const offsetX = x - center.x;
    const offsetY = y - center.y;
    const offsetZ = z - center.z;
    const amplitude = Math.exp(
      -(offsetX * offsetX + offsetY * offsetY + offsetZ * offsetZ) / (4 * width * width),
    );
    const phase = wave.x * offsetX + wave.y * offsetY + wave.z * offsetZ;
    return [amplitude * Math.cos(phase), amplitude * Math.sin(phase)];
  };
}

function shapeAmplitude(
  shape: WavepacketShape,
  potential: PotentialKind,
  width: number,
  center: Vector3,
  wave: Vector3,
): (x: number, y: number, z: number) => readonly [number, number] {
  const radial =
    (envelope: (x: number, y: number, z: number, radius: number) => number) =>
    (x: number, y: number, z: number): readonly [number, number] => {
      const offsetX = x - center.x;
      const offsetY = y - center.y;
      const offsetZ = z - center.z;
      const amplitude = envelope(offsetX, offsetY, offsetZ, Math.hypot(offsetX, offsetY, offsetZ));
      const phase = wave.x * offsetX + wave.y * offsetY + wave.z * offsetZ;
      return [amplitude * Math.cos(phase), amplitude * Math.sin(phase)];
    };
  switch (shape) {
    case 'gaussian':
      return gaussianLobe(width, center, wave);
    case 'groundState':
      return potential === 'coulomb'
        ? radial((x, y, z, radius) => Math.exp(-radius / width))
        : gaussianLobe(width, center, wave);
    case 'hydrogen2s':
      return radial(
        (x, y, z, radius) =>
          (SECOND_SHELL - radius / width) * Math.exp(-radius / (SECOND_SHELL * width)),
      );
    case 'hydrogen2p':
      return radial((x, y, z, radius) => (z / width) * Math.exp(-radius / (SECOND_SHELL * width)));
    case 'hydrogen3d':
      return radial(
        (x, y, z, radius) =>
          ((THREE_D_ANGULAR_FACTOR * z * z - radius * radius) / (width * width)) *
          Math.exp(-radius / (THIRD_SHELL * width)),
      );
    case 'hydrogen1s2p':
      return radial(
        (x, y, z, radius) =>
          Math.exp(-radius / width) / Math.sqrt(Math.PI * width ** 3) +
          (z * Math.exp(-radius / (SECOND_SHELL * width))) /
            Math.sqrt(TWO_P_NORM * Math.PI * width ** 5),
      );
    case 'catState': {
      const left = gaussianLobe(width, { x: -center.x, y: -center.y, z: -center.z }, wave);
      const right = gaussianLobe(width, center, { x: -wave.x, y: -wave.y, z: -wave.z });
      return (x, y, z) => {
        const [leftReal, leftImaginary] = left(x, y, z);
        const [rightReal, rightImaginary] = right(x, y, z);
        return [leftReal + rightReal, leftImaginary + rightImaginary];
      };
    }
  }
}

function rotate(
  real: Float64Array,
  imaginary: Float64Array,
  cosines: Float64Array,
  sines: Float64Array,
): void {
  for (let index = 0; index < real.length; index += 1) {
    const cosine = cosines[index] ?? 1;
    const sine = sines[index] ?? 0;
    const realValue = real[index] ?? 0;
    const imaginaryValue = imaginary[index] ?? 0;
    real[index] = realValue * cosine - imaginaryValue * sine;
    imaginary[index] = realValue * sine + imaginaryValue * cosine;
  }
}

function normalize(real: Float64Array, imaginary: Float64Array): void {
  let total = 0;
  for (let index = 0; index < real.length; index += 1) {
    total += (real[index] ?? 0) ** 2 + (imaginary[index] ?? 0) ** 2;
  }
  const scale = 1 / Math.sqrt(total);
  for (let index = 0; index < real.length; index += 1) {
    real[index] = (real[index] ?? 0) * scale;
    imaginary[index] = (imaginary[index] ?? 0) * scale;
  }
}

function quantize(values: Float64Array): readonly number[] {
  const peak = values.reduce((maximum, value) => Math.max(maximum, value), 0);
  return Array.from(values, (value) =>
    peak > 0 ? Math.round((value / peak) * QUANTIZATION_LEVELS) : 0,
  );
}
