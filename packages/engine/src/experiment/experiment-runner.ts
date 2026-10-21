/* ExperimentRunner: executes a compiled plan shot by shot on one engine, with a fresh particle context per shot, hadronizes colour and lets hadrons decay inside every time window, and aggregates the records.
   An environment influence aimed at some particles opens a region for them only; each particle sees the shared environment overlaid by its regions, and products inherit the regions of their parents.
   One aimed at the whole system also reaches inside every region, applied to the environment its members see, so heating the system heats a bubble with its own medium too. */
import {
  ELECTRON_VOLT,
  PARTICLE_CATALOG,
  SPEED_OF_LIGHT_IN_VACUUM,
  particleSpec,
} from '@standard-model/constants';
import {
  LocalizedError,
  PARTICLE_NAMES,
  localizedText,
  type DiagramView,
  type Environment,
  type EnvironmentAspectKey,
  type ExperimentResult,
  type LocalizedText,
  type LeptonFlavor,
  type MediumAspect,
  type Particle,
  type Vector3,
  type ParticleName,
  type RunProgress,
} from '@standard-model/contracts';
import type { CascadeDecay } from '../decay/decays.js';
import type { ScreenHit } from '../diffraction/double-slit.js';
import { createEnvironment } from '../environment/environment.js';
import { hasAggregateState, mediumPhase } from '../environment/aggregate-state.js';
import {
  distanceToEdgeInMeters,
  energyAfterPathInEv,
  heatedMedium,
  photonAttenuationPerMeter,
  rangeInMeters,
} from '../environment/medium-extent.js';
import { mediumAcidity } from '../molecules/solution-chemistry.js';
import { isDeconfined } from '../particles/deconfinement.js';
import type { Engine } from '../index.js';
import { directionalObservableOf, leptonFlavorOf } from '../particles/capabilities.js';
import {
  HADRONIZATION_TIME_IN_SECONDS,
  type HadronizationResult,
} from '../particles/hadronization.js';
import { Atom } from '../particles/atom.js';
import { Molecule } from '../particles/molecule.js';
import type { InfluenceReaction } from '@standard-model/contracts';
import { StateVector } from '../quantum/state-vector.js';
import { labelBaseOf, matterStepName, type MatterStep } from './matter-steps.js';
import { objectReadings } from './object-measurements.js';
import type { ResolvedSpace, SpatialState } from '../space/space-lab.js';
import {
  WALL_LAWS,
  geometryOf,
  innermostBody,
  withBodyMedium,
  worldOf,
  type CubeWalls,
  type World,
} from '../space/geometry.js';
import {
  EV_PER_GEV,
  addVectors,
  scaleVector,
  updatedRunningMean,
  vectorMagnitude,
} from '@standard-model/utils';
import type { CompiledPlan, CompiledStep } from './plan-compiler.js';
import { ResultAggregator, type ShotRecords } from './result-aggregator.js';

const ANNIHILATION_INTEGRATION_CHUNKS = 8;
const EQUATOR_DEGREES = 90;
const HALF = 0.5;
const FULL_TURN_DEGREES = 360;
const DEGREES_PER_RADIAN = 180 / Math.PI;
const ANNIHILATION_LABEL = 'annihilation';
const HADRONS_TOKEN = 'hadrons';
const VACUUM_PHASE = 'vacuum';
const JET_TOKEN = 'jet';
const KEV_PER_GEV = 1e6;
const MEDIUM_REACTIONS_PER_STEP_LIMIT = 1000;
const SHARED_MEDIUM = -1;
const FIRST_BODY_KEY = -2;
const METERS_PER_FEMTOMETER = 1e-15;

function metersOf(particle: Particle): Vector3 {
  return scaleVector(particle.kinematics.positionInFemtometers, METERS_PER_FEMTOMETER);
}

interface AnnihilationPair {
  readonly electron: string;
  readonly positron: string;
}

export interface ShotObserver {
  beforeStep?(stepIndex: number, step: CompiledStep, context: ShotContext): void;
  afterStep(stepIndex: number, step: CompiledStep, context: ShotContext): void;
}

export interface RunOptions {
  readonly onProgress?: (progress: RunProgress) => void;
  readonly progressEveryShots?: number;
  readonly shouldStop?: () => boolean;
}

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

const FLAVOR_NAMES: readonly LeptonFlavor[] = ['electron', 'muon', 'tau'];
const PROGRESS_STEPS = 100;
const YIELD_INTERVAL_IN_MILLISECONDS = 50;
const FEMTOMETERS_PER_METER = 1e15;

export interface MediumReaction {
  readonly parent: Particle;
  readonly products: readonly Particle[];
  readonly label: LocalizedText | string;
}

export interface EnvironmentRegion {
  readonly id: number;
  readonly aspect: EnvironmentAspectKey;
  readonly value: unknown;
  readonly members: Set<string>;
}

export class ShotContext {
  readonly particles = new Map<string, Particle>();
  readonly spatial = new Map<string, SpatialState>();
  space: ResolvedSpace | null = null;
  readonly numeric = new Map<string, number>();
  readonly categorical = new Map<string, string>();
  readonly collisionDiagrams = new Map<string, readonly DiagramView[]>();
  readonly hadronizations: HadronizationResult[] = [];
  readonly cascades: CascadeDecay[] = [];
  readonly hadronic = new Set<string>();
  readonly reactions: MediumReaction[] = [];
  jetCount = 0;
  environment = createEnvironment();
  readonly regions: EnvironmentRegion[] = [];
  reportedRecords: ReadonlySet<string> = new Set();
  readonly pendingHeat = new Map<number, number>();

  add(label: string, particle: Particle, parents: readonly Particle[]): void {
    this.particles.set(label, particle);
    this.regions.forEach((region) => {
      if (parents.some((parent) => region.members.has(parent.id))) {
        region.members.add(particle.id);
      }
    });
  }

  baseEnvironmentFor(particle: Particle): Environment {
    return this.overlaid(particle.id, this.environment);
  }

  environmentFor(particle: Particle): Environment {
    return withBodyMedium(this.baseEnvironmentFor(particle), metersOf(particle));
  }

