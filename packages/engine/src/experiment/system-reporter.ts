/* SystemReporter: shot observer that records a non-destructive snapshot of the whole system after every step: particles, kinematics, reduced quantum states, entanglement, environment, events and conserved totals.
   A molecule the catalogue knows by its bond graph carries its catalogue name, and events name it by that name. */
import {
  keyframeRecord,
  type KeyframeWatch,
  ENTANGLED_STATES,
  localizedText,
  textIn,
  type ConservedTotals,
  type ExperimentStep,
  type LocalizedText,
  type OutcomeProbabilityView,
  type Particle,
  type ParticleView,
  type QuantumSlotView,
  type RegisterState,
  type SpaceSnapshot,
  type SystemEvent,
  type SystemFrame,
  type SystemReport,
} from '@standard-model/contracts';
import { catalogMoleculeOf } from '@standard-model/constants';
import type { Engine } from '../index.js';
import { objectReadings } from './object-measurements.js';
import { DensityMatrix } from '../quantum/density-matrix.js';
import { ENTANGLED_STATE_DIMENSION, entangledState } from '../quantum/entangled-states.js';
import { entryAt } from '../quantum/linear-algebra.js';
import { HADRONIZATION_TIME_IN_SECONDS } from '../particles/hadronization.js';
import {
  phaseText,
  PHASE_ESTIMATE_NAMES,
  type PhaseVerdict,
  hasAggregateState,
  idealGasPressureInPascals,
  mediumPhase,
} from '../environment/aggregate-state.js';
import type { QuantumRegister } from '../quantum/quantum-register.js';
import type { ShotContext, ShotObserver } from './experiment-runner.js';
import type { CompiledStep } from './plan-compiler.js';

const MATTER_FAMILIES: ReadonlySet<string> = new Set(['nucleus', 'atom', 'molecule']);

function speciesTitle(particle: Particle | undefined, language: keyof LocalizedText): string {
  const known = particle === undefined ? null : catalogMoleculeOf(particle.spec.name);
  return known === null ? (particle?.spec.symbol ?? '') : known[language];
}

function groupRange(members: readonly string[]): string {
  return `${members[0] ?? ''}…${members[members.length - 1] ?? ''}`;
}

const CREATED_KIND: Readonly<
  Record<'createNucleus' | 'createAtom' | 'createMolecule', LocalizedText>
> = {
  createNucleus: localizedText('создано ядро', 'created nucleus'),
  createAtom: localizedText('создан атом', 'created atom'),
  createMolecule: localizedText('создана молекула', 'created molecule'),
};

const MAXIMUM_REPORTED_REGISTER_DIMENSION = 16;
const ENTANGLEMENT_THRESHOLD_IN_BITS = 1e-9;
const PRECISION_DIGITS = 10;
const PRODUCT_LABEL = /^(.+)\.(\d+)$/;
const ANNIHILATION_PRODUCT = /^annihilation\d*\.\d+$/;
const COMPOSITION_SEPARATOR = /\+(?!\+|$)/;
const LISTED_CASCADE_DECAYS = 12;
const KEYFRAME_DIGITS = 6;
const SYSTEM_TOKEN_NAMES: Readonly<Record<string, LocalizedText>> = {
  hadrons: localizedText('адроны', 'hadrons'),
  jet: localizedText('струя', 'jet'),
};

function round(value: number): number {
  return Number(value.toPrecision(PRECISION_DIGITS));
}

function formatNumber(value: number): string {
  return Number(value.toPrecision(4)).toString();
}

function crossSectionText(crossSection: number | undefined): LocalizedText {
  if (crossSection === undefined) {
    return localizedText('σ = —', 'σ = —');
  }
  if (!Number.isFinite(crossSection)) {
    return localizedText(
      'σ → ∞ (пара в покое: расходится σ, а скорость реакции σv конечна)',
      'σ → ∞ (a pair at rest: σ diverges, while the reaction rate σv is finite)',
    );
  }
  return localizedText(
    `σ = ${formatNumber(crossSection)} нб`,
    `σ = ${formatNumber(crossSection)} nb`,
  );
}

