/* Influence visuals for the system stage: which picture an influence step gets (a photon beam by spectral band, a field, a heat bath, a gas, a kick), its icon and a short caption,
   and the same tone, icon and caption for an environment aspect read back from a frame. */
import type { InfluenceStep, NumberOrParameter } from '@standard-model/contracts';
import { formatNumber } from './format';
import { say } from './language';
import { influenceParameters, isInfluenceScalar } from './plan-edits';

export type InfluenceVisualKind = 'beam' | 'field' | 'heat' | 'cold' | 'gas' | 'plain';

export interface InfluenceVisual {
  readonly kind: InfluenceVisualKind;
  readonly tone: string;
  readonly icon: string;
  readonly caption: string;
  readonly waveLength: number;
}

interface Band {
  readonly tone: string;
  readonly icon: string;
  readonly title: readonly [string, string];
  readonly upperFrequencyInHertz: number;
  readonly waveLength: number;
}

const BANDS: readonly Band[] = [
  {
    tone: 'microwave',
    icon: 'microwave',
    title: ['СВЧ', 'microwave'],
    upperFrequencyInHertz: 3e11,
    waveLength: 64,
  },
  {
    tone: 'infrared',
    icon: 'infrared',
    title: ['ИК', 'IR'],
    upperFrequencyInHertz: 4e14,
    waveLength: 40,
  },
  {
    tone: 'visible',
    icon: 'visible-light',
    title: ['свет', 'light'],
    upperFrequencyInHertz: 7.9e14,
    waveLength: 26,
  },
  {
    tone: 'ultraviolet',
    icon: 'ultraviolet',
    title: ['УФ', 'UV'],
    upperFrequencyInHertz: 3e16,
    waveLength: 16,
  },
  {
    tone: 'xray',
    icon: 'x-ray',
    title: ['рентген', 'X-ray'],
    upperFrequencyInHertz: 3e19,
    waveLength: 10,
  },
  {
    tone: 'gamma',
    icon: 'gamma-ray',
    title: ['гамма', 'gamma'],
    upperFrequencyInHertz: Infinity,
    waveLength: 6,
  },
];

type Prefix = readonly [number, string, string];

const FREQUENCY_PREFIXES: readonly Prefix[] = [
  [1e18, 'ЭГц', 'EHz'],
  [1e15, 'ПГц', 'PHz'],
  [1e12, 'ТГц', 'THz'],
  [1e9, 'ГГц', 'GHz'],
  [1e6, 'МГц', 'MHz'],
  [1e3, 'кГц', 'kHz'],
  [1, 'Гц', 'Hz'],
];

const POWER_PREFIXES: readonly Prefix[] = [
  [1e9, 'ГВт', 'GW'],
  [1e6, 'МВт', 'MW'],
  [1e3, 'кВт', 'kW'],
  [1, 'Вт', 'W'],
  [1e-3, 'мВт', 'mW'],
];

function withPrefix(value: number, prefixes: readonly Prefix[]): string {
  const [scale, russian, english] = prefixes.find(([candidate]) => Math.abs(value) >= candidate) ??
    prefixes[prefixes.length - 1] ?? [1, '', ''];
  return `${formatNumber(value / scale)} ${say(russian, english)}`;
}

function value(
  step: InfluenceStep,
  name: string,
): NumberOrParameter | string | boolean | undefined {
  const entry = step.parameters?.[name];
  return isInfluenceScalar(entry) ? entry : undefined;
}

function mediumText(step: InfluenceStep, symbolOf: SymbolOf): string {
  const components = influenceParameters(step).components;
  const parts = (isInfluenceScalar(components) ? [] : (components ?? [])).map(
    (component) =>
      `${symbolOf(String(component.species ?? '—'))} ${text(component.numberDensityPerCubicMeter, say(' м⁻³', ' m⁻³'))}`,
  );
  const pressure = value(step, 'pressureInPascals');
  const radiation = value(step, 'radiationTemperatureInKelvin');
  return [
    parts.length === 0 ? '—' : parts.join(' + '),
    ...(pressure === undefined ? [] : [`P = ${text(pressure, say(' Па', ' Pa'))}`]),
    ...(radiation === undefined ? [] : [`T_γ = ${text(radiation, say(' К', ' K'))}`]),
  ].join(' · ');
}