  walls(): CubeWalls | null {
    const space = this.space;
    return space === null
      ? null
      : {
          law: WALL_LAWS[space.walls ?? 'open'],
          halfEdgeInMeters: HALF * space.gridPointsPerAxis * space.cellSizeInMeters,
        };
  }

  worldFor(particle: Particle): World {
    return worldOf(this.baseEnvironmentFor(particle), this.walls());
  }

  reshapeRegions(shared: Environment, transform: (environment: Environment) => Environment): void {
    const reshaped = this.regions.map((region) => {
      const [member] = region.members;
      const inside = transform(
        member === undefined
          ? region.value === null
            ? shared.without(region.aspect)
            : shared.with(region.aspect, region.value as never)
          : this.overlaid(member, shared),
      );
      return { ...region, value: inside.get(region.aspect) ?? null };
    });
    this.regions.splice(0, this.regions.length, ...reshaped);
  }

  private overlaid(id: string, shared: Environment): Environment {
    return this.regions.reduce<Environment>(
      (environment, region) =>
        !region.members.has(id)
          ? environment
          : region.value === null
            ? environment.without(region.aspect)
            : environment.with(region.aspect, region.value as never),
      shared,
    );
  }

  heatMedium(particle: Particle, energyInJoules: number): void {
    const bodies = this.environment.get('bodies')?.bodies ?? [];
    const body = innermostBody(bodies, metersOf(particle));
    const ownBodies = this.regions.some(
      (region) => region.aspect === 'bodies' && region.members.has(particle.id),
    );
    if (body !== undefined && !ownBodies) {
      const key = FIRST_BODY_KEY - bodies.indexOf(body);
      this.pendingHeat.set(key, (this.pendingHeat.get(key) ?? 0) + energyInJoules);
      return;
    }
    const regionIndex = this.regions.reduce(
      (found, region, index) =>
        region.aspect === 'medium' && region.members.has(particle.id) ? index : found,
      SHARED_MEDIUM,
    );
    const key = regionIndex >= 0 ? regionIndex : SHARED_MEDIUM;
    this.pendingHeat.set(key, (this.pendingHeat.get(key) ?? 0) + energyInJoules);
  }

  applyHeat(): void {
    this.pendingHeat.forEach((energyInJoules, key) => {
      if (key <= FIRST_BODY_KEY) {
        const bodies = this.environment.get('bodies')?.bodies ?? [];
        this.environment = this.environment.with('bodies', {
          bodies: bodies.map((body, index) =>
            FIRST_BODY_KEY - index === key ? heatedMedium(body, energyInJoules) : body,
          ),
        });
        return;
      }
      if (key === SHARED_MEDIUM) {
        const medium = this.environment.get('medium');
        if (medium !== undefined) {
          this.environment = this.environment.with('medium', heatedMedium(medium, energyInJoules));
        }
        return;
      }
      const region = this.regions[key];
      if (region !== undefined && region.value !== null) {
        this.regions[key] = {
          ...region,
          value: heatedMedium(region.value as MediumAspect, energyInJoules),
        };
      }
    });
    this.pendingHeat.clear();
  }

  scope(targets: readonly Particle[], before: Environment, after: Environment): void {
    new Set([...before.aspectKeys, ...after.aspectKeys]).forEach((aspect) => {
      const value = after.get(aspect);
      if (value === before.get(aspect)) {
        return;
      }
      this.regions.push({
        id: this.regions.length + 1,
        aspect,
        value: value ?? null,
        members: new Set(targets.map((particle) => particle.id)),
      });
    });
  }

  freshLabel(name: string): string {
    const base = labelBaseOf(name);
    let ordinal = 1;
    const candidate = (): string => (ordinal === 1 ? base : `${base}${String(ordinal)}`);
    while (this.particles.has(candidate())) {
      ordinal += 1;
    }
    return candidate();
  }

  particle(label: string): Particle {
    const particle = this.particles.get(label);
    if (particle === undefined) {
      throw new Error(`Unknown particle label ${label}`);
    }
    return particle;
  }

  targets(labels: readonly string[] | undefined): readonly Particle[] {
    if (labels === undefined) {
      return [...this.particles.values()].filter((particle) => particle.status === 'alive');
    }
    return labels.map((label) => this.particle(label));
  }

  records(): ShotRecords {
    return { numeric: this.numeric, categorical: this.categorical };
  }

  labelOf(particleId: string): string | null {
    for (const [label, particle] of this.particles) {
      if (particle.id === particleId) {
        return label;
      }
    }
    return null;
  }
}

export class ExperimentRunner {
  private stepTotals: number[] = [];
  private timedShots = 0;

  constructor(private readonly engine: Engine) {}

  get stepMeanMilliseconds(): readonly number[] {
    return this.stepTotals.map((total) => total / Math.max(this.timedShots, 1));
  }

  run(plan: CompiledPlan, options: RunOptions = {}): ExperimentResult {
    const started = Date.now();
    const aggregator = new ResultAggregator(plan.report);
    const every =
      options.progressEveryShots ?? Math.max(1, Math.floor(plan.shots / PROGRESS_STEPS));
    for (let shot = 0; shot < plan.shots; shot += 1) {
      aggregator.addShot(this.runShot(plan));
      if (
        options.onProgress !== undefined &&
        ((shot + 1) % every === 0 || shot + 1 === plan.shots)
      ) {
        options.onProgress({ completedShots: shot + 1, totalShots: plan.shots });
      }
    }
    return this.result(plan, aggregator, started);
  }

  async runAsync(plan: CompiledPlan, options: RunOptions = {}): Promise<ExperimentResult> {
    const started = Date.now();
    const aggregator = new ResultAggregator(plan.report);
    let meanShotMilliseconds = 0;
    let lastYield = Number.NEGATIVE_INFINITY;
    let completedShots = 0;
    options.onProgress?.({ completedShots: 0, totalShots: plan.shots, phase: 'firstShot' });
    for (let shot = 0; shot < plan.shots; shot += 1) {
      if (performance.now() - lastYield >= YIELD_INTERVAL_IN_MILLISECONDS) {
        await yieldToEventLoop();
        lastYield = performance.now();
      }
      if (options.shouldStop?.() === true) {
        return {
          ...this.result(plan, aggregator, started),
          shots: completedShots,
          stopped: true,
          requestedShots: plan.shots,
        };
      }
      const shotStarted = performance.now();
      aggregator.addShot(this.runShot(plan));
      completedShots = shot + 1;
      meanShotMilliseconds = updatedRunningMean(
        meanShotMilliseconds,
        shot + 1,
        performance.now() - shotStarted,
      );
      options.onProgress?.({
        completedShots: shot + 1,
        totalShots: plan.shots,
        phase: 'shots',
        meanShotMilliseconds,
        remainingMilliseconds: meanShotMilliseconds * (plan.shots - shot - 1),
      });
    }
    return this.result(plan, aggregator, started);
  }