function keyframeReading(name: string, watch: KeyframeWatch, context: ShotContext): string {
  const value = context.numeric.get(keyframeRecord(name, watch));
  return `${watch.target}.${watch.quantity} = ${value === undefined ? '—' : value.toPrecision(KEYFRAME_DIGITS)}`;
}

export class SystemReporter implements ShotObserver {
  private reportedHadronizations = 0;
  private reportedCascades = 0;
  private reportedReactions = 0;
  private readonly phases = new Map<string, PhaseVerdict>();
  private readonly frames: SystemFrame[] = [];
  private pendingProbabilities: readonly OutcomeProbabilityView[] | null = null;
  private knownLabels = new Set<string>();

  constructor(
    private readonly engine: Engine,
    private readonly seed: number,
  ) {
    this.frames.push({
      stepIndex: -1,
      step: null,
      particles: [],
      environment: {},
      regions: [],
      events: [],
      space: null,
      totals: {
        chargeInElementaryUnits: 0,
        baryonNumber: 0,
        electronNumber: 0,
        muonNumber: 0,
        tauNumber: 0,
        energyInGev: 0,
        momentumInGev: { x: 0, y: 0, z: 0 },
      },
    });
  }

  beforeStep(stepIndex: number, step: CompiledStep, context: ShotContext): void {
    this.pendingProbabilities = null;
    if (step.operation !== 'measure') {
      return;
    }
    const particle = context.particles.get(step.target);
    if (particle === undefined || particle.quantumSlot(step.observable) === null) {
      return;
    }
    this.pendingProbabilities = this.engine.quantum
      .probabilities(particle, step.observable, step.axis)
      .map((outcome) => ({
        eigenvalue: round(outcome.eigenvalue),
        probability: round(outcome.probability),
      }));
  }

  afterStep(stepIndex: number, step: CompiledStep, context: ShotContext): void {
    const particles = [...context.particles.entries()].map(([label, particle]) =>
      this.view(label, particle, context),
    );
    const environment: Record<string, unknown> = {};
    context.environment.aspectKeys.forEach((key) => {
      environment[key] = context.environment.get(key);
    });
    const labelOf = new Map(
      [...context.particles.entries()].map(([label, particle]) => [particle.id, label]),
    );
    const regions = context.regions
      .map((region) => ({
        id: region.id,
        aspect: region.aspect,
        value: region.value,
        members: [...region.members]
          .filter((id) => context.particles.get(labelOf.get(id) ?? '')?.status === 'alive')
          .map((id) => labelOf.get(id) ?? id),
      }))
      .filter((region) => region.members.length > 0);
    this.frames.push({
      stepIndex,
      step: step as ExperimentStep,
      particles,
      environment,
      environmentOrder: context.environment.aspectKeys,
      regions,
      events: this.events(step, context),
      totals: this.totals(particles, context),
      space: this.space(context),
      ...(context.precursors.length === 0 ? {} : { pendingNeutrons: context.precursors.length }),
    });
    this.knownLabels = new Set(context.particles.keys());
  }

  report(): SystemReport {
    return {
      seed: this.seed,
      note: localizedText(
        'Один представительный выстрел с тем же seed. Снимки после каждого шага читают состояние, не разрушая его; коллапс происходит только на шагах measure.',
        'One representative shot with the same seed. The snapshots after each step read the state without disturbing it; collapse happens only at measure steps.',
      ),
      frames: this.frames,
    };
  }

