/* SystemPlayer: plays the system report frame by frame: shots and a step bar on top, the stage on two thirds with entanglement links, momentum arrows and Bloch discs, and a scrolling side panel
   with the step told in words, the conserved totals, the environment and the particles; the cube of probability clouds below. */
import type {
  ParticleView,
  SystemEvent,
  SystemFrame,
  SystemReport,
} from '@standard-model/contracts';
import { SkipBack, SkipForward } from 'lucide-react';
import { api } from '../api';
import { SmlIcon } from './sml-icon';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { usePanZoom } from '../hooks/use-pan-zoom';
import { ZoomToolbar } from './zoom-toolbar';
import { OPERATION_TITLES } from '../glossary';
import { HINTS } from '../hints';
import { formatNumber, formatSymbol } from '../format';
import { OPERATION_ICONS, type OperationName } from '../icons';
import { describeStep } from '../plan-edits';
import { EnvironmentLayer, legendExtent } from './environment-layer';
import { InfluenceZone } from './influence-zone';
import { environmentBadges } from '../environment-envelopes';
import { SpaceView } from './space-view';
import { bodyAt } from '../cube-scene';
import { ParticleCard } from './particle-card';
import { ConservedTiles, StepCard } from './step-card';
import { EnvironmentSummary } from './environment-summary';
import { speciesFamilyResolver, speciesSymbolResolver } from '../species';
import {
  arrowLength,
  layoutStage,
  linkBundles,
  nodeRadius,
  particleGroups,
  type StageNode,
  type StageView,
  type StageViewport,
  envelopeBoxes,
} from '../system-stage';
import { bilingual, localize, say } from '../language';
import {
  magnitude,
  matterTitle,
  nodeCaption,
  slotTitle,
  spinSummary,
  temperatureText,
  vectorText,
} from '../particle-text';

const STAGE_WIDTH = 900;
const STAGE_HEIGHT = 650;
const OPEN_PARTICLE_CARDS = 3;
const STAGE_PADDING = 90;
const NODE_Y = STAGE_HEIGHT / 2;
const BLOCH_RADIUS = 17;
const STACK_OFFSET = 0.3;
const STACK_COINS = [2, 1];
const ENTANGLE_ARC = 60;
const ROW_MARGIN = 120;
const BUNDLE_BADGE_LIFT = 6;
const FRAME_MILLISECONDS = 1400;
const MINIMUM_ZOOM = 0.01;
const MAXIMUM_ZOOM = 3;
const GRID_CELL = 24;
const VIEWPORT: StageViewport = {
  width: STAGE_WIDTH,
  height: STAGE_HEIGHT,
  minimumZoom: MINIMUM_ZOOM,
  maximumZoom: MAXIMUM_ZOOM,
};

interface Camera extends StageView {
  readonly follow: boolean;
}

const SPLIT_TITLES: Readonly<Partial<Record<SystemEvent['kind'], string>>> = bilingual<string>({
  decayed: ['Распад', 'Decay'],
  collided: ['Столкновение', 'Collision'],
  annihilated: ['Аннигиляция', 'Annihilation'],
  reacted: ['Реакция', 'Reaction'],
});
const SLOT_BY = bilingual<string>({
  spin: ['спину', 'spin'],
  polarization: ['поляризации', 'polarization'],
  flavor: ['аромату', 'flavor'],
});
const STATUS_TEXT = bilingual<string>({
  decayed: ['выбыла: распад', 'gone: decayed'],
  bound: ['выбыла: связалась в составную', 'gone: bound into a composite'],
  collided: ['выбыла: столкновение или реакция', 'gone: collision or reaction'],
});
const SPLIT_CLASSES: Readonly<Partial<Record<SystemEvent['kind'], string>>> = {
  decayed: 'stage-decay',
  reacted: 'stage-react',
};

