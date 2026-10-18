/* ParticleCard: one live particle in the side panel: an avatar in its family colour, its kind and isotope, its aggregate state with the conditions and the law behind it, and its readings
   grouped into composition tiles, energies, structure, magnetism, motion chips and quantum state, each explained on hover. */
import type { ParticleView } from '@standard-model/contracts';
import { formatNumber, formatSymbol } from '../format';
import { READING_LABELS } from '../glossary';
import { HINTS, READING_HINTS } from '../hints';
import { say } from '../language';
import {
  phaseWord,
  magnitude,
  matterTitle,
  motionWord,
  slotTitle,
  spinSummary,
  temperatureText,
} from '../particle-text';
import { SmlIcon } from './sml-icon';

interface Conditions {
  readonly temperatureInKelvin: number | null;
  readonly pressureInPascals: number | null;
}

const COMPOSITION = ['protons', 'neutrons', 'electrons', 'atomCount', 'bondCount'] as const;
const ENERGIES = [
  'ionizationEnergyInEv',
  'bindingEnergyPerNucleonInMev',
  'neutronSeparationEnergyInMev',
  'protonSeparationEnergyInMev',
  'bondEnergyInEv',
  'weakestBondInEv',
] as const;
const STRUCTURE = [
  'massInDaltons',
  'dipoleMomentInDebye',
  'meanBondLengthInAngstrom',
  'largestRotationalConstantInGigahertz',
  'vibrationalModeCount',
  'lowestWavenumberInInverseCentimeters',
  'highestWavenumberInInverseCentimeters',
  'vibrationalQuanta',
  'halfLifeInSeconds',
] as const;
const MAGNETISM = ['landeFactor', 'magneticMomentInBohrMagnetons'] as const;
const COMPOSITION_LABELS: Readonly<
  Record<(typeof COMPOSITION)[number], readonly [string, string]>
> = {
  protons: ['протонов Z', 'protons Z'],
  neutrons: ['нейтронов N', 'neutrons N'],
  electrons: ['электронов', 'electrons'],
  atomCount: ['атомов', 'atoms'],
  bondCount: ['связей', 'bonds'],
};

function valueClass(value: number): string {
  return value === 0 ? 'value zero' : 'value';
}