  private view(label: string, particle: Particle, context: ShotContext): ParticleView {
    const fourMomentum = particle.kinematics.fourMomentumInGev;
    const mass = particle.spec.massInGev.value;
    const medium = context.environmentFor(particle).get('medium');
    const verdict =
      medium !== undefined && particle.status === 'alive' && hasAggregateState(particle.spec.name)
        ? mediumPhase(particle.spec.name, medium)
        : null;
    const known = catalogMoleculeOf(particle.spec.name);
    return {
      label,
      id: particle.id,
      name: particle.spec.name,
      symbol: particle.spec.symbol,
      ...(known === null ? {} : { catalogName: localizedText(known.ru, known.en) }),
      family: particle.spec.family,
      status: particle.status,
      massInGev: mass,
      chargeInElementaryUnits: particle.spec.electricChargeInElementaryUnits,
      energyInGev: round(fourMomentum.energy),
      momentumInGev: {
        x: round(fourMomentum.momentum.x),
        y: round(fourMomentum.momentum.y),
        z: round(fourMomentum.momentum.z),
      },
      positionInFemtometers: particle.kinematics.positionInFemtometers,
      properTimeInSeconds: particle.kinematics.properTimeInSeconds,
      lorentzFactor: mass > 0 ? round(fourMomentum.energy / mass) : null,
      quantum: [...particle.quantumSlots.values()].map((slot) =>
        this.slotView(particle, slot.observable, context),
      ),
      ...(MATTER_FAMILIES.has(particle.spec.family) && particle.status === 'alive'
        ? { readings: objectReadings(particle) }
        : {}),
      ...(verdict === null ? {} : { phase: verdict.phase, phaseEstimated: verdict.estimated }),
      ...(verdict?.estimateMethod === undefined
        ? {}
        : { phaseEstimateMethod: verdict.estimateMethod }),
      ...(verdict?.allotrope === undefined ? {} : { allotrope: verdict.allotrope }),
    };
  }

  private slotView(
    particle: Particle,
    observable: QuantumSlotView['observable'],
    context: ShotContext,
  ): QuantumSlotView {
    const register = this.engine.quantum.registers.registerOf(particle, observable);
    const slotIndex = register.slotIndexOf(particle.id, observable);
    const reduced = DensityMatrix.fromPureState(register.state).partialTrace(
      register.dimensions,
      slotIndex,
    );
    const entropyInBits = reduced.vonNeumannEntropy() / Math.LN2;
    const dimension = reduced.dimension;
    const populations = Array.from({ length: dimension }, (ignored, index) =>
      round(entryAt(reduced.matrix, index, index).real),
    );
    const offDiagonal = entryAt(reduced.matrix, 0, 1);
    const entangled = entropyInBits > ENTANGLEMENT_THRESHOLD_IN_BITS;
    return {
      observable,
      dimension,
      registerId: register.id,
      sharesRegisterWith: register.slots
        .filter((slot) => slot.particleId !== particle.id)
        .map((slot) => context.labelOf(slot.particleId) ?? slot.particleId),
      entangled,
      purity: round(reduced.purity()),
      entropyInBits: round(Math.max(entropyInBits, 0)),
      blochVector:
        dimension === 2
          ? {
              x: round(2 * offDiagonal.real),
              y: round(-2 * offDiagonal.imaginary),
              z: round((populations[0] ?? 0) - (populations[1] ?? 0)),
            }
          : null,
      basisPopulations: populations,
      registerState:
        entangled && register.dimension <= MAXIMUM_REPORTED_REGISTER_DIMENSION
          ? this.registerState(register, context)
          : null,
    };
  }

  private registerState(register: QuantumRegister, context: ShotContext): RegisterState {
    const amplitudes = Array.from({ length: register.dimension }, (ignored, index) =>
      register.state.amplitude(index),
    );
    const closest =
      register.dimension === ENTANGLED_STATE_DIMENSION
        ? ENTANGLED_STATES.map((name) => ({
            name,
            fidelity: register.state.fidelityWith(entangledState(name)),
          })).reduce((best, candidate) => (candidate.fidelity > best.fidelity ? candidate : best))
        : null;
    return {
      slots: register.slots.map((slot) => context.labelOf(slot.particleId) ?? slot.particleId),
      real: amplitudes.map((amplitude) => round(amplitude.real)),
      imaginary: amplitudes.map((amplitude) => round(amplitude.imaginary)),
      closestNamedState: closest?.name ?? null,
      closestNamedStateFidelity: closest === null ? null : round(closest.fidelity),
    };
  }