function nodeTooltip(view: ParticleView, leaving: boolean): string {
  const temperature = stageTemperature(view);
  return [
    `${view.label}: ${matterTitle(view)}${leaving ? `, ${STATUS_TEXT[view.status] ?? view.status}` : ''}`,
    say(
      `масса ${formatNumber(view.massInGev)} ГэВ, заряд ${formatNumber(view.chargeInElementaryUnits)} e`,
      `mass ${formatNumber(view.massInGev)} GeV, charge ${formatNumber(view.chargeInElementaryUnits)} e`,
    ),
    `E = ${formatNumber(view.energyInGev)} ${say('ГэВ', 'GeV')}, |p| = ${formatNumber(magnitude(view.momentumInGev))} ${say('ГэВ', 'GeV')}`,
    ...(temperature === null ? [] : [temperature]),
    ...view.quantum.map((slot) => `${slotTitle(slot)}: ${spinSummary(slot)}`),
  ].join(' · ');
}

function StageNodeView({
  node,
  frame,
  onToggle,
}: {
  readonly node: StageNode;
  readonly frame: SystemFrame;
  readonly onToggle: (group: string) => void;
}) {
  const { view } = node;
  const grouped = node.members.length > 1;
  const toggleKey = grouped ? node.key : node.group;
  const radius = nodeRadius(view.massInGev);
  const momentum = magnitude(view.momentumInGev);
  const arrow = arrowLength(momentum);
  const angle = Math.atan2(-view.momentumInGev.x, view.momentumInGev.z);
  const spin = view.quantum.find((slot) => slot.blochVector !== null);
  const touched = frame.events.some((event) => event.labels.includes(view.label));
  return (
    <g
      className={`stage-node fam-${view.family}${node.leaving ? ' leaving' : ''}${touched ? ' touched' : ''}${toggleKey === undefined ? '' : ' groupable'}`}
      style={{
        transform: `translate(${String(node.x)}px, ${String(node.y)}px)`,
        opacity: node.opacity,
      }}
      onClick={toggleKey === undefined ? undefined : () => onToggle(toggleKey)}
    >
      <g className="stage-node-body" style={{ transform: `scale(${String(node.scale)})` }}>
        {arrow > 0 && (
          <g
            style={{ transform: `rotate(${String((angle * 180) / Math.PI)}deg)` }}
            data-tooltip={say(
              `Импульс ${view.label}: |p| = ${formatNumber(momentum)} ГэВ, p⃗ = ${vectorText(view.momentumInGev)} ГэВ; стрелка в плоскости xz, ось z вправо`,
              `Momentum of ${view.label}: |p| = ${formatNumber(momentum)} GeV, p⃗ = ${vectorText(view.momentumInGev)} GeV; the arrow is in the xz plane, z to the right`,
            )}
          >
            <line className="stage-hit" x1={radius} y1={0} x2={radius + arrow + 7} y2={0} />
            <line className="momentum-arrow" x1={radius} y1={0} x2={radius + arrow} y2={0} />
            <path
              className="momentum-head"
              d={`M ${String(radius + arrow)} -4 L ${String(radius + arrow + 7)} 0 L ${String(radius + arrow)} 4 Z`}
            />
          </g>
        )}
        <g
          data-tooltip={
            grouped
              ? say(
                  `Группа из ${String(node.members.length)} одинаковых частиц (${node.members[0] ?? ''}…${node.members[node.members.length - 1] ?? ''}): тот же вид, состояние и среда. Нажмите, чтобы раскрыть`,
                  `A group of ${String(node.members.length)} identical particles (${node.members[0] ?? ''}…${node.members[node.members.length - 1] ?? ''}): the same species, state and medium. Click to expand`,
                )
              : node.group === undefined
                ? nodeTooltip(view, node.leaving)
                : `${nodeTooltip(view, node.leaving)} · ${say('нажмите, чтобы снова собрать группу', 'click to fold the group back')}`
          }
        >
          {grouped &&
            STACK_COINS.map((coin) => (
              <circle
                key={coin}
                className="stage-circle stage-stack"
                r={radius}
                cx={radius * STACK_OFFSET * coin}
                cy={0}
              />
            ))}
          <circle className="stage-halo" r={radius + 6} />
          <circle className="stage-circle" r={radius} />
          <text className="stage-symbol" y={4} textAnchor="middle">
            {formatSymbol(view.symbol)}
          </text>
        </g>
      </g>
      <text className="stage-label" y={-radius - 12} textAnchor="middle">
        {grouped ? `×${String(node.members.length)} ${formatSymbol(view.symbol)}` : view.label}
      </text>
      {!node.leaving && (
        <text
          className="stage-caption"
          y={
            radius + (spin !== undefined && spin.blochVector !== null ? 34 + BLOCH_RADIUS + 16 : 20)
          }
          textAnchor="middle"
        >
          {nodeCaption(view)}
        </text>
      )}
      {stageTemperature(view) !== null && (
        <text className="stage-reading" y={-radius - 30} textAnchor="middle">
          {stageTemperature(view)}
        </text>
      )}
      {spin !== undefined && spin.blochVector !== null && (
        <g
          className={spin.entangled ? 'bloch entangled' : 'bloch'}
          style={{ transform: `translate(0px, ${String(radius + 34)}px)` }}
          data-tooltip={`${slotTitle(spin)} ${view.label}, ${say('круг Блоха (x вправо, z вверх)', 'Bloch circle (x right, z up)')}: ${spinSummary(spin)}`}
        >
          <circle r={BLOCH_RADIUS} />
          <line x1={-BLOCH_RADIUS} x2={BLOCH_RADIUS} y1={0} y2={0} className="bloch-axis" />
          <line x1={0} x2={0} y1={-BLOCH_RADIUS} y2={BLOCH_RADIUS} className="bloch-axis" />
          {magnitude(spin.blochVector) > 0.02 && (
            <line
              className="bloch-vector"
              x1={0}
              y1={0}
              x2={spin.blochVector.x * BLOCH_RADIUS}
              y2={-spin.blochVector.z * BLOCH_RADIUS}
            />
          )}
          {spin.entangled && (
            <text className="bloch-tag" y={4} textAnchor="middle">
              ∞
            </text>
          )}
        </g>
      )}
    </g>
  );
}