function text(entry: NumberOrParameter | string | boolean | undefined, unit = ''): string {
  if (entry === undefined) {
    return '—';
  }
  return typeof entry === 'number' ? `${formatNumber(entry)}${unit}` : String(entry);
}

function vectorText(step: InfluenceStep, unit: string): string {
  const parts = ['x', 'y', 'z'].map((axis) => value(step, `${axis}${unit}`) ?? 0);
  return parts.every((part) => typeof part === 'number')
    ? formatNumber(Math.hypot(...(parts as number[])))
    : parts.map((part) => text(part)).join(', ');
}

function plain(icon: string, caption: string): InfluenceVisual {
  return { kind: 'plain', tone: 'influence', icon, caption, waveLength: 0 };
}

const ENERGY_PREFIXES: readonly Prefix[] = [
  [1e9, 'ГэВ', 'GeV'],
  [1e6, 'МэВ', 'MeV'],
  [1e3, 'кэВ', 'keV'],
  [1, 'эВ', 'eV'],
];

const ENERGY_LABELED_TONES = new Set(['ultraviolet', 'xray', 'gamma']);

export function influenceVisual(
  step: InfluenceStep,
  photonEnergyPerHertzInEv: number | null = null,
  symbolOf: SymbolOf = (name) => name,
): InfluenceVisual {
  switch (step.influence) {
    case 'irradiate': {
      const frequency = value(step, 'frequencyInHertz');
      const power = value(step, 'powerInWatts');
      const band =
        typeof frequency === 'number'
          ? (BANDS.find((candidate) => frequency < candidate.upperFrequencyInHertz) ?? BANDS[0])
          : BANDS[0];
      const frequencyText =
        typeof frequency !== 'number'
          ? text(frequency)
          : photonEnergyPerHertzInEv !== null && ENERGY_LABELED_TONES.has(band?.tone ?? '')
            ? withPrefix(frequency * photonEnergyPerHertzInEv, ENERGY_PREFIXES)
            : withPrefix(frequency, FREQUENCY_PREFIXES);
      const powerText = typeof power === 'number' ? withPrefix(power, POWER_PREFIXES) : text(power);
      return {
        kind: 'beam',
        tone: band?.tone ?? 'microwave',
        icon: band?.icon ?? 'irradiate',
        caption: `${band === undefined ? say('излучение', 'radiation') : say(...band.title)} ${frequencyText} · ${powerText}`,
        waveLength: band?.waveLength ?? 0,
      };
    }
    case 'laserCool':
      return {
        kind: 'beam',
        tone: 'laser',
        icon: 'laser-cooling',
        caption: `${say('лазерное охлаждение', 'laser cooling')}, δ = ${text(value(step, 'detuningInLinewidths') ?? -0.5)}Γ`,
        waveLength: 0,
      };
    case 'applyMagneticField':
      return {
        kind: 'field',
        tone: 'magnetic',
        icon: 'magnetic-field',
        caption: `B = ${vectorText(step, 'InTesla')} ${say('Тл', 'T')}`,
        waveLength: 0,
      };
    case 'applyElectricField':
      return {
        kind: 'field',
        tone: 'electric',
        icon: 'electric-field',
        caption: `E = ${vectorText(step, 'InVoltsPerMeter')} ${say('В/м', 'V/m')}`,
        waveLength: 0,
      };
    case 'removeMagneticField':
      return plain('remove-field', say('поле снято', 'field removed'));
    case 'setTemperature':
      return {
        kind: 'heat',
        tone: 'heat',
        icon: 'temperature',
        caption: `T = ${text(value(step, 'temperatureInKelvin'), say(' К', ' K'))}`,
        waveLength: 0,
      };
    case 'heat':
      return {
        kind: 'heat',
        tone: 'heat',
        icon: 'heat',
        caption: say(
          `нагрев на ${text(value(step, 'byKelvin'), ' К')}`,
          `heating by ${text(value(step, 'byKelvin'), ' K')}`,
        ),
        waveLength: 0,
      };
    case 'cool':
      return {
        kind: 'cold',
        tone: 'cold',
        icon: 'cool',
        caption: say(
          `охлаждение на ${text(value(step, 'byKelvin'), ' К')}`,
          `cooling by ${text(value(step, 'byKelvin'), ' K')}`,
        ),
        waveLength: 0,
      };
    case 'setMedium':
      return {
        kind: 'gas',
        tone: 'gas',
        icon: 'medium-gas',
        caption: `${say('среда', 'medium')}: ${mediumText(step, symbolOf)}`,
        waveLength: 0,
      };
    case 'boost':
      return plain('boost', `${say('буст', 'boost')} ${vectorText(step, 'Fraction')}c`);
    case 'rotateSpin':
      return plain(
        'rotate-spin',
        say(
          `поворот спина на ${text(value(step, 'angleRadians'), ' рад')}`,
          `spin rotation by ${text(value(step, 'angleRadians'), ' rad')}`,
        ),
      );
    case 'thermalize':
      return plain('thermalize', say('тепловое равновесие спина', 'spin thermal equilibrium'));
    case 'randomize':
      return plain('randomize', say('случайное состояние спина', 'random spin state'));
    case 'travel':
      return plain(
        'travel',
        say(
          `пролет ${text(value(step, 'distanceInKilometers'), ' км')}`,
          `flight of ${text(value(step, 'distanceInKilometers'), ' km')}`,
        ),
      );
    case 'setCoherenceTimes':
      return plain('coherence-time', say('времена когерентности T₁, T₂', 'coherence times T₁, T₂'));
    case 'evolve':
      return plain(
        'evolve',
        say(
          `эволюция ${text(value(step, 'durationInSeconds'), ' с')}`,
          `evolution for ${text(value(step, 'durationInSeconds'), ' s')}`,
        ),
      );
    default:
      return plain('influence', step.influence);
  }
}