  private space(context: ShotContext): SpaceSnapshot | null {
    const space = context.space;
    if (space === null) {
      return null;
    }
    return {
      gridPointsPerAxis: space.gridPointsPerAxis,
      cellSizeInMeters: space.cellSizeInMeters,
      edgeInMeters: space.gridPointsPerAxis * space.cellSizeInMeters,
      potential: space.potential,
      potentialEnergyInEv: space.potentialEnergyInEv,
      barrierThicknessInMeters: space.barrierThicknessInMeters,
      nuclearCharge: space.nuclearCharge,
      slitSeparationInMeters: space.slitSeparationInMeters,
      slitWidthInMeters: space.slitWidthInMeters,
      wellSeparationInMeters: space.wellSeparationInMeters,
      boxSizeInMeters: space.boxSizeInMeters,
      walls: space.walls ?? 'open',
      clouds: [...context.spatial.entries()].map(([label, state]) =>
        this.engine.space.cloud(space, state, label),
      ),
    };
  }

  private hadronizations(context: ShotContext): readonly SystemEvent[] {
    const fresh = context.hadronizations.slice(this.reportedHadronizations);
    this.reportedHadronizations = context.hadronizations.length;
    const label = (id: string): string => context.labelOf(id) ?? id;
    return fresh.flatMap((result) => [
      ...result.baryons.map((baryon): SystemEvent => {
        const quarks = baryon.constituents.map((quark) => label(quark.id));
        const hadron = label(baryon.hadron.id);
        return {
          kind: 'hadronized',
          labels: [...quarks, hadron],
          products: [hadron],
          text: localizedText(
            `${baryon.constituents.map((quark) => quark.spec.symbol).join(' ')} → ${baryon.hadron.spec.symbol}: конфайнмент за ħ/Λ_QCD ≈ ${formatNumber(HADRONIZATION_TIME_IN_SECONDS)} с собрал бесцветный барион; ${formatNumber(baryon.fieldEnergyInGev)} ГэВ массы взято из энергии глюонного поля`,
            `${baryon.constituents.map((quark) => quark.spec.symbol).join(' ')} → ${baryon.hadron.spec.symbol}: confinement within ħ/Λ_QCD ≈ ${formatNumber(HADRONIZATION_TIME_IN_SECONDS)} s built a colorless baryon; ${formatNumber(baryon.fieldEnergyInGev)} GeV of its mass came from the gluon field energy`,
          ),
        };
      }),
      ...result.strings.map((string): SystemEvent => {
        const hadrons = string.hadrons.map((hadron) => label(hadron.id));
        const partons = string.partons.map((parton) => parton.spec.symbol).join(' ');
        const symbols = string.hadrons.map((hadron) => hadron.spec.symbol).join(', ');
        return {
          kind: 'hadronized',
          labels: [...string.partons.map((parton) => label(parton.id)), ...hadrons],
          products: hadrons,
          text:
            string.hadrons.length === 1
              ? localizedText(
                  `${partons} → ${symbols}: струна массой ${formatNumber(string.stringMassInGev)} ГэВ легче двух адронов и схлопнулась в один мезон, ${formatNumber(string.fieldEnergyInGev)} ГэВ взято из энергии поля`,
                  `${partons} → ${symbols}: a string of mass ${formatNumber(string.stringMassInGev)} GeV is lighter than two hadrons and collapsed into one meson, ${formatNumber(string.fieldEnergyInGev)} GeV came from the field energy`,
                )
              : localizedText(
                  `${partons} → струна Лунда массой ${formatNumber(string.stringMassInGev)} ГэВ порвалась на мезоны (${String(string.hadrons.length)}): ${symbols}`,
                  `${partons} → a Lund string of mass ${formatNumber(string.stringMassInGev)} GeV broke into mesons (${String(string.hadrons.length)}): ${symbols}`,
                ),
        };
      }),
      ...(result.jets.length === 0
        ? []
        : [
            {
              kind: 'hadronized' as const,
              labels: result.jets.map((jet) => label(jet.parton.id)),
              text: localizedText(
                `${result.jets.map((jet) => jet.parton.spec.symbol).join(', ')} → струя: цвету не нашлось партнера, чтобы стать бесцветным, унесено ${formatNumber(result.jets.reduce((sum, jet) => sum + jet.energyInGev, 0))} ГэВ`,
                `${result.jets.map((jet) => jet.parton.spec.symbol).join(', ')} → jet: the color found no partner to become colorless, ${formatNumber(result.jets.reduce((sum, jet) => sum + jet.energyInGev, 0))} GeV carried away`,
              ),
            },
          ]),
    ]);
  }