  private result(
    plan: CompiledPlan,
    aggregator: ResultAggregator,
    started: number,
  ): ExperimentResult {
    return {
      planName: plan.name,
      shots: plan.shots,
      seed: plan.seed,
      parameters: plan.parameters,
      reportValues: aggregator.reportValues(),
      outcomeCounts: aggregator.outcomeCounts(),
      distributions: aggregator.distributions(),
      systemReport: null,
      elapsedMilliseconds: Date.now() - started,
      stepMeanMilliseconds: this.stepMeanMilliseconds,
    };
  }

  runShot(plan: CompiledPlan, observer?: ShotObserver): ShotRecords {
    const context = new ShotContext();
    context.space = plan.space;
    context.reportedRecords = new Set(plan.report.flatMap((spec) => spec.records));
    try {
      plan.steps.forEach((step, stepIndex) => {
        observer?.beforeStep?.(stepIndex, step, context);
        const stepStarted = performance.now();
        this.execute(step, context);
        this.stepTotals[stepIndex] =
          (this.stepTotals[stepIndex] ?? 0) + performance.now() - stepStarted;
        observer?.afterStep(stepIndex, step, context);
      });
      this.timedShots += 1;
      return context.records();
    } finally {
      this.releaseRegisters(context);
    }
  }

  private execute(step: CompiledStep, context: ShotContext): void {
    switch (step.operation) {
      case 'create':
        this.create(step, context);
        break;
      case 'createNucleus':
      case 'createAtom':
      case 'createMolecule':
        this.createMatter(step, context);
        break;
      case 'entangle': {
        const [first, second] = step.targets;
        if (first === undefined || second === undefined) {
          throw new Error('entangle needs two targets');
        }
        this.engine.quantum.entangle(
          [context.particle(first), context.particle(second)],
          step.observable ?? 'spin',
          step.amplitudes === undefined
            ? step.state
            : StateVector.fromAmplitudes(
                step.amplitudes.real.map((real, index) => ({
                  real,
                  imaginary: step.amplitudes?.imaginary[index] ?? 0,
                })),
              ),
        );
        break;
      }
      case 'influence': {
        const influence = this.engine.influences.create(step.influence, step.parameters ?? {});
        const targets = context.targets(step.targets);
        const [first] = targets;
        const before =
          step.targets === undefined || first === undefined
            ? context.environment
            : context.environmentFor(first);
        const outcome = influence.apply(
          targets,
          this.engine.contextFor(before, [...context.particles.values()]),
        );
        if (step.targets === undefined) {
          context.reshapeRegions(context.environment, (environment) =>
            influence.environmentOnly === true
              ? influence.apply(
                  targets,
                  this.engine.contextFor(environment, [...context.particles.values()]),
                ).environment
              : environment,
          );
          context.environment = outcome.environment;
        } else {
          context.scope(targets, before, outcome.environment);
        }
        this.applyReactions(context, outcome.reactions ?? []);
        break;
      }
      case 'evolve': {
        const starts = new Map(
          [...context.particles.values()].map((particle) => [
            particle.id,
            particle.kinematics.positionInFemtometers,
          ]),
        );
        context
          .targets(step.targets)
          .forEach((particle) =>
            this.engine.dynamics.evolve(
              particle,
              context.environmentFor(particle),
              step.durationInSeconds,
            ),
          );
        const space = context.space;
        if (space !== null && space.potential === 'harmonic') {
          this.annihilationPairs(context, step.targets).forEach((pair) =>
            this.maybeAnnihilate(
              context,
              pair,
              this.pairRate(space, context, pair) * step.durationInSeconds,
            ),
          );
        }
        this.dissolve(context, step.targets);
        this.evolveMolecules(context, step.targets, step.durationInSeconds);
        this.confine(context, step.durationInSeconds, starts);
        this.absorbInMedia(context, starts, step.durationInSeconds);
        this.reflectOffWalls(context);
        break;
      }
      case 'measure': {
        const record = this.engine.quantum.measure(
          context.particle(step.target),
          step.observable,
          step.axis,
        );
        context.numeric.set(step.record, record.eigenvalue);
        context.categorical.set(
          step.record,
          step.observable === 'flavor'
            ? (FLAVOR_NAMES[record.outcomeIndex] ?? 'unknown')
            : String(record.eigenvalue),
        );
        break;
      }
      case 'combine': {
        const parts = step.targets.map((target) => context.particle(target));
        context.add(step.label, this.engine.combinations.combine(parts), parts);
        break;
      }
      case 'diffract': {
        const hit = this.engine.doubleSlit.sample(
          context.particle(step.target),
          context.environmentFor(context.particle(step.target)),
          {
            slitSeparationInMeters: step.slitSeparationInMeters,
            slitWidthInMeters: step.slitWidthInMeters,
            screenDistanceInMeters: step.screenDistanceInMeters,
            whichPathDetector: step.whichPathDetector !== 0,
            pathMarked: step.pathMarker !== undefined,
          },
        );
        context.numeric.set(step.record, hit.positionInMicrometers);
        if (step.pathMarker !== undefined) {
          this.markPath(context.particle(step.pathMarker), hit);
        }
        break;
      }
      case 'collide':
        this.collide(step, context);
        break;
      case 'place': {
        const particle = context.particle(step.target);
        context.spatial.set(
          step.target,
          this.engine.space.place(
            this.requireSpace(context),
            particle,
            step.centerInMeters,
            step.widthInMeters,
            step.shape,
          ),
        );
        particle.setPosition({
          x: step.centerInMeters.x * FEMTOMETERS_PER_METER,
          y: step.centerInMeters.y * FEMTOMETERS_PER_METER,
          z: step.centerInMeters.z * FEMTOMETERS_PER_METER,
        });
        break;
      }
      case 'propagate': {
        const space = this.requireSpace(context);
        const pairs = this.annihilationPairs(context, undefined);
        context.spatial.forEach((state) =>
          this.engine.space.stepsFor(space, state, step.durationInSeconds),
        );
        const chunks = pairs.length === 0 ? 1 : ANNIHILATION_INTEGRATION_CHUNKS;
        const chunkDuration = step.durationInSeconds / chunks;
        const rates = (): readonly number[] =>
          pairs.map((pair) => this.pairRate(space, context, pair));
        let previous = rates();
        const integrated = pairs.map(() => 0);
        for (let chunk = 0; chunk < chunks; chunk += 1) {
          context.spatial.forEach((state, label) => {
            context.spatial.set(label, this.engine.space.propagate(space, state, chunkDuration));
          });
          const current = rates();
          current.forEach((rate, index) => {
            integrated[index] =
              (integrated[index] ?? 0) + ((rate + (previous[index] ?? 0)) / 2) * chunkDuration;
          });
          previous = current;
        }
        context.spatial.forEach((state, label) =>
          context.particle(label).advanceProperTime(step.durationInSeconds),
        );
        pairs.forEach((pair, index) => this.maybeAnnihilate(context, pair, integrated[index] ?? 0));
        this.confine(context, step.durationInSeconds);
        break;
      }
      case 'measureSystem':
        this.measureSystem(step.record, context);
        break;
      case 'measurePosition': {
        const space = this.requireSpace(context);
        const state = context.spatial.get(step.target);
        if (state === undefined) {
          throw new Error(`${step.target} is not placed in the space`);
        }
        const outcome = this.engine.space.measure(space, state);
        context.spatial.set(step.target, outcome.collapsed);
        const position = outcome.positionInMeters;
        context.numeric.set(`${step.record}.x`, position.x);
        context.numeric.set(`${step.record}.y`, position.y);
        context.numeric.set(`${step.record}.z`, position.z);
        context.numeric.set(`${step.record}.r`, Math.hypot(position.x, position.y, position.z));
        context.particle(step.target).setPosition({
          x: position.x * FEMTOMETERS_PER_METER,
          y: position.y * FEMTOMETERS_PER_METER,
          z: position.z * FEMTOMETERS_PER_METER,
        });
        break;
      }
      case 'decay':
        this.decay(step, context);
        break;
    }
  }