export interface EnvironmentVisual {
  readonly tone: string;
  readonly icon: string;
  readonly caption: string;
  readonly detail: string;
}

export type SymbolOf = (name: string) => string;

interface MediumValue {
  readonly components?: readonly {
    readonly species?: string;
    readonly numberDensityPerCubicMeter?: number;
  }[];
  readonly temperatureInKelvin?: number;
  readonly pressureInPascals?: number;
  readonly radiationTemperatureInKelvin?: number;
}

function vectorMagnitude(vector: unknown): number {
  const { x = 0, y = 0, z = 0 } = (vector ?? {}) as { x?: number; y?: number; z?: number };
  return Math.hypot(x, y, z);
}

const ASPECT_TITLES: Readonly<Record<string, readonly [string, string]>> = {
  medium: ['среда', 'medium'],
  temperature: ['температура', 'temperature'],
  magneticField: ['поле B', 'field B'],
  electricField: ['поле E', 'field E'],
  coherenceTimes: ['времена T₁, T₂', 'times T₁, T₂'],
  neutrinoMixing: ['смешивание ν', 'ν mixing'],
};

export function environmentVisual(
  aspect: string,
  value: unknown,
  symbolOf: SymbolOf = (name) => name,
): EnvironmentVisual {
  const title = ASPECT_TITLES[aspect] ?? [aspect, aspect];
  const plainVisual = (
    caption: string,
    tone = 'influence',
    icon = 'influence',
  ): EnvironmentVisual => ({
    tone,
    icon,
    caption,
    detail: caption,
  });
  if (value === null || value === undefined) {
    return plainVisual(
      say(`${title[0]} снято`, `${title[1]} removed`),
      'influence',
      'remove-field',
    );
  }
  switch (aspect) {
    case 'medium': {
      const medium = value as MediumValue;
      const components = medium.components ?? [];
      const temperature = text(medium.temperatureInKelvin, say(' К', ' K'));
      const names = components.map((component) => symbolOf(component.species ?? '—'));
      const parts = components.map(
        (component) =>
          `${symbolOf(component.species ?? '—')} ${text(component.numberDensityPerCubicMeter, say(' м⁻³', ' m⁻³'))}`,
      );
      const pressure =
        medium.pressureInPascals === undefined
          ? ''
          : ` · P = ${text(medium.pressureInPascals, say(' Па', ' Pa'))}`;
      const radiation =
        medium.radiationTemperatureInKelvin === undefined
          ? ''
          : ` · T_γ = ${text(medium.radiationTemperatureInKelvin, say(' К', ' K'))}`;
      return {
        tone: 'gas',
        icon: 'medium-gas',
        caption: `${say('среда', 'medium')}: ${names.join(', ') || '—'} · ${temperature}${pressure}`,
        detail: `${say('среда', 'medium')}: ${parts.join(' + ') || '—'} · ${temperature}${pressure}${radiation}`,
      };
    }
    case 'temperature':
      return plainVisual(
        `T = ${text((value as { temperatureInKelvin?: number }).temperatureInKelvin, say(' К', ' K'))}`,
        'heat',
        'temperature',
      );
    case 'magneticField':
      return plainVisual(
        `B = ${formatNumber(vectorMagnitude((value as { fieldInTesla?: unknown }).fieldInTesla))} ${say('Тл', 'T')}`,
        'magnetic',
        'magnetic-field',
      );
    case 'electricField':
      return plainVisual(
        `E = ${formatNumber(vectorMagnitude((value as { fieldInVoltsPerMeter?: unknown }).fieldInVoltsPerMeter))} ${say('В/м', 'V/m')}`,
        'electric',
        'electric-field',
      );
    case 'coherenceTimes':
      return plainVisual(say(...title), 'influence', 'coherence-time');
    default:
      return plainVisual(say(...title));
  }
}