  private phaseChanges(context: ShotContext): readonly SystemEvent[] {
    return [...context.particles.entries()].flatMap(([label, particle]) => {
      const medium = context.environmentFor(particle).get('medium');
      if (
        particle.status !== 'alive' ||
        medium === undefined ||
        !hasAggregateState(particle.spec.name)
      ) {
        return [];
      }
      const verdict = mediumPhase(particle.spec.name, medium);
      const previous = this.phases.get(label);
      if (previous?.phase === verdict.phase && previous.allotrope === verdict.allotrope) {
        return [];
      }
      this.phases.set(label, verdict);
      const pressure =
        medium.pressureInPascals ??
        idealGasPressureInPascals(medium.components, medium.temperatureInKelvin);
      const conditions = localizedText(
        `при ${formatNumber(medium.temperatureInKelvin)} К и ${formatNumber(pressure)} Па`,
        `at ${formatNumber(medium.temperatureInKelvin)} K and ${formatNumber(pressure)} Pa`,
      );
      const method =
        verdict.estimateMethod === undefined ? null : PHASE_ESTIMATE_NAMES[verdict.estimateMethod];
      const basis =
        method === null
          ? localizedText('', '')
          : localizedText(` (${method.ru})`, ` (${method.en})`);
      const now = phaseText(verdict);
      const transition =
        previous === undefined
          ? now
          : localizedText(
              `${textIn(phaseText(previous), 'ru')} → ${textIn(now, 'ru')}`,
              `${textIn(phaseText(previous), 'en')} → ${textIn(now, 'en')}`,
            );
      return [
        {
          kind: 'phaseChanged',
          labels: [label],
          text: localizedText(
            `${label}: ${speciesTitle(particle, 'ru')} ${textIn(conditions, 'ru')} — ${textIn(transition, 'ru')}${textIn(basis, 'ru')}`,
            `${label}: ${speciesTitle(particle, 'en')} ${textIn(conditions, 'en')} — ${textIn(transition, 'en')}${textIn(basis, 'en')}`,
          ),
        },
      ];
    });
  }

  private reactions(context: ShotContext): readonly SystemEvent[] {
    const fresh = context.reactions.slice(this.reportedReactions);
    this.reportedReactions = context.reactions.length;
    const label = (id: string): string => context.labelOf(id) ?? id;
    return fresh.map((reaction) => {
      const products = reaction.products.map((product) => label(product.id));
      return {
        kind: 'reacted',
        labels: [label(reaction.parent.id), ...products],
        products,
        text: localizedText(
          `${label(reaction.parent.id)}: ${textIn(reaction.label, 'ru')} → ${reaction.products.map((product) => speciesTitle(product, 'ru')).join(' + ')}`,
          `${label(reaction.parent.id)}: ${textIn(reaction.label, 'en')} → ${reaction.products.map((product) => speciesTitle(product, 'en')).join(' + ')}`,
        ),
      };
    });
  }