  private markPath(marker: Particle, hit: ScreenHit): void {
    const twoLevel = marker.observables.find(
      (observable) => observable.dimension === 2 && observable.name !== 'flavor',
    );
    if (twoLevel === undefined) {
      throw new LocalizedError(
        localizedText(
          `у ${marker.spec.name} нет двухуровневого спина или поляризации, чтобы записать путь`,
          `${marker.spec.name} has no two-level spin or polarization to carry the path`,
        ),
      );
    }
    if (marker.quantumSlots.has(twoLevel.name)) {
      if (this.engine.quantum.registers.registerOf(marker, twoLevel.name).slots.length > 1) {
        throw new LocalizedError(
          localizedText(
            'метка пути запутана с другой частицей; возьмите свободный холостой фотон',
            'the path marker is entangled with another particle; use a free idler photon',
          ),
        );
      }
      this.engine.quantum.release(marker, twoLevel.name);
    }
    if (this.engine.random.nextUnit() < hit.coherence) {
      this.engine.quantum.prepare(marker, twoLevel.name, {
        polarAngleDegrees: EQUATOR_DEGREES,
        azimuthDegrees: (hit.relativePhaseInRadians * DEGREES_PER_RADIAN) % FULL_TURN_DEGREES,
      });
      return;
    }
    this.engine.quantum.prepare(
      marker,
      twoLevel.name,
      this.engine.random.nextUnit() < HALF ? 'up' : 'down',
    );
  }

  private applyReactions(context: ShotContext, reactions: readonly InfluenceReaction[]): void {
    reactions.forEach((reaction) => {
      reaction.parent.quantumSlots.forEach((slot) =>
        this.engine.quantum.registers.dispose(this.engine.quantum.registers.byId(slot.registerId)),
      );
      reaction.parent.markBound();
      reaction.products.forEach((product) =>
        context.add(context.freshLabel(product.spec.name), product, [reaction.parent]),
      );
      context.reactions.push(reaction);
    });
  }

  private absorbInMedia(
    context: ShotContext,
    starts: ReadonlyMap<string, Vector3>,
    durationInSeconds: number,
  ): void {
    const absorbed: MediumReaction[] = [];
    [...context.particles.values()]
      .filter((particle) => particle.status === 'alive' && particle.spec.family !== 'neutrino')
      .forEach((particle) => {
        const medium = context.environmentFor(particle).get('medium');
        if (medium === undefined || geometryOf(medium) === null) {
          return;
        }
        const momentum = particle.kinematics.fourMomentumInGev;
        const speed = vectorMagnitude(momentum.momentum) / momentum.energy;
        if (!(speed > 0)) {
          return;
        }
        const start = starts.get(particle.id) ?? particle.kinematics.positionInFemtometers;
        const path = Math.min(
          speed * SPEED_OF_LIGHT_IN_VACUUM.value * durationInSeconds,
          distanceToEdgeInMeters(medium, start, momentum.momentum),
        );
        if (particle.spec.massInGev.value === 0) {
          const energyInEv = momentum.energy * EV_PER_GEV;
          const attenuation = photonAttenuationPerMeter(medium, energyInEv);
          if (this.engine.random.nextUnit() < -Math.expm1(-attenuation * path)) {
            particle.markCollided();
            context.heatMedium(particle, energyInEv * ELECTRON_VOLT.value);
            absorbed.push({
              parent: particle,
              products: [],
              label: localizedText('поглощен средой', 'absorbed by the medium'),
            });
          }
          return;
        }
        const charge = particle.spec.electricChargeInElementaryUnits;
        if (charge === 0) {
          return;
        }
        const mass = particle.spec.massInGev.value;
        const kineticInEv = (momentum.energy - mass) * EV_PER_GEV;
        const remaining = energyAfterPathInEv(medium, charge, mass, kineticInEv, path);
        if (remaining >= kineticInEv) {
          return;
        }
        context.heatMedium(particle, (kineticInEv - remaining) * ELECTRON_VOLT.value);
        const travelled = Math.min(path, rangeInMeters(medium, charge, mass, kineticInEv));
        const length = vectorMagnitude(momentum.momentum);
        const totalEnergy = mass + remaining / EV_PER_GEV;
        const newMomentum = Math.sqrt(Math.max(totalEnergy ** 2 - mass ** 2, 0));
        particle.setMomentum(scaleVector(momentum.momentum, newMomentum / length));
        particle.setPosition(
          addVectors(
            start,
            scaleVector(momentum.momentum, (travelled * FEMTOMETERS_PER_METER) / length),
          ),
        );
      });
    context.applyHeat();
    absorbed.forEach((reaction) => context.reactions.push(reaction));
  }