const MOST_GAS_DOTS = 40;
const FEWEST_GAS_DOTS = 6;
const SPARSEST_DRAWN_DENSITY_EXPONENT = 16;
const GAS_DOTS_PER_DECADE = 3;
const ROOM_TEMPERATURE_IN_KELVIN = 300;
const DRIFT_AT_ROOM_TEMPERATURE_IN_SECONDS = 4;
const SLOWEST_DRIFT_IN_SECONDS = 6;
const FASTEST_DRIFT_IN_SECONDS = 0.5;

export function gasDotCount(value: unknown): number {
  const total = ((value as MediumValue).components ?? []).reduce(
    (sum, component) => sum + (component.numberDensityPerCubicMeter ?? 0),
    0,
  );
  return total <= 0
    ? 0
    : Math.min(
        MOST_GAS_DOTS,
        Math.max(
          FEWEST_GAS_DOTS,
          Math.round((Math.log10(total) - SPARSEST_DRAWN_DENSITY_EXPONENT) * GAS_DOTS_PER_DECADE),
        ),
      );
}

export function gasDriftSeconds(value: unknown): number {
  const temperature = (value as MediumValue).temperatureInKelvin ?? ROOM_TEMPERATURE_IN_KELVIN;
  return Math.min(
    SLOWEST_DRIFT_IN_SECONDS,
    Math.max(
      FASTEST_DRIFT_IN_SECONDS,
      DRIFT_AT_ROOM_TEMPERATURE_IN_SECONDS /
        Math.sqrt(Math.max(temperature, 1) / ROOM_TEMPERATURE_IN_KELVIN),
    ),
  );
}