const BUNDLE_WIDTH_PER_DOUBLING = 1.2;
const MAXIMUM_LISTED_LABELS = 4;

function listed(labels: readonly string[]): string {
  return labels.length <= MAXIMUM_LISTED_LABELS
    ? labels.join(', ')
    : `${labels.slice(0, MAXIMUM_LISTED_LABELS).join(', ')} … (${String(labels.length)})`;
}

function Links({
  frame,
  nodes,
}: {
  readonly frame: SystemFrame;
  readonly nodes: readonly StageNode[];
}) {
  return (
    <g>
      {linkBundles(frame, nodes).map((bundle) => {
        const { from, to: target } = bundle;
        const width = BUNDLE_WIDTH_PER_DOUBLING * Math.log2(bundle.count);
        const counted = bundle.count > 1;
        const badge = counted && (
          <text
            className="stage-bundle-count"
            x={(from.x + target.x) / 2}
            y={(from.y + target.y) / 2 - BUNDLE_BADGE_LIFT}
            textAnchor="middle"
          >
            ×{bundle.count}
          </text>
        );
        if (bundle.kind === 'entangle') {
          const middle = (from.x + target.x) / 2;
          const curve = `M ${String(from.x)} ${String(from.y)} Q ${String(middle)} ${String(Math.min(from.y, target.y) - ENTANGLE_ARC)} ${String(target.x)} ${String(target.y)}`;
          const first = bundle.sources[0] ?? '';
          const second = bundle.products[0] ?? '';
          const slot = frame.particles
            .find((particle) => particle.label === first)
            ?.quantum.find((candidate) => candidate.sharesRegisterWith.includes(second));
          return (
            <g
              key={bundle.key}
              data-tooltip={say(
                `Запутанность ${listed(bundle.sources)} ↔ ${listed(bundle.products)}${slot === undefined ? '' : ` по ${SLOT_BY[slot.observable] ?? slot.observable}, энтропия ${formatNumber(slot.entropyInBits)} бит`}: общее квантовое состояние, измерение одной частицы сразу определяет исход у другой`,
                `Entanglement ${listed(bundle.sources)} ↔ ${listed(bundle.products)}${slot === undefined ? '' : ` in ${SLOT_BY[slot.observable] ?? slot.observable}, entropy ${formatNumber(slot.entropyInBits)} bits`}: a shared quantum state, measuring one particle fixes the outcome of the other at once`,
              )}
            >
              <path className="stage-hit" d={curve} />
              <path
                className="stage-entangle"
                d={curve}
                style={counted ? { strokeWidth: 2 + width } : undefined}
              />
              {badge}
            </g>
          );
        }
        return (
          <g
            key={bundle.key}
            data-tooltip={`${SPLIT_TITLES[bundle.kind] ?? say('Связь', 'Link')}${counted ? ` ×${String(bundle.count)}` : ''}: ${listed(bundle.sources)} → ${listed(bundle.products)}. ${bundle.texts.map((text) => localize(text)).join(' · ')}`}
          >
            <line className="stage-hit" x1={from.x} y1={from.y} x2={target.x} y2={target.y} />
            <line
              className={SPLIT_CLASSES[bundle.kind] ?? 'stage-collide'}
              x1={from.x}
              y1={from.y}
              x2={target.x}
              y2={target.y}
              style={counted ? { strokeWidth: 2 + width } : undefined}
            />
            {badge}
          </g>
        );
      })}
    </g>
  );
}