  private cascades(context: ShotContext): readonly SystemEvent[] {
    const fresh = context.cascades.slice(this.reportedCascades);
    this.reportedCascades = context.cascades.length;
    if (fresh.length === 0) {
      return [];
    }
    const label = (id: string): string => context.labelOf(id) ?? id;
    const products = fresh.flatMap(({ event }) =>
      event.products.flatMap((product) =>
        product.particle === null ? [] : [label(product.particle.id)],
      ),
    );
    const listed = fresh
      .slice(0, LISTED_CASCADE_DECAYS)
      .map(
        ({ event }) =>
          `${event.parent.spec.symbol} → ${event.products.map((product) => (product.particle === null ? product.name : product.particle.spec.symbol)).join(' ')}`,
      );
    const more = fresh.length - listed.length;
    return [
      {
        kind: 'decayed',
        labels: [...fresh.map(({ event }) => label(event.parent.id)), ...products],
        products,
        text: localizedText(
          `распады адронов за это время: ${listed.join('; ')}${more > 0 ? `; и еще ${String(more)}` : ''}`,
          `hadron decays in this time: ${listed.join('; ')}${more > 0 ? `; and ${String(more)} more` : ''}`,
        ),
      },
    ];
  }

  private annihilations(context: ShotContext): readonly SystemEvent[] {
    const products = [...context.particles.keys()].filter(
      (label) => ANNIHILATION_PRODUCT.test(label) && !this.knownLabels.has(label),
    );
    if (products.length === 0) {
      return [];
    }
    const sources = [...context.particles.entries()]
      .filter(
        ([label, particle]) =>
          particle.status === 'collided' &&
          this.frames
            .at(-1)
            ?.particles.some((view) => view.label === label && view.status === 'alive'),
      )
      .map(([label]) => label);
    return [
      {
        kind: 'annihilated',
        labels: [...sources, ...products],
        products,
        text: localizedText(
          `${sources.join(' и ')} аннигилировали в два фотона по 511 кэВ: облака перекрылись, синглетная часть спинов ушла в γγ`,
          `${sources.join(' and ')} annihilated into two 511 keV photons: the clouds overlapped, the singlet part of the spins went into γγ`,
        ),
      },
    ];
  }

