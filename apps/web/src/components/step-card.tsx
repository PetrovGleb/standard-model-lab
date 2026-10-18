/* StepCard and ConservedTiles: the head of the side panel: what the current step did, told in words under a strip in the operation's colour, with measurement odds where a collapse happened, and the conserved totals of the alive particles as four tiles. */
import type { ConservedTotals, SystemEvent, SystemFrame } from '@standard-model/contracts';
import { formatNumber, formatOutcome } from '../format';
import { OPERATION_GLOSSARY, OPERATION_TITLES } from '../glossary';
import { HINTS } from '../hints';
import { OperationBadge, type OperationName } from '../icons';
import { say } from '../language';
import { foldedEvents } from '../particle-text';
import type { SymbolOf } from '../influence-visual';
import { SmlIcon } from './sml-icon';

const PERCENT = 100;

function Odds({ event }: { readonly event: SystemEvent }) {
  if (event.probabilitiesBefore === undefined) {
    return null;
  }
  return (
    <div className="collapse-odds" data-tooltip={HINTS.collapseOdds}>
      <span className="muted">
        {say('Вероятности до коллапса', 'Probabilities before collapse')}
      </span>
      {event.probabilitiesBefore.map((outcome) => (
        <div
          key={outcome.eigenvalue}
          className={outcome.eigenvalue === event.outcome ? 'odds-row chosen' : 'odds-row'}
        >
          <span>{formatOutcome(String(outcome.eigenvalue))}</span>
          <span className="odds-track">
            <span
              className="odds-fill"
              style={{ width: `${String(outcome.probability * PERCENT)}%` }}
            />
          </span>
          <span>{(outcome.probability * PERCENT).toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
}

function mediumNarrative(frame: SystemFrame, symbolOf: SymbolOf): string | null {
  const step = frame.step;
  if (step === null || step.operation !== 'influence' || step.influence !== 'setMedium') {
    return null;
  }
  const targets = step.targets ?? [];
  const region = frame.regions?.find(
    (candidate) =>
      candidate.aspect === 'medium' && targets.every((label) => candidate.members.includes(label)),
  );
  const value = targets.length === 0 ? frame.environment.medium : region?.value;
  if (value === undefined || value === null) {
    return null;
  }
  const medium = value as {
    readonly temperatureInKelvin?: number;
    readonly reactionMode?: string;
    readonly components?: readonly { readonly species?: string }[];
  };
  const species = (medium.components ?? [])
    .map((component) => symbolOf(component.species ?? '—'))
    .join(', ');
  const who =
    targets.length > 0
      ? targets.join(', ')
      : frame.particles
          .filter((particle) => particle.status === 'alive')
          .map((particle) => particle.label)
          .join(', ');
  const reacts =
    medium.reactionMode === 'allReactionsInStep'
      ? say('реагирует с ней на каждом шаге эволюции', 'reacts with it during every evolution step')
      : say('может реагировать с ней на следующем шаге', 'may react with it at the next step');
  return say(
    `${targets.length > 0 ? 'Вокруг выбранных частиц своя среда' : 'Пространство заполнено средой'}: ${species} при ${formatNumber(medium.temperatureInKelvin)} К. ${who === '' ? 'Частиц пока нет' : `${who} теперь в среде и ${reacts}`}.`,
    `${targets.length > 0 ? 'The picked particles get their own medium' : 'Space is filled with a medium'}: ${species} at ${formatNumber(medium.temperatureInKelvin)} K. ${who === '' ? 'No particles yet' : `${who} is now in the medium and ${reacts}`}.`,
  );
}

export function StepCard({
  frame,
  index,
  symbolOf,
}: {
  readonly frame: SystemFrame;
  readonly index: number;
  readonly symbolOf: SymbolOf;
}) {
  const step = frame.step;
  if (step === null) {
    return (
      <div className="step-card">
        <span className="step-card-eyebrow">{say('Начало', 'Start')}</span>
        <p className="step-card-title">{say('Пустая система', 'Empty system')}</p>
        <p className="step-card-text">
          {say(
            'Частицы появятся на первом шаге. Шаги идут слева направо по полосе вверху.',
            'Particles appear at the first step. The steps run left to right along the bar above.',
          )}
        </p>
      </div>
    );
  }
  const operation = step.operation as OperationName;
  const [firstFold, ...rest] = foldedEvents(frame.events);
  const first = firstFold?.event;
  const narrative = mediumNarrative(frame, symbolOf);
  const influenceScope =
    step.operation === 'influence'
      ? step.targets === undefined || step.targets.length === 0
        ? say('на всю систему', 'on the whole system')
        : say(`на ${step.targets.join(', ')}`, `on ${step.targets.join(', ')}`)
      : '';
  return (
    <div className={`step-card op-card-${step.operation} op-${step.operation}`}>
      <div className="step-card-head">
        <OperationBadge operation={operation} size={18} />
        <div>
          <span className="step-card-eyebrow" data-tooltip={OPERATION_GLOSSARY[step.operation]}>
            {say('Шаг', 'Step')} {index} · {OPERATION_TITLES[step.operation] ?? step.operation}
          </span>
          <p className="step-card-title">
            {step.operation === 'influence' ? (
              <>
                <code>{step.influence}</code> {influenceScope}
              </>
            ) : firstFold === undefined ? (
              OPERATION_TITLES[step.operation]
            ) : (
              firstFold.text
            )}
          </p>
        </div>
      </div>
      {narrative !== null && <p className="step-card-text">{narrative}</p>}
      {step.operation !== 'influence' && first !== undefined && <Odds event={first} />}
      {rest.map((fold, position) => (
        <div
          key={position}
          className="step-card-event"
          data-tooltip={fold.count > 1 ? fold.labels.join(', ') : undefined}
        >
          <p className="step-card-text">{fold.text}</p>
          <Odds event={fold.event} />
        </div>
      ))}
    </div>
  );
}

export function ConservedTiles({ totals }: { readonly totals: ConservedTotals }) {
  const leptons = [totals.electronNumber, totals.muonNumber, totals.tauNumber];
  return (
    <div className="conserved-tiles">
      <span className="conserved-tile" data-tooltip={HINTS.charge}>
        <SmlIcon name="electric-charge" size={14} aria-hidden="true" />
        <b className={totals.chargeInElementaryUnits === 0 ? 'zero' : ''}>
          {formatNumber(totals.chargeInElementaryUnits)}
        </b>
        <small>{say('заряд Q', 'charge Q')}</small>
      </span>
      <span className="conserved-tile" data-tooltip={HINTS.baryonNumber}>
        <SmlIcon name="baryon-number" size={14} aria-hidden="true" />
        <b className={totals.baryonNumber === 0 ? 'zero' : ''}>
          {formatNumber(totals.baryonNumber)}
        </b>
        <small>{say('барионное B', 'baryon B')}</small>
      </span>
      <span className="conserved-tile" data-tooltip={HINTS.leptonNumbers}>
        <SmlIcon name="lepton-number" size={14} aria-hidden="true" />
        <b>
          {leptons.map((value, position) => (
            <span key={position} className={value === 0 ? 'zero' : ''}>
              {position > 0 && <span className="zero">·</span>}
              {value}
            </span>
          ))}
        </b>
        <small>{say('лептонные Lₑ Lμ Lτ', 'lepton Lₑ Lμ Lτ')}</small>
      </span>
      <span className="conserved-tile" data-tooltip={HINTS.totalEnergy}>
        <SmlIcon name="energy" size={14} aria-hidden="true" />
        <b>{formatNumber(totals.energyInGev)}</b>
        <small>{say('энергия, ГэВ', 'energy, GeV')}</small>
      </span>
    </div>
  );
}