function stageTemperature(view: ParticleView): string | null {
  const internal = view.readings?.internalTemperatureInKelvin;
  if (internal !== undefined) {
    return `T ${temperatureText(internal)}`;
  }
  const kinetic = view.readings?.kineticTemperatureInKelvin;
  return kinetic === undefined || kinetic <= 0 ? null : `T ${temperatureText(kinetic)}`;
}

const CUBE_FIRST_KEY = 'standard-model.cube-first';

function readCubeFirst(): boolean {
  try {
    return window.localStorage.getItem(CUBE_FIRST_KEY) === 'true';
  } catch {
    return false;
  }
}

function conditionsOf(
  frame: SystemFrame,
  label: string,
): { readonly temperatureInKelvin: number | null; readonly pressureInPascals: number | null } {
  const region = frame.regions?.find(
    (candidate) => candidate.aspect === 'medium' && candidate.members.includes(label),
  );
  const view = frame.particles.find((particle) => particle.label === label);
  const body = view === undefined ? undefined : bodyAt(frame, view);
  const medium = (body ?? (region === undefined ? frame.environment.medium : region.value)) as
    | { readonly temperatureInKelvin?: number; readonly pressureInPascals?: number }
    | null
    | undefined;
  return {
    temperatureInKelvin: medium?.temperatureInKelvin ?? null,
    pressureInPascals: medium?.pressureInPascals ?? null,
  };
}

const DENSE_STEP_COUNT = 10;

interface CatalogSymbols {
  readonly particles: readonly {
    readonly name: string;
    readonly symbol: string;
    readonly family: string;
  }[];
  readonly elements: readonly { readonly protons: number; readonly symbol: string }[];
  readonly molecules?: readonly { readonly name: string; readonly formula: string }[] | undefined;
}

const ENVELOPE_INSET = 24;
const CONTROLS_HEADROOM = 56;

function environmentSignature(frame: SystemFrame | undefined): string {
  return JSON.stringify([frame?.environment ?? {}, frame?.regions ?? []]);
}

function outcomeOf(report: SystemReport): string {
  const last = report.frames[report.frames.length - 1];
  const alive = (last?.particles ?? []).filter((particle) => particle.status === 'alive');
  const counts = new Map<string, number>();
  alive.forEach((particle) => {
    const symbol = formatSymbol(particle.symbol);
    counts.set(symbol, (counts.get(symbol) ?? 0) + 1);
  });
  return alive.length === 0
    ? say('пусто', 'empty')
    : [...counts.entries()]
        .map(([symbol, count]) => (count === 1 ? symbol : `${String(count)} × ${symbol}`))
        .join(' + ');
}