function Rows({
  view,
  previous,
  keys,
  leading,
}: {
  readonly view: ParticleView;
  readonly previous: ParticleView | undefined;
  readonly keys: readonly string[];
  readonly leading?: React.ReactNode;
}) {
  const present = keys.filter((key) => view.readings?.[key] !== undefined);
  if (present.length === 0 && leading === undefined) {
    return null;
  }
  return (
    <dl className="reading-rows">
      {leading}
      {present.map((key) => {
        const now = view.readings?.[key] ?? 0;
        const before = previous?.readings?.[key];
        const changed = before !== undefined && Math.abs(before - now) > Math.abs(now) * 1e-9;
        return (
          <div
            key={key}
            className={changed ? 'reading-row changed' : 'reading-row'}
            data-tooltip={READING_HINTS[key]}
          >
            <dt>{READING_LABELS[key] ?? key}</dt>
            <dd className={valueClass(now)}>
              {changed && <span className="reading-before">{formatNumber(before)} →</span>}
              {formatNumber(now)}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function Group({
  icon,
  title,
  hint,
  note,
  children,
}: {
  readonly icon: string;
  readonly title: string;
  readonly hint: string;
  readonly note?: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section className="reading-group">
      <h5 data-tooltip={hint}>
        <SmlIcon name={icon} size={14} aria-hidden="true" />
        {title}
        {note !== undefined && <span className="label-note">· {note}</span>}
      </h5>
      {children}
    </section>
  );
}

function phaseNote(view: ParticleView, conditions: Conditions): string | null {
  if (view.phase === undefined) {
    return null;
  }
  const where =
    conditions.temperatureInKelvin === null
      ? ''
      : conditions.pressureInPascals === null
        ? say(
            `При ${formatNumber(conditions.temperatureInKelvin)} К`,
            `At ${formatNumber(conditions.temperatureInKelvin)} K`,
          )
        : say(
            `При ${formatNumber(conditions.temperatureInKelvin)} К и ${formatNumber(conditions.pressureInPascals)} Па`,
            `At ${formatNumber(conditions.temperatureInKelvin)} K and ${formatNumber(conditions.pressureInPascals)} Pa`,
          );
  const basis =
    view.phase === 'plasma'
      ? say(
          'Заряженная частица или атом, у которого kT сравнимо с энергией ионизации.',
          'A charged particle or an atom whose kT is comparable to its ionization energy.',
        )
      : view.allotrope !== undefined
        ? say(
            'По фазовой диаграмме элемента: кривая пара, линия равновесия твердых форм и кривые плавления.',
            'From the phase diagram of the element: the vapour curve, the line between the solid forms and the melting curves.',
          )
        : view.phaseEstimateMethod === 'groupContribution'
          ? say(
              'Оценка по групповым вкладам Джобака и Рида.',
              'Estimated from Joback–Reid group contributions.',
            )
          : view.phaseEstimated === true
            ? say(
                'Оценка по соответственным состояниям Леннард-Джонса.',
                'Estimated from Lennard-Jones corresponding states.',
              )
            : say(
                'По точкам перехода из NIST и CRC: критической, плавления, кипения или разложения.',
                'From NIST and CRC transition points: critical, melting, boiling or decomposition.',
              );
  return `${where}${where === '' ? '' : ' — '}${phaseWord(view)}. ${basis}`;
}

export function ParticleCard({
  view,
  previous,
  open,
  conditions,
  members = [view.label],
}: {
  readonly view: ParticleView;
  readonly previous: ParticleView | undefined;
  readonly open: boolean;
  readonly conditions: Conditions;
  readonly members?: readonly string[];
}) {
  const grouped = members.length > 1;
  const readings = view.readings ?? {};
  const composition = COMPOSITION.filter((key) => readings[key] !== undefined);
  const note = phaseNote(view, conditions);
  const kinetic = readings.kineticTemperatureInKelvin;
  const internal = readings.internalTemperatureInKelvin;
  const momentum = magnitude(view.momentumInGev);
  return (
    <details className={`particle-card fam-${view.family}`} open={open}>
      <summary className="particle-card-head">
        <span className="particle-avatar" data-tooltip={HINTS.avatar}>
          {formatSymbol(view.symbol)}
        </span>
        <span className="particle-card-title">
          <strong data-tooltip={grouped ? HINTS.particleGroup : HINTS.particleLabel}>
            {grouped ? `×${String(members.length)} ${formatSymbol(view.symbol)}` : view.label}
          </strong>
          <small>
            {grouped &&
              say(
                `группа одинаковых: ${members[0] ?? ''}…${members[members.length - 1] ?? ''} · `,
                `identical group: ${members[0] ?? ''}…${members[members.length - 1] ?? ''} · `,
              )}
            {matterTitle(view)}
            {view.chargeInElementaryUnits === 0
              ? say(' · нейтральный', ' · neutral')
              : ` · ${say('заряд', 'charge')} ${formatNumber(view.chargeInElementaryUnits)}`}
          </small>
        </span>
        {view.phase !== undefined && (
          <span className={`phase-badge phase-${view.phase}`} data-tooltip={HINTS.phaseBadge}>
            {phaseWord(view)}
          </span>
        )}
        <SmlIcon name="expand" className="chevron" size={16} aria-hidden="true" />
      </summary>
      <div className="particle-card-body">
        {note !== null && <p className="phase-note">{note}</p>}
        {composition.length > 0 && (
          <Group
            icon="composite"
            title={say('Состав', 'Composition')}
            hint={HINTS.compositionGroup}
          >
            <div className="composition-tiles">
              {composition.map((key) => (
                <span key={key} className="composition-tile" data-tooltip={HINTS[key]}>
                  <small>{say(...COMPOSITION_LABELS[key])}</small>
                  <b className={valueClass(readings[key] ?? 0)}>{formatNumber(readings[key])}</b>
                </span>
              ))}
            </div>
          </Group>
        )}
        <Group icon="energy" title={say('Энергии', 'Energies')} hint={HINTS.energiesGroup}>
          <Rows
            view={view}
            previous={previous}
            keys={ENERGIES}
            leading={
              <div className="reading-row" data-tooltip={HINTS.totalEnergyOfParticle}>
                <dt>{say('полная E', 'total E')}</dt>
                <dd className="value">
                  {formatNumber(view.energyInGev)} {say('ГэВ', 'GeV')}
                </dd>
              </div>
            }
          />
        </Group>
        {STRUCTURE.some((key) => readings[key] !== undefined) && (
          <Group icon="molecule" title={say('Строение', 'Structure')} hint={HINTS.structureGroup}>
            <Rows view={view} previous={previous} keys={STRUCTURE} />
          </Group>
        )}
        {MAGNETISM.some((key) => readings[key] !== undefined) && (
          <Group
            icon="magnetic-field"
            title={say('Магнитный момент', 'Magnetic moment')}
            hint={HINTS.magnetismGroup}
          >
            <Rows view={view} previous={previous} keys={MAGNETISM} />
          </Group>
        )}
        <Group
          icon="momentum"
          title={say('Движение', 'Motion')}
          hint={HINTS.motionGroup}
          note={motionWord(view)}
        >
          <div className="motion-chips">
            {kinetic !== undefined && (
              <span className="tag" data-tooltip={HINTS.kineticTemperature}>
                {say('T кин', 'T kin')}{' '}
                <b className={valueClass(kinetic)}>{temperatureText(kinetic)}</b>
              </span>
            )}
            {internal !== undefined && (
              <span className="tag" data-tooltip={HINTS.internalTemperature}>
                {say('T внутр', 'T int')}{' '}
                <b className={valueClass(internal)}>{temperatureText(internal)}</b>
              </span>
            )}
            <span className="tag" data-tooltip={HINTS.momentum}>
              |p| <b className={valueClass(momentum)}>{formatNumber(momentum)}</b>
            </span>
            <span className="tag" data-tooltip={HINTS.lorentzFactor}>
              γ <b>{view.lorentzFactor === null ? '∞' : formatNumber(view.lorentzFactor)}</b>
            </span>
            <span className="tag" data-tooltip={HINTS.properTime}>
              τ{' '}
              <b className={valueClass(view.properTimeInSeconds)}>
                {formatNumber(view.properTimeInSeconds)}
              </b>{' '}
              {say('с', 's')}
            </span>
          </div>
        </Group>
        {view.quantum.length > 0 && (
          <Group
            icon="spin"
            title={say('Квантовое состояние', 'Quantum state')}
            hint={HINTS.quantumState}
          >
            <dl className="reading-rows">
              {view.quantum.map((slot) => (
                <div
                  key={slot.observable}
                  className="reading-row wide"
                  data-tooltip={HINTS.quantumState}
                >
                  <dt>{slotTitle(slot)}</dt>
                  <dd>{spinSummary(slot)}</dd>
                </div>
              ))}
            </dl>
          </Group>
        )}
      </div>
    </details>
  );
}