  private events(step: CompiledStep, context: ShotContext): readonly SystemEvent[] {
    switch (step.operation) {
      case 'collide': {
        const channel = context.categorical.get(step.record) ?? '';
        const energy = context.numeric.get(`${step.record}.sqrtSInGev`);
        const crossSection = context.numeric.get(`${step.record}.crossSectionInNanobarns`);
        const products = [...context.particles.keys()].filter(
          (label) => label.startsWith(`${step.record}.`) && !this.knownLabels.has(label),
        );
        return [
          {
            kind: 'collided',
            labels: [...step.targets, ...products],
            products,
            diagrams: context.collisionDiagrams.get(step.record) ?? [],
            text: localizedText(
              `${step.targets.join(' и ')} столкнулись при √s = ${energy === undefined ? '—' : formatNumber(energy)} ГэВ, ${crossSectionText(crossSection).ru} → ${channel.split('+').join(', ')}`,
              `${step.targets.join(' and ')} collided at √s = ${energy === undefined ? '—' : formatNumber(energy)} GeV, ${crossSectionText(crossSection).en} → ${channel.split('+').join(', ')}`,
            ),
          },
        ];
      }
      case 'place':
        return [
          {
            kind: 'placed',
            labels: [step.target],
            text: localizedText(
              `${step.target} помещен в куб: ${step.shape === 'groundState' ? 'основное состояние' : `гауссов пакет шириной ${formatNumber(step.widthInMeters)} м`}`,
              `${step.target} placed in the cube: ${step.shape === 'groundState' ? 'ground state' : `Gaussian packet of width ${formatNumber(step.widthInMeters)} m`}`,
            ),
          },
        ];
      case 'propagate':
        return [
          {
            kind: 'propagated',
            labels: [...context.spatial.keys()],
            text: localizedText(
              `волновые функции эволюционировали ${formatNumber(step.durationInSeconds)} с`,
              `wave functions evolved for ${formatNumber(step.durationInSeconds)} s`,
            ),
          },
          ...this.annihilations(context),
          ...this.reactions(context),
          ...this.hadronizations(context),
          ...this.cascades(context),
        ];
      case 'measureSystem': {
        const content = context.categorical.get(step.record) ?? 'empty';
        return [
          {
            kind: 'systemMeasured',
            labels: [],
            text:
              content === 'empty'
                ? localizedText('в системе не осталось частиц', 'no particles left in the system')
                : localizedText(
                    `в системе: ${content
                      .split(COMPOSITION_SEPARATOR)
                      .map((token) => SYSTEM_TOKEN_NAMES[token]?.ru ?? token)
                      .join(', ')}`,
                    `in the system: ${content
                      .split(COMPOSITION_SEPARATOR)
                      .map((token) => SYSTEM_TOKEN_NAMES[token]?.en ?? token)
                      .join(', ')}`,
                  ),
          },
        ];
      }
      case 'keyframe':
        return [
          {
            kind: 'keyframe',
            labels: step.watch.flatMap((watch) =>
              context.particles.has(watch.target) ? [watch.target] : [],
            ),
            text: localizedText(
              `ключевой кадр ${step.name}: ${step.watch
                .map((watch) => keyframeReading(step.name, watch, context))
                .join(', ')}`,
              `keyframe ${step.name}: ${step.watch
                .map((watch) => keyframeReading(step.name, watch, context))
                .join(', ')}`,
            ),
          },
        ];
      case 'measurePosition': {
        const position = ['x', 'y', 'z'].map(
          (axis) => context.numeric.get(`${step.record}.${axis}`) ?? Number.NaN,
        );
        return [
          {
            kind: 'positionMeasured',
            labels: [step.target],
            text: localizedText(
              `${step.target} найден в точке (${position.map((value) => formatNumber(value)).join(', ')}) м, облако схлопнулось`,
              `${step.target} found at (${position.map((value) => formatNumber(value)).join(', ')}) m, the cloud collapsed`,
            ),
          },
        ];
      }
      case 'create': {
        const members = step.members ?? [step.label];
        return [
          {
            kind: 'created',
            labels: [...members],
            text:
              members.length > 1
                ? localizedText(
                    `создана группа ${step.label}: ${String(members.length)} × ${step.particle}, ${groupRange(members)}`,
                    `created group ${step.label}: ${String(members.length)} × ${step.particle}, ${groupRange(members)}`,
                  )
                : localizedText(
                    `создана частица ${step.label}: ${step.particle}${step.spin === undefined ? '' : `, спин ${step.spin}`}`,
                    `created particle ${step.label}: ${step.particle}${step.spin === undefined ? '' : `, spin ${step.spin}`}`,
                  ),
          },
        ];
      }
      case 'createNucleus':
      case 'createAtom':
      case 'createMolecule': {
        const members = step.members ?? [step.label];
        const particle = context.particles.get(members[0] ?? step.label);
        const russian = speciesTitle(particle, 'ru');
        const english = speciesTitle(particle, 'en');
        return [
          {
            kind: 'created',
            labels: [...members],
            text:
              members.length > 1
                ? localizedText(
                    `создана группа ${step.label}: ${String(members.length)} × ${russian}, ${groupRange(members)}`,
                    `created group ${step.label}: ${String(members.length)} × ${english}, ${groupRange(members)}`,
                  )
                : localizedText(
                    `${CREATED_KIND[step.operation].ru} ${step.label}: ${russian}`,
                    `${CREATED_KIND[step.operation].en} ${step.label}: ${english}`,
                  ),
          },
        ];
      }
      case 'entangle':
        return [
          {
            kind: 'entangled',
            labels: [...step.targets],
            text: localizedText(
              `${step.targets.join(' и ')} запутаны в состоянии ${step.state}`,
              `${step.targets.join(' and ')} entangled in the state ${step.state}`,
            ),
          },
        ];
      case 'influence':
        return [
          {
            kind: 'influenced',
            labels: [...(step.targets ?? [])],
            text: localizedText(
              `воздействие ${step.influence}${step.targets === undefined ? ' на всю систему' : ` на ${step.targets.join(', ')}`}`,
              `influence ${step.influence}${step.targets === undefined ? ' on the whole system' : ` on ${step.targets.join(', ')}`}`,
            ),
          },
          ...this.reactions(context),
          ...this.phaseChanges(context),
        ];
      case 'evolve':
        return [
          {
            kind: 'evolved',
            labels: [...(step.targets ?? [])],
            text: localizedText(
              `эволюция ${formatNumber(step.durationInSeconds)} с`,
              `evolution for ${formatNumber(step.durationInSeconds)} s`,
            ),
          },
          ...this.annihilations(context),
          ...this.reactions(context),
          ...this.hadronizations(context),
          ...this.cascades(context),
          ...this.phaseChanges(context),
        ];
      case 'measure': {
        const outcome = context.numeric.get(step.record);
        return [
          {
            kind: 'measured',
            labels: [step.target],
            text: localizedText(
              `измерен ${step.observable} у ${step.target}: ${outcome === undefined ? '—' : formatNumber(outcome)}`,
              `measured ${step.observable} of ${step.target}: ${outcome === undefined ? '—' : formatNumber(outcome)}`,
            ),
            ...(outcome === undefined ? {} : { outcome }),
            ...(this.pendingProbabilities === null
              ? {}
              : { probabilitiesBefore: this.pendingProbabilities }),
          },
        ];
      }
      case 'combine': {
        const composite = context.particles.get(step.label);
        return [
          {
            kind: 'combined',
            labels: [...step.targets, step.label],
            text: localizedText(
              `${step.targets.join(' + ')} связаны в ${step.label}${composite === undefined ? '' : ` (${composite.spec.name})`}`,
              `${step.targets.join(' + ')} bound into ${step.label}${composite === undefined ? '' : ` (${composite.spec.name})`}`,
            ),
          },
        ];
      }
      case 'diffract': {
        const position = context.numeric.get(step.record);
        return [
          {
            kind: 'diffracted',
            labels: [step.target],
            text: localizedText(
              `${step.target} прошел две щели и попал в экран на y = ${position === undefined ? '—' : formatNumber(position)} мкм`,
              `${step.target} passed the two slits and hit the screen at y = ${position === undefined ? '—' : formatNumber(position)} µm`,
            ),
            ...(position === undefined ? {} : { outcome: position }),
          },
        ];
      }
      case 'decay': {
        const products = [...context.particles.keys()].filter((label) => {
          const match = PRODUCT_LABEL.exec(label);
          return match !== null && match[1] === step.target && !this.knownLabels.has(label);
        });
        const channel = context.categorical.get(step.record ?? `${step.target}.decay`) ?? '';
        return [
          {
            kind: 'decayed',
            labels: [step.target, ...products],
            products,
            text: localizedText(
              `${step.target} распался: ${channel.split('+').join(', ')}`,
              `${step.target} decayed: ${channel.split('+').join(', ')}`,
            ),
          },
        ];
      }
    }
  }

