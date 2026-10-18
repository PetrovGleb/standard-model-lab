/* EnvironmentSummary: the environment of a frame as cards, one per aspect, shared or for a named group of particles: the medium's conditions (thickness and absorbed energy of a finite ball
   included) as key and value, its components as rows with an avatar in their family colour and their density, the reaction mode underneath; fields and temperatures as one line; every item explains itself on hover. */
import type { SystemFrame } from '@standard-model/contracts';
import { formatNumber } from '../format';
import { PARTICLE_GLOSSARY } from '../glossary';
import { ASPECT_HINTS, HINTS } from '../hints';
import { environmentVisual, type SymbolOf } from '../influence-visual';
import { say } from '../language';
import { SmlIcon } from './sml-icon';

interface MediumValue {
  readonly components?: readonly {
    readonly species?: string;
    readonly numberDensityPerCubicMeter?: number;
  }[];
  readonly temperatureInKelvin?: number;
  readonly pressureInPascals?: number;
  readonly radiationTemperatureInKelvin?: number;
  readonly thicknessInMeters?: number;
  readonly absorbedEnergyInJoules?: number;
  readonly reactionMode?: string;
  readonly bulkVelocityInMetersPerSecond?: {
    readonly x?: number;
    readonly y?: number;
    readonly z?: number;
  };
}

interface Entry {
  readonly aspect: string;
  readonly value: unknown;
  readonly members: readonly string[] | null;
}

const ASPECT_NAMES: Readonly<Record<string, readonly [string, string]>> = {
  medium: ['Среда', 'Medium'],
  temperature: ['Температура', 'Temperature'],
  magneticField: ['Магнитное поле', 'Magnetic field'],
  electricField: ['Электрическое поле', 'Electric field'],
  coherenceTimes: ['Времена когерентности', 'Coherence times'],
  neutrinoMixing: ['Смешивание нейтрино', 'Neutrino mixing'],
};

function conditions(medium: MediumValue): readonly (readonly [string, string, string])[] {
  const flow = medium.bulkVelocityInMetersPerSecond;
  const speed = Math.hypot(flow?.x ?? 0, flow?.y ?? 0, flow?.z ?? 0);
  const optional = (
    value: number | undefined,
    key: string,
    unit: string,
    hint: string,
  ): readonly (readonly [string, string, string])[] =>
    value === undefined ? [] : [[key, `${formatNumber(value)} ${unit}`, hint]];
  return [
    ['T', `${formatNumber(medium.temperatureInKelvin)} ${say('К', 'K')}`, HINTS.temperature],
    ...optional(medium.pressureInPascals, 'P', say('Па', 'Pa'), HINTS.pressure),
    ...optional(
      medium.radiationTemperatureInKelvin,
      say('T излучения', 'T radiation'),
      say('К', 'K'),
      HINTS.radiationTemperature,
    ),
    ...optional(speed > 0 ? speed : undefined, say('поток', 'flow'), say('м/с', 'm/s'), HINTS.flow),
    ...optional(
      medium.thicknessInMeters,
      say('толщина', 'thickness'),
      say('м', 'm'),
      HINTS.thickness,
    ),
    ...optional(
      medium.absorbedEnergyInJoules,
      say('поглощено', 'absorbed'),
      say('Дж', 'J'),
      HINTS.absorbedEnergy,
    ),
  ];
}

function speciesName(name: string, symbol: string, family: string): string {
  const known = PARTICLE_GLOSSARY[name];
  if (known !== undefined) {
    return known;
  }
  return family === 'molecule'
    ? say(`молекула ${symbol}`, `molecule ${symbol}`)
    : family === 'nucleus'
      ? say(`ядро ${symbol}`, `nucleus ${symbol}`)
      : say(`атом ${symbol}`, `atom ${symbol}`);
}

export function EnvironmentSummary({
  frame,
  symbolOf,
  familyOf,
  highlighted,
}: {
  readonly frame: SystemFrame;
  readonly symbolOf: SymbolOf;
  readonly familyOf: (name: string) => string;
  readonly highlighted: boolean;
}) {
  const order = frame.environmentOrder ?? Object.keys(frame.environment);
  const rankOf = (aspect: string): number =>
    order.includes(aspect) ? order.indexOf(aspect) : order.length;
  const entries: readonly Entry[] = [
    ...Object.entries(frame.environment)
      .map(([aspect, value]) => ({ aspect, value, members: null }))
      .sort((first, second) => rankOf(first.aspect) - rankOf(second.aspect)),
    ...(frame.regions ?? []).map((region) => ({
      aspect: region.aspect,
      value: region.value,
      members: region.members,
    })),
  ];
  if (entries.length === 0) {
    return null;
  }
  return (
    <section
      className={
        highlighted
          ? 'side-section environment-summary changed'
          : 'side-section environment-summary'
      }
    >
      <span className="eyebrow" data-tooltip={HINTS.environmentSection}>
        {say('Окружение', 'Environment')}
      </span>
      {entries.map((entry, position) => {
        const visual = environmentVisual(entry.aspect, entry.value, symbolOf);
        const name = ASPECT_NAMES[entry.aspect] ?? [entry.aspect, entry.aspect];
        const scope =
          entry.members === null
            ? say('вся система', 'whole system')
            : say(`только ${entry.members.join(', ')}`, `only ${entry.members.join(', ')}`);
        const medium =
          entry.aspect === 'medium' && entry.value !== null ? (entry.value as MediumValue) : null;
        return (
          <div key={position} className={`environment-card tone-${visual.tone}`}>
            <div className="environment-card-head">
              <SmlIcon name={visual.icon} size={16} aria-hidden="true" />
              <strong data-tooltip={ASPECT_HINTS[entry.aspect]}>{say(...name)}</strong>
              <span
                className="environment-scope"
                data-tooltip={entry.members === null ? HINTS.scopeWhole : HINTS.scopeOnly}
              >
                {scope}
              </span>
            </div>
            {medium === null ? (
              <p className="environment-detail" data-tooltip={ASPECT_HINTS[entry.aspect]}>
                {visual.detail}
              </p>
            ) : (
              <>
                <dl className="environment-conditions">
                  {conditions(medium).map(([key, value, hint]) => (
                    <div key={key} data-tooltip={hint}>
                      <dt>{key}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
                <ul className="environment-components">
                  {(medium.components ?? []).map((component, index) => {
                    const species = component.species ?? '—';
                    const symbol = symbolOf(species);
                    const family = familyOf(species);
                    return (
                      <li key={index} className={`fam-${family}`}>
                        <span className="species-avatar" data-tooltip={HINTS.avatar}>
                          {symbol}
                        </span>
                        <span className="species-name">{speciesName(species, symbol, family)}</span>
                        <span className="species-density" data-tooltip={HINTS.componentDensity}>
                          {formatNumber(component.numberDensityPerCubicMeter)} {say('м⁻³', 'm⁻³')}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {medium.reactionMode !== undefined && (
                  <p
                    className="environment-footer"
                    data-tooltip={
                      medium.reactionMode === 'allReactionsInStep'
                        ? HINTS.reactionAll
                        : HINTS.reactionOne
                    }
                  >
                    {medium.reactionMode === 'allReactionsInStep'
                      ? say('Все реакции за шаг', 'All reactions in a step')
                      : say('Одна реакция за шаг', 'One reaction per step')}
                  </p>
                )}
              </>
            )}
          </div>
        );
      })}
    </section>
  );
}