  private dissolve(context: ShotContext, targets: readonly string[] | undefined): void {
    const reactions = context
      .targets(targets)
      .filter((particle) => particle.status === 'alive')
      .flatMap((particle) => {
        const outcome = this.engine.solutions.equilibrate(
          particle,
          context.environmentFor(particle),
        );
        return outcome === null
          ? []
          : [
              {
                parent: particle,
                products: outcome.products.map((name) =>
                  this.engine.particles.create(name, {
                    momentumInGev: particle.kinematics.fourMomentumInGev.momentum,
                    positionInFemtometers: particle.kinematics.positionInFemtometers,
                  }),
                ),
                label: outcome.label,
              },
            ];
      });
    this.applyReactions(context, reactions);
  }

  private evolveMolecules(
    context: ShotContext,
    targets: readonly string[] | undefined,
    durationInSeconds: number,
  ): void {
    const reactions = context
      .targets(targets)
      .filter(
        (particle) =>
          particle instanceof Molecule ||
          (context.environmentFor(particle).get('medium') !== undefined &&
            particle instanceof Atom &&
            particle.spec.electricChargeInElementaryUnits === 0),
      )
      .filter((particle) => particle.status === 'alive')
      .flatMap((particle) => {
        const environment = context.environmentFor(particle);
        const gasTemperature =
          environment.get('temperature')?.temperatureInKelvin ??
          environment.get('medium')?.temperatureInKelvin;
        const outcome = this.engine.molecules.evolve(particle, environment, durationInSeconds);
        return outcome === null
          ? []
          : [
              {
                parent: particle,
                products: outcome.products.map((name) => {
                  const product = this.engine.particles.create(name, {
                    momentumInGev: particle.kinematics.fourMomentumInGev.momentum,
                    positionInFemtometers: particle.kinematics.positionInFemtometers,
                  });
                  if (product instanceof Molecule && gasTemperature !== undefined) {
                    product.internalTemperatureInKelvin = gasTemperature;
                  }
                  return product;
                }),
                label: outcome.label,
              },
            ];
      });
    this.applyReactions(context, reactions);
  }

  private reactWithMedium(
    context: ShotContext,
    durationInSeconds: number,
    starts: ReadonlyMap<string, Vector3>,
  ): void {
    const transported = this.transportNeutrons(context, durationInSeconds, starts);
    const pending = [...context.particles.values()]
      .filter((particle) => particle.status === 'alive' && !transported.has(particle.id))
      .map((particle) => ({
        particle,
        durationInSeconds,
        visited: new Set<ParticleName>() as ReadonlySet<ParticleName>,
      }));
    let reactions = 0;
    for (let index = 0; index < pending.length; index += 1) {
      const next = pending[index];
      const medium =
        next === undefined ? undefined : context.environmentFor(next.particle).get('medium');
      const outcome =
        next === undefined || medium === undefined
          ? null
          : this.engine.mediumReactions.react(
              next.particle,
              medium,
              next.durationInSeconds,
              next.visited,
            );
      if (next === undefined || outcome === null) {
        continue;
      }
      reactions += 1;
      if (reactions > MEDIUM_REACTIONS_PER_STEP_LIMIT) {
        throw new LocalizedError(
          localizedText(
            `Цепная реакция в среде: больше ${String(MEDIUM_REACTIONS_PER_STEP_LIMIT)} реакций за один шаг эволюции. Укоротите шаг или выберите режим «одна реакция за шаг»`,
            `Chain reaction in the medium: more than ${String(MEDIUM_REACTIONS_PER_STEP_LIMIT)} reactions in one evolution step. Shorten the step or choose the “one reaction per step” mode`,
          ),
        );
      }
      next.particle.quantumSlots.forEach((slot) =>
        this.engine.quantum.registers.dispose(this.engine.quantum.registers.byId(slot.registerId)),
      );
      if (outcome.kind === 'recombination') {
        next.particle.markBound();
      } else {
        next.particle.markCollided();
      }
      outcome.products.forEach((product) =>
        context.add(context.freshLabel(product.spec.name), product, [next.particle]),
      );
      if (outcome.continuation !== null && outcome.continuation.remainingInSeconds > 0) {
        pending.push({
          particle: outcome.continuation.particle,
          durationInSeconds: outcome.continuation.remainingInSeconds,
          visited: outcome.continuation.visited,
        });
      }
      context.reactions.push({
        parent: next.particle,
        products: outcome.products,
        label: outcome.label,
      });
    }
  }

  private transportNeutrons(
    context: ShotContext,
    durationInSeconds: number,
    starts: ReadonlyMap<string, Vector3>,
  ): ReadonlySet<string> {
    const handled = new Set<string>();
    [...context.particles.values()]
      .filter((particle) => particle.status === 'alive' && particle.spec.name === 'neutron')
      .forEach((neutron) => {
        const world = context.worldFor(neutron);
        const moved = neutron.kinematics.positionInFemtometers;
        const start = starts.get(neutron.id) ?? moved;
        neutron.setPosition(start);
        if (!this.engine.neutronTransport.applies(neutron, world)) {
          neutron.setPosition(moved);
          return;
        }
        handled.add(neutron.id);
        const outcome = this.engine.neutronTransport.transport(
          neutron,
          world,
          durationInSeconds,
          start,
        );
        if (outcome === null) {
          return;
        }
        neutron.markCollided();
        outcome.products.forEach((product) =>
          context.add(context.freshLabel(product.spec.name), product, [neutron]),
        );
        context.reactions.push({
          parent: neutron,
          products: outcome.products,
          label: outcome.label,
        });
      });
    return handled;
  }