export function SystemPlayer({
  reports,
  selected,
  onSelect,
  onCarryOver,
}: {
  readonly reports: readonly SystemReport[];
  readonly selected: number;
  readonly onSelect: (index: number) => void;
  readonly onCarryOver?: (() => void) | undefined;
}) {
  const report = reports[selected] ?? reports[0];
  const frames = report?.frames ?? [];
  const [index, setIndex] = useState(0);
  const [photonEnergyPerHertz, setPhotonEnergyPerHertz] = useState<number | null>(null);
  const [symbolSources, setSymbolSources] = useState<CatalogSymbols>({
    particles: [],
    elements: [],
  });
  const symbolOf = useMemo(() => speciesSymbolResolver(symbolSources), [symbolSources]);
  const familyOf = useMemo(() => speciesFamilyResolver(symbolSources.particles), [symbolSources]);
  const [camera, setCamera] = useState<Camera>({ zoom: 1, panX: 0, panY: 0, follow: true });
  const viewRef = useRef<StageView>(camera);
  const moveRef = useRef<(next: StageView) => StageView>((next) => next);
  const panZoom = usePanZoom({
    viewRef,
    viewport: VIEWPORT,
    move: (next) => moveRef.current(next),
    wheel: 'horizontal',
  });
  const gridId = `stage-grid-${useId().replace(/[^A-Za-z0-9]/g, '')}`;
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const toggleGroup = (group: string): void =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  const nodes = useMemo(
    () => layoutStage(frames, index, STAGE_WIDTH, STAGE_PADDING, { centerY: NODE_Y, expanded }),
    [frames, index, expanded],
  );
  const badges = useMemo(() => environmentBadges(frames), [frames]);
  useEffect(() => {
    setCamera((current) => ({ ...current, panX: 0, panY: 0 }));
  }, [index, selected]);

  useEffect(() => {
    api
      .catalog()
      .then((catalog) => {
        setPhotonEnergyPerHertz(catalog.photonEnergyPerHertzInEv);
        setSymbolSources({
          particles: catalog.particles,
          elements: catalog.elements,
          molecules: catalog.molecules,
        });
      })
      .catch(() => setPhotonEnergyPerHertz(null));
  }, []);

  useEffect(() => {
    setIndex(0);
  }, [selected]);
  const [playing, setPlaying] = useState(false);
  const frame = frames[index];

  useEffect(() => {
    if (!playing) {
      return;
    }
    const timer = window.setInterval(() => {
      setIndex((current) => {
        if (current >= frames.length - 1) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, FRAME_MILLISECONDS);
    return () => window.clearInterval(timer);
  }, [playing, frames.length]);

  if (frame === undefined || report === undefined) {
    return null;
  }
  const aliveX = nodes.filter((node) => !node.leaving).map((node) => node.x);
  const aliveY = nodes.filter((node) => !node.leaving).map((node) => node.y);
  const boxes = envelopeBoxes(frame, nodes, NODE_Y, STAGE_WIDTH / 2, STAGE_WIDTH);
  const contentLeft = Math.min(STAGE_WIDTH / 2, ...aliveX);
  const contentRight = Math.max(STAGE_WIDTH / 2, ...aliveX);
  const sceneLeft = Math.min(
    contentLeft - STAGE_PADDING,
    ...boxes.map((box) => Math.min(box.left, legendExtent(box, badges).left) - ENVELOPE_INSET),
  );
  const sceneRight = Math.max(
    contentRight + STAGE_PADDING,
    ...boxes.map((box) => Math.max(box.right, legendExtent(box, badges).right) + ENVELOPE_INSET),
  );
  const sceneTop = Math.min(
    0,
    ...aliveY.map((y) => y - ROW_MARGIN),
    ...boxes.map((box) => box.top - CONTROLS_HEADROOM),
  );
  const sceneBottom = Math.max(
    STAGE_HEIGHT,
    ...aliveY.map((y) => y + ROW_MARGIN),
    ...boxes.map((box) => box.bottom + ENVELOPE_INSET),
  );
  const fitZoom = Math.min(
    1,
    Math.max(
      MINIMUM_ZOOM,
      Math.min(STAGE_WIDTH / (sceneRight - sceneLeft), STAGE_HEIGHT / (sceneBottom - sceneTop)),
    ),
  );
  const view: StageView = camera.follow
    ? {
        zoom: fitZoom,
        panX: (sceneLeft + sceneRight) / 2 - STAGE_WIDTH / 2,
        panY: (sceneTop + sceneBottom) / 2 - STAGE_HEIGHT / 2,
      }
    : camera;
  viewRef.current = view;
  const viewWidth = STAGE_WIDTH / view.zoom;
  const viewHeight = STAGE_HEIGHT / view.zoom;
  const viewLeft = STAGE_WIDTH / 2 + view.panX - viewWidth / 2;
  const viewTop = STAGE_HEIGHT / 2 + view.panY - viewHeight / 2;
  const moveCamera = (next: StageView): StageView => {
    const moved = {
      zoom: next.zoom,
      panX: Math.min(
        contentRight - STAGE_WIDTH / 2,
        Math.max(contentLeft - STAGE_WIDTH / 2, next.panX),
      ),
      panY: Math.min(
        Math.max(STAGE_HEIGHT / 2, sceneBottom - STAGE_HEIGHT / 2),
        Math.max(Math.min(-STAGE_HEIGHT / 2, sceneTop - STAGE_HEIGHT / 2), next.panY),
      ),
    };
    viewRef.current = moved;
    setCamera({ ...moved, follow: false });
    return moved;
  };
  moveRef.current = moveCamera;
  const centerCamera = (): void => {
    moveCamera({
      zoom: viewRef.current.zoom,
      panX: (sceneLeft + sceneRight) / 2 - STAGE_WIDTH / 2,
      panY: (sceneTop + sceneBottom) / 2 - STAGE_HEIGHT / 2,
    });
  };
  const alive = frame.particles.filter((particle) => particle.status === 'alive');
  const previousFrame = frames[index - 1];
  const [cubeFirst, setCubeFirst] = useState(readCubeFirst);
  const chooseCubeFirst = (next: boolean): void => {
    setCubeFirst(next);
    try {
      window.localStorage.setItem(CUBE_FIRST_KEY, String(next));
    } catch {
      return;
    }
  };
  const title =
    frame.step === null
      ? say('Начало: пустая система', 'Start: empty system')
      : `${OPERATION_TITLES[frame.step.operation] ?? frame.step.operation}: ${describeStep(frame.step)}`;
  const environmentChanged = environmentSignature(frame) !== environmentSignature(previousFrame);
  const hasCube = frames.some((candidate) => candidate.space !== null);
  const cubeView =
    frame.space === null ? null : (
      <SpaceView
        space={frame.space}
        frame={frame}
        previous={previousFrame}
        symbolOf={symbolOf}
        renderCard={(view) => (
          <ParticleCard
            view={view}
            open
            conditions={conditionsOf(frame, view.label)}
            previous={previousFrame?.particles.find((particle) => particle.id === view.id)}
          />
        )}
      />
    );

  return (
    <section className="card system-player">
      <div className="section-head">
        <h3 data-tooltip={localize(report.note)}>{say('Состояние системы', 'System state')}</h3>
        <span className="section-actions">
          {hasCube && (
            <span
              className="segmented order-switch"
              role="group"
              aria-label={say('Что показывать сначала', 'What to show first')}
            >
              <button
                type="button"
                className={cubeFirst ? '' : 'active'}
                aria-pressed={!cubeFirst}
                data-tooltip={say(
                  'Сначала сцена системы, под ней куб',
                  'The system stage first, the cube below it',
                )}
                onClick={() => chooseCubeFirst(false)}
              >
                {say('сцена → куб', 'stage → cube')}
              </button>
              <button
                type="button"
                className={cubeFirst ? 'active' : ''}
                aria-pressed={cubeFirst}
                data-tooltip={say(
                  'Сначала куб, под ним сцена системы',
                  'The cube first, the system stage below it',
                )}
                onClick={() => chooseCubeFirst(true)}
              >
                {say('куб → сцена', 'cube → stage')}
              </button>
            </span>
          )}
          <span className="kicker" data-tooltip={HINTS.shotKicker}>
            {say('выстрел', 'shot')} · seed {report.seed}
          </span>
          {onCarryOver !== undefined && (
            <button
              type="button"
              className="primary with-icon"
              data-tooltip={say(
                'Открыть конструктор с частицами, импульсами, спинами, запутанностью и облаками из последнего кадра этого выстрела',
                'Open the builder with the particles, momenta, spins, entanglement and clouds from the last frame of this shot',
              )}
              onClick={onCarryOver}
            >
              <SmlIcon name="carry-over" aria-hidden="true" size={20} strokeWidth={2} />{' '}
              {say(
                'Перенести систему в новый эксперимент',
                'Carry the system into a new experiment',
              )}
            </button>
          )}
        </span>
      </div>
      {reports.length > 1 && (
        <div className="trace-tabs">
          <span className="muted" data-tooltip={HINTS.traceTabs}>
            {say('Выстрелы, чем закончились:', 'Shots and how they ended:')}
          </span>
          {reports.map((trace, position) => (
            <button
              key={trace.seed}
              type="button"
              className={position === selected ? 'trace-tab active' : 'trace-tab'}
              data-tooltip={say(
                `Выстрел с seed ${String(trace.seed)}; в конце: ${outcomeOf(trace)}`,
                `Shot with seed ${String(trace.seed)}; at the end: ${outcomeOf(trace)}`,
              )}
              onClick={() => onSelect(position)}
            >
              <span className="trace-number">{position + 1}</span>
              {outcomeOf(trace)}
            </button>
          ))}
        </div>
      )}
      <div className="player-controls">
        <button
          type="button"
          className="icon-button"
          aria-label={say('Назад', 'Back')}
          data-tooltip={say('Предыдущий шаг', 'Previous step')}
          onClick={() => setIndex(Math.max(0, index - 1))}
        >
          <SkipBack aria-hidden="true" size={16} />
        </button>
        <button
          type="button"
          className="icon-button primary-round"
          aria-label={playing ? say('Пауза', 'Pause') : say('Проиграть', 'Play')}
          data-tooltip={
            playing
              ? say('Пауза', 'Pause')
              : say('Проиграть эксперимент по шагам', 'Play the experiment step by step')
          }
          onClick={() => {
            if (!playing && index >= frames.length - 1) {
              setIndex(0);
            }
            setPlaying(!playing);
          }}
        >
          {playing ? (
            <SmlIcon name="pause" aria-hidden="true" size={18} />
          ) : (
            <SmlIcon name="play" aria-hidden="true" size={18} />
          )}
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label={say('Вперед', 'Forward')}
          data-tooltip={say('Следующий шаг', 'Next step')}
          onClick={() => setIndex(Math.min(frames.length - 1, index + 1))}
        >
          <SkipForward aria-hidden="true" size={16} />
        </button>
        <div className={frames.length > DENSE_STEP_COUNT ? 'step-progress dense' : 'step-progress'}>
          {frames.slice(1).map((step, position) => {
            const number = position + 1;
            const state = number < index ? 'done' : number === index ? 'current' : 'todo';
            const operation = (step.step?.operation ?? 'evolve') as OperationName;
            const Icon = OPERATION_ICONS[operation];
            return (
              <button
                key={number}
                type="button"
                className={`step-segment ${state} op-${operation}`}
                aria-current={state === 'current' ? 'step' : undefined}
                data-tooltip={step.step === null ? '' : describeStep(step.step)}
                onClick={() => {
                  setPlaying(false);
                  setIndex(number);
                }}
              >
                <span className="segment-bar" />
                <span className="segment-label">
                  <Icon size={13} aria-hidden="true" />
                  {number} · {(OPERATION_TITLES[operation] ?? operation).toLowerCase()}
                </span>
              </button>
            );
          })}
        </div>
        <span className="player-position" data-tooltip={HINTS.frameCounter}>
          {index} / {frames.length - 1}
        </span>
      </div>
      {cubeFirst && cubeView}
      <div className="player-body">
        <div className="stage-frame">
          <ZoomToolbar
            zoom={view.zoom}
            minimumZoom={MINIMUM_ZOOM}
            maximumZoom={MAXIMUM_ZOOM}
            onZoomBy={(factor) => {
              panZoom.zoomBy(factor);
            }}
            onFit={() => setCamera({ ...camera, follow: true })}
            fitted={camera.follow}
            onCenter={centerCamera}
            fitTooltip={say(
              'Следить за центром системы и уместить кадр целиком',
              'Follow the system center and fit the whole frame',
            )}
          />
          <div className="stage-viewport" ref={panZoom.attachWheel} {...panZoom.gestures}>
            <svg
              className="stage"
              viewBox={[viewLeft, viewTop, viewWidth, viewHeight].map(String).join(' ')}
              role="img"
              aria-label={title}
            >
              <defs>
                <pattern
                  id={gridId}
                  width={GRID_CELL}
                  height={GRID_CELL}
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    className="stage-grid-line"
                    d={`M ${String(GRID_CELL)} 0 L 0 0 0 ${String(GRID_CELL)}`}
                  />
                </pattern>
              </defs>
              <rect
                x={viewLeft}
                y={viewTop}
                width={viewWidth}
                height={viewHeight}
                fill={`url(#${gridId})`}
              />
              <EnvironmentLayer
                frame={frame}
                boxes={boxes}
                nodes={nodes}
                badges={badges}
                frameIndex={index}
                symbolOf={symbolOf}
              />
              {frame.step?.operation === 'influence' && !environmentChanged && (
                <InfluenceZone
                  key={index}
                  step={frame.step}
                  photonEnergyPerHertzInEv={photonEnergyPerHertz}
                  nodes={nodes}
                  nodeY={NODE_Y}
                  viewLeft={viewLeft}
                  viewRight={viewLeft + viewWidth}
                  height={STAGE_HEIGHT}
                />
              )}
              <Links frame={frame} nodes={nodes} />
              {nodes.map((node) => (
                <StageNodeView key={node.key} node={node} frame={frame} onToggle={toggleGroup} />
              ))}
              {nodes.length === 0 && (
                <text
                  className="stage-empty"
                  x={STAGE_WIDTH / 2}
                  y={STAGE_HEIGHT / 2}
                  textAnchor="middle"
                >
                  {say('частиц пока нет', 'no particles yet')}
                </text>
              )}
            </svg>
          </div>
        </div>
        <aside
          className="player-side"
          aria-label={say('Состав и окружение', 'Contents and environment')}
        >
          <div className="player-side-scroll">
            <StepCard frame={frame} index={index} symbolOf={symbolOf} />
            <section className="side-section">
              <span className="eyebrow" data-tooltip={HINTS.conservedSection}>
                {say('Сохраняющиеся величины', 'Conserved quantities')}
              </span>
              <ConservedTiles totals={frame.totals} />
            </section>
            <EnvironmentSummary
              frame={frame}
              symbolOf={symbolOf}
              familyOf={familyOf}
              highlighted={environmentChanged}
            />
            <section className="side-section">
              <span className="eyebrow" data-tooltip={HINTS.particlesSection}>
                {say('Частицы', 'Particles')}{' '}
                <span className="label-note">
                  {say(`живых: ${String(alive.length)}`, `alive: ${String(alive.length)}`)}
                </span>
              </span>
              {alive.length === 0 && (
                <p className="muted">{say('частиц пока нет', 'no particles yet')}</p>
              )}
              {particleGroups(alive, frame).map((group) => (
                <ParticleCard
                  key={group.key}
                  view={group.view}
                  members={group.members}
                  open={alive.length <= OPEN_PARTICLE_CARDS}
                  conditions={conditionsOf(frame, group.view.label)}
                  previous={previousFrame?.particles.find(
                    (particle) => particle.label === group.view.label,
                  )}
                />
              ))}
            </section>
          </div>
        </aside>
      </div>
      {!cubeFirst && cubeView}
    </section>
  );
}