  private totals(particles: readonly ParticleView[], context: ShotContext): ConservedTotals {
    const alive = particles.filter((view) => view.status === 'alive');
    const specOf = (label: string) => context.particles.get(label)?.spec;
    return alive.reduce<ConservedTotals>(
      (sum, view) => {
        const spec = specOf(view.label);
        return {
          chargeInElementaryUnits: round(
            sum.chargeInElementaryUnits + view.chargeInElementaryUnits,
          ),
          baryonNumber: round(sum.baryonNumber + (spec?.baryonNumber ?? 0)),
          electronNumber: sum.electronNumber + (spec?.leptonNumbers.electron ?? 0),
          muonNumber: sum.muonNumber + (spec?.leptonNumbers.muon ?? 0),
          tauNumber: sum.tauNumber + (spec?.leptonNumbers.tau ?? 0),
          energyInGev: round(sum.energyInGev + view.energyInGev),
          momentumInGev: {
            x: round(sum.momentumInGev.x + view.momentumInGev.x),
            y: round(sum.momentumInGev.y + view.momentumInGev.y),
            z: round(sum.momentumInGev.z + view.momentumInGev.z),
          },
        };
      },
      {
        chargeInElementaryUnits: 0,
        baryonNumber: 0,
        electronNumber: 0,
        muonNumber: 0,
        tauNumber: 0,
        energyInGev: 0,
        momentumInGev: { x: 0, y: 0, z: 0 },
      },
    );
  }
}