  private reflectOffWalls(context: ShotContext): void {
    const walls = context.walls();
    if (walls === null) {
      return;
    }
    [...context.particles.entries()]
      .filter(([label, particle]) => particle.status === 'alive' && !context.spatial.has(label))
      .forEach(([, particle]) => {
        const folded = walls.law.fold(
          metersOf(particle),
          particle.kinematics.fourMomentumInGev.momentum,
          walls.halfEdgeInMeters,
        );
        particle.setPosition(scaleVector(folded.positionInMeters, FEMTOMETERS_PER_METER));
        particle.setMomentum(folded.momentum);
      });
  }

  private confine(
    context: ShotContext,
    durationInSeconds: number,
    starts: ReadonlyMap<string, Vector3> = new Map(),
  ): void {
    this.reactWithMedium(context, durationInSeconds, starts);
    this.melt(context);
    if (durationInSeconds >= HADRONIZATION_TIME_IN_SECONDS) {
      this.hadronize(context);
    }
    this.cascade(context, durationInSeconds);
  }

  private melt(context: ShotContext): void {
    const reactions = [...context.particles.values()]
      .filter((particle) => particle.status === 'alive')
      .flatMap((particle) => {
        const products = this.engine.deconfinement.melt(particle, context.environmentFor(particle));
        return products === null
          ? []
          : [
              {
                parent: particle,
                products,
                label: localizedText(
                  'деконфайнмент: адрон расплавился на кварки',
                  'deconfinement: the hadron melted into quarks',
                ),
              },
            ];
      });
    this.applyReactions(context, reactions);
  }

  private hadronize(context: ShotContext): void {
    const labels = new Map(
      [...context.particles.entries()].map(([label, particle]) => [particle.id, label]),
    );
    const result = this.engine.hadronization.hadronize(
      [...context.particles.values()].filter(
        (particle) => !isDeconfined(context.environmentFor(particle)),
      ),
    );
    if (result.baryons.length === 0 && result.strings.length === 0 && result.jets.length === 0) {
      return;
    }
    result.baryons.forEach((baryon) =>
      context.add(context.freshLabel(baryon.hadron.spec.name), baryon.hadron, baryon.constituents),
    );
    result.strings.forEach((string) =>
      string.hadrons.forEach((hadron) => {
        context.add(context.freshLabel(hadron.spec.name), hadron, string.partons);
        context.hadronic.add(hadron.id);
      }),
    );
    [
      ...result.baryons.flatMap((baryon) => baryon.constituents),
      ...result.strings.flatMap((string) => string.partons),
      ...result.jets.map((jet) => jet.parton),
    ].forEach((parton) => context.spatial.delete(labels.get(parton.id) ?? ''));
    context.jetCount += result.jets.length;
    context.hadronizations.push(result);
  }

  private cascade(context: ShotContext, durationInSeconds: number): void {
    const isMeson = (particle: Particle): boolean => particle.spec.family === 'meson';
    const roots = [...context.particles.values()].filter(
      (particle) => particle.status === 'alive' && isMeson(particle),
    );
    if (roots.length === 0) {
      return;
    }
    const decays = this.engine.decays.cascade(roots, durationInSeconds, isMeson);
    decays.forEach(({ event }) => {
      event.products.forEach((product) => {
        if (product.particle === null) {
          return;
        }
        context.add(context.freshLabel(product.particle.spec.name), product.particle, [
          event.parent,
        ]);
        if (context.hadronic.has(event.parent.id)) {
          context.hadronic.add(product.particle.id);
        }
      });
    });
    context.cascades.push(...decays);
  }

  private measureSystem(record: string, context: ShotContext): void {
    const alive = [...context.particles.values()].filter((particle) => particle.status === 'alive');
    const jets = Array.from({ length: context.jetCount }, () => JET_TOKEN);
    const isHadronic = (particle: Particle): boolean => context.hadronic.has(particle.id);
    const listed = alive.filter((particle) => !isHadronic(particle));
    const contents = [
      ...listed
        .map((particle) =>
          particle.spec.name.includes(':') ? particle.spec.symbol : particle.spec.name,
        )
        .sort(),
      ...(listed.length < alive.length ? [HADRONS_TOKEN] : []),
      ...jets,
    ];
    context.categorical.set(record, contents.length === 0 ? 'empty' : contents.join('+'));
    const heaviest = listed.reduce<Particle | null>(
      (best, particle) =>
        best === null || particle.spec.massInGev.value > best.spec.massInGev.value
          ? particle
          : best,
      null,
    );
    context.categorical.set(
      `${record}.heaviest`,
      heaviest === null
        ? 'empty'
        : heaviest.spec.name.includes(':')
          ? heaviest.spec.symbol
          : heaviest.spec.name,
    );
    context.numeric.set(`${record}.heaviestMassNumber`, heaviest?.spec.baryonNumber ?? 0);
    const verdictOf = (particle: Particle) => {
      const medium = context.environmentFor(particle).get('medium');
      return medium === undefined ? null : mediumPhase(particle.spec.name, medium);
    };
    const heaviestVerdict = heaviest === null ? null : verdictOf(heaviest);
    const sharedMedium = context.environment.get('medium');
    const acidity = sharedMedium === undefined ? null : mediumAcidity(sharedMedium);
    if (acidity !== null) {
      context.numeric.set(`${record}.pH`, acidity.pH);
    }
    if (sharedMedium !== undefined) {
      context.numeric.set(`${record}.medium.temperatureInKelvin`, sharedMedium.temperatureInKelvin);
      context.numeric.set(
        `${record}.medium.absorbedEnergyInJoules`,
        sharedMedium.absorbedEnergyInJoules ?? 0,
      );
    }
    (context.environment.get('bodies')?.bodies ?? []).forEach((body, index) => {
      const name = `${record}.body${String(index + 1)}`;
      context.numeric.set(`${name}.temperatureInKelvin`, body.temperatureInKelvin);
      context.numeric.set(`${name}.absorbedEnergyInJoules`, body.absorbedEnergyInJoules ?? 0);
    });
    context.categorical.set(
      `${record}.phase`,
      heaviest === null ? 'empty' : (heaviestVerdict?.phase ?? VACUUM_PHASE),
    );
    if (heaviestVerdict?.allotrope !== undefined) {
      context.categorical.set(`${record}.allotrope`, heaviestVerdict.allotrope);
    }
    [...context.particles.entries()]
      .filter(([, particle]) => listed.includes(particle) && hasAggregateState(particle.spec.name))
      .forEach(([label, particle]) => {
        const verdict = verdictOf(particle);
        context.categorical.set(`${record}.${label}.phase`, verdict?.phase ?? VACUUM_PHASE);
        if (verdict?.allotrope !== undefined) {
          context.categorical.set(`${record}.${label}.allotrope`, verdict.allotrope);
        }
      });
    const counts = new Map<ParticleName, number>();
    alive.forEach((particle) =>
      counts.set(particle.spec.name, (counts.get(particle.spec.name) ?? 0) + 1),
    );
    const countWhere = (test: (particle: Particle) => boolean): number => alive.filter(test).length;
    context.numeric.set(`${record}.particleCount`, alive.length);
    context.numeric.set(
      `${record}.chargedCount`,
      countWhere((particle) => particle.spec.electricChargeInElementaryUnits !== 0),
    );
    context.numeric.set(
      `${record}.hadronCount`,
      countWhere(
        (particle) => particle.spec.family === 'meson' || particle.spec.family === 'baryon',
      ),
    );
    context.numeric.set(`${record}.photonCount`, counts.get('photon') ?? 0);
    context.numeric.set(`${record}.hadronic`, alive.some(isHadronic) ? 1 : 0);
    context.reportedRecords.forEach((reported) => {
      if (reported.startsWith(`${record}.count.`)) {
        context.numeric.set(reported, 0);
      }
    });
    PARTICLE_NAMES.forEach((name) =>
      context.numeric.set(`${record}.count.${name}`, counts.get(name) ?? 0),
    );
    const symbolCounts = new Map<string, number>();
    counts.forEach((count, name) => {
      if (name.includes(':')) {
        const symbol = particleSpec(name).symbol;
        symbolCounts.set(symbol, (symbolCounts.get(symbol) ?? 0) + count);
      }
    });
    symbolCounts.forEach((count, symbol) =>
      context.numeric.set(`${record}.count.${symbol}`, count),
    );
    [...context.particles.entries()]
      .filter(([, particle]) => particle.status === 'alive' && !isHadronic(particle))
      .forEach(([label, particle]) =>
        Object.entries(objectReadings(particle)).forEach(([field, value]) =>
          context.numeric.set(`${record}.${label}.${field}`, value),
        ),
      );
  }

  private annihilationPairs(
    context: ShotContext,
    targets: readonly string[] | undefined,
  ): readonly AnnihilationPair[] {
    const eligible = [...context.spatial.keys()].filter(
      (label) =>
        (targets === undefined || targets.includes(label)) &&
        context.particle(label).status === 'alive',
    );
    const electrons = eligible.filter((label) => context.particle(label).spec.name === 'electron');
    const positrons = eligible.filter((label) => context.particle(label).spec.name === 'positron');
    return electrons.flatMap((electron, index) => {
      const positron = positrons[index];
      return positron === undefined ? [] : [{ electron, positron }];
    });
  }

  private pairRate(space: ResolvedSpace, context: ShotContext, pair: AnnihilationPair): number {
    const electronState = context.spatial.get(pair.electron);
    const positronState = context.spatial.get(pair.positron);
    if (electronState === undefined || positronState === undefined) {
      return 0;
    }
    return this.engine.annihilation.ratePerSecond(
      space,
      context.particle(pair.electron),
      electronState,
      context.particle(pair.positron),
      positronState,
    );
  }

  private maybeAnnihilate(
    context: ShotContext,
    pair: AnnihilationPair,
    integratedRate: number,
  ): void {
    const electron = context.particle(pair.electron);
    const positron = context.particle(pair.positron);
    if (
      electron.status !== 'alive' ||
      positron.status !== 'alive' ||
      !this.engine.annihilation.happens(integratedRate)
    ) {
      return;
    }
    const event = this.engine.annihilation.annihilate(electron, positron);
    let ordinal = 1;
    const prefix = (): string =>
      ordinal === 1 ? ANNIHILATION_LABEL : `${ANNIHILATION_LABEL}${String(ordinal)}`;
    while (context.particles.has(`${prefix()}.0`)) {
      ordinal += 1;
    }
    const label = prefix();
    event.products.forEach((product, index) =>
      context.add(`${label}.${String(index)}`, product.particle, [electron, positron]),
    );
    context.spatial.delete(pair.electron);
    context.spatial.delete(pair.positron);
  }

  private create(step: Extract<CompiledStep, { operation: 'create' }>, context: ShotContext): void {
    (step.members ?? [step.label]).forEach((member) => this.createOne(step, member, context));
  }

  private createOne(
    step: Extract<CompiledStep, { operation: 'create' }>,
    label: string,
    context: ShotContext,
  ): void {
    const particle = this.engine.particles.create(step.particle, {
      ...(step.momentumInGev === undefined ? {} : { momentumInGev: step.momentumInGev }),
      ...(step.positionInFemtometers === undefined
        ? {}
        : { positionInFemtometers: step.positionInFemtometers }),
    });
    context.particles.set(label, particle);
    const spin = step.spinDirection ?? step.spin;
    if (spin !== undefined) {
      const directional = directionalObservableOf(particle.spec);
      if (directional === null) {
        throw new LocalizedError(
          localizedText(
            `у ${step.particle} спин 0: готовить нечего, нет ни спина, ни поляризации`,
            `${step.particle} has spin 0: there is no spin or polarization to prepare`,
          ),
        );
      }
      this.engine.quantum.prepare(particle, directional, spin);
    }
    if (particle.spec.family === 'neutrino') {
      this.engine.quantum.prepare(
        particle,
        'flavor',
        FLAVOR_NAMES.indexOf(leptonFlavorOf(particle.spec)),
      );
    }
  }

  private createMatter(
    step: Extract<CompiledStep, { operation: MatterStep['operation'] }>,
    context: ShotContext,
  ): void {
    (step.members ?? [step.label]).forEach((member) => this.createMatterOne(step, member, context));
  }

  private createMatterOne(
    step: Extract<CompiledStep, { operation: MatterStep['operation'] }>,
    label: string,
    context: ShotContext,
  ): void {
    const particle = this.engine.particles.create(matterStepName(step), {
      ...(step.momentumInGev === undefined ? {} : { momentumInGev: step.momentumInGev }),
      ...(step.positionInFemtometers === undefined
        ? {}
        : { positionInFemtometers: step.positionInFemtometers }),
    });
    context.particles.set(label, particle);
    if (particle instanceof Molecule) {
      particle.internalTemperatureInKelvin =
        context.environment.get('temperature')?.temperatureInKelvin ??
        context.environment.get('medium')?.temperatureInKelvin ??
        0;
    }
    if (step.operation === 'createAtom' && step.spin !== undefined) {
      const directional = directionalObservableOf(particle.spec);
      if (directional !== null) {
        this.engine.quantum.prepare(particle, directional, step.spin);
      }
    }
  }

  private decay(step: Extract<CompiledStep, { operation: 'decay' }>, context: ShotContext): void {
    const parent = context.particle(step.target);
    const event = this.engine.decays.decayAfterSampledTime(parent, context.environmentFor(parent));
    const record = step.record ?? `${step.target}.decay`;
    const throughStrings = event.channel.products.some(
      (product) =>
        product in PARTICLE_CATALOG && particleSpec(product as ParticleName).family === 'quark',
    );
    context.categorical.set(
      record,
      (throughStrings
        ? event.channel.products
        : event.products.map((product) => product.name)
      ).join('+'),
    );
    context.numeric.set(`${record}.properTimeInSeconds`, event.properTimeInSeconds ?? Number.NaN);
    context.numeric.set(`${record}.labTimeInSeconds`, event.labTimeInSeconds ?? Number.NaN);
    context.numeric.set(`${record}.decayLengthInMeters`, event.decayLengthInMeters ?? Number.NaN);
    event.products.forEach((product, index) => {
      if (product.fourMomentumInGev !== null) {
        context.numeric.set(
          `${record}.product[${String(index)}].energyInGev`,
          product.fourMomentumInGev.energy,
        );
      }
      if (product.particle !== null) {
        context.add(`${step.target}.${String(index)}`, product.particle, [parent]);
        if (
          context.hadronic.has(parent.id) ||
          (throughStrings && product.particle.spec.family === 'meson')
        ) {
          context.hadronic.add(product.particle.id);
        }
      }
    });
  }

  private requireSpace(context: ShotContext): ResolvedSpace {
    if (context.space === null) {
      throw new Error('This plan has no space');
    }
    return context.space;
  }

  private collide(
    step: Extract<CompiledStep, { operation: 'collide' }>,
    context: ShotContext,
  ): void {
    const [firstLabel, secondLabel] = step.targets;
    if (firstLabel === undefined || secondLabel === undefined) {
      throw new Error('collide needs two targets');
    }
    const event = this.engine.collisions.collide(
      context.particle(firstLabel),
      context.particle(secondLabel),
      step.channel,
      step.minimumTransverseMomentumInGev === undefined
        ? {}
        : { minimumTransverseMomentumInGev: step.minimumTransverseMomentumInGev },
    );
    const hardProducts = event.partonic === undefined ? event.products : event.products.slice(0, 2);
    context.categorical.set(step.record, hardProducts.map((product) => product.name).join('+'));
    context.numeric.set(`${step.record}.sqrtSInGev`, event.centerOfMassEnergyInGev);
    if (event.partonic !== undefined) {
      context.categorical.set(`${step.record}.partons`, event.partonic.partons.join('+'));
      context.numeric.set(
        `${step.record}.firstMomentumFraction`,
        event.partonic.firstMomentumFraction,
      );
      context.numeric.set(
        `${step.record}.secondMomentumFraction`,
        event.partonic.secondMomentumFraction,
      );
      context.numeric.set(`${step.record}.hardEnergyInGev`, event.partonic.hardEnergyInGev);
      context.numeric.set(
        `${step.record}.transverseMomentumInGev`,
        event.partonic.transverseMomentumInGev,
      );
    }
    context.collisionDiagrams.set(step.record, event.diagrams);
    context.numeric.set(
      `${step.record}.crossSectionInNanobarns`,
      event.totalCrossSectionInNanobarns,
    );
    context.numeric.set(`${step.record}.cosThetaStar`, event.cosineInCenterOfMass);
    const restEnergies = [context.particle(firstLabel), context.particle(secondLabel)].reduce(
      (sum, particle) => sum + particle.spec.massInGev.value,
      0,
    );
    context.numeric.set(
      `${step.record}.kineticEnergyInKev`,
      (event.centerOfMassEnergyInGev - restEnergies) * KEV_PER_GEV,
    );
    event.products.forEach((product, index) => {
      context.numeric.set(
        `${step.record}.product[${String(index)}].energyInGev`,
        product.fourMomentumInGev.energy,
      );
      context.numeric.set(
        `${step.record}.product[${String(index)}].kineticEnergyInKev`,
        (product.fourMomentumInGev.energy - product.particle.spec.massInGev.value) * KEV_PER_GEV,
      );
      context.add(`${step.record}.${String(index)}`, product.particle, [
        context.particle(firstLabel),
        context.particle(secondLabel),
      ]);
    });
  }

  private releaseRegisters(context: ShotContext): void {
    const registerIds = new Set<string>();
    context.particles.forEach((particle) => {
      particle.quantumSlots.forEach((slot) => registerIds.add(slot.registerId));
    });
    registerIds.forEach((registerId) => {
      this.engine.quantum.registers.dispose(this.engine.quantum.registers.byId(registerId));
    });
  }
}
