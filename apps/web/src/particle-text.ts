/* Text about a particle view shared by the system stage and the side panel: its kind, momentum, spin state, temperature, motion and aggregate state in words; events that say the same about
   several particles folded into one line with a count. */
import type { ParticleView, Phase, QuantumSlotView, SystemEvent } from '@standard-model/contracts';
import { formatNumber } from './format';
import { PARTICLE_GLOSSARY } from './glossary';
import { bilingual, localize, say } from './language';

const TEMPERATURE_UNITS: readonly (readonly [number, string, string])[] = [
  [1, 'К', 'K'],
  [1e-3, 'мК', 'mK'],
  [1e-6, 'мкК', 'µK'],
];
const SLOT_TITLES = bilingual<string>({
  spin: ['Спин', 'Spin'],
  polarization: ['Поляризация', 'Polarization'],
  flavor: ['Аромат', 'Flavor'],
});

export const PHASE_NAMES = bilingual<Phase>({
  solid: ['твердое', 'solid'],
  liquid: ['жидкость', 'liquid'],
  gas: ['газ', 'gas'],
  supercritical: ['сверхкритический флюид', 'supercritical fluid'],
  plasma: ['плазма', 'plasma'],
  solvated: ['в растворе', 'in solution'],
  quarkGluonPlasma: ['кварк-глюонная плазма', 'quark–gluon plasma'],
  decomposed: ['разложилось', 'decomposed'],
});

const ALLOTROPE_NAMES = bilingual<string>({
  graphite: ['графит', 'graphite'],
  diamond: ['алмаз', 'diamond'],
});

export function phaseWord(view: ParticleView): string {
  if (view.phase === undefined) {
    return '';
  }
  const allotrope = view.allotrope === undefined ? undefined : ALLOTROPE_NAMES[view.allotrope];
  return allotrope === undefined ? PHASE_NAMES[view.phase] : allotrope;
}

const KIND_WORDS = bilingual<string>({
  nucleus: ['ядро', 'nucleus'],
  atom: ['атом', 'atom'],
  molecule: ['молекула', 'molecule'],
  baryon: ['барион', 'baryon'],
  meson: ['мезон', 'meson'],
  quark: ['кварк', 'quark'],
  chargedLepton: ['лептон', 'lepton'],
  neutrino: ['нейтрино', 'neutrino'],
  gaugeBoson: ['бозон', 'boson'],
  scalarBoson: ['бозон', 'boson'],
  diquark: ['дикварк', 'diquark'],
});

export function kindWord(view: ParticleView): string {
  if (view.family === 'atom' && view.chargeInElementaryUnits !== 0) {
    return say('ион', 'ion');
  }
  return KIND_WORDS[view.family] ?? view.family;
}

export function motionWord(view: ParticleView): string {
  return magnitude(view.momentumInGev) > 0 ? say('движется', 'moving') : say('в покое', 'at rest');
}

export function nodeCaption(view: ParticleView): string {
  return [
    kindWord(view),
    motionWord(view),
    ...(view.phase === undefined ? [] : [phaseWord(view)]),
  ].join(' · ');
}

export function magnitude(vector: {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}): number {
  return Math.hypot(vector.x, vector.y, vector.z);
}

export function spinSummary(slot: QuantumSlotView): string {
  if (slot.entangled) {
    return say(
      `запутан с ${slot.sharesRegisterWith.join(', ')}; энтропия ${formatNumber(slot.entropyInBits)} бит, собственного направления нет`,
      `entangled with ${slot.sharesRegisterWith.join(', ')}; entropy ${formatNumber(slot.entropyInBits)} bits, no direction of its own`,
    );
  }
  if (slot.blochVector === null) {
    return `${say('заселенности', 'populations')} ${slot.basisPopulations.map((population) => formatNumber(population)).join(' / ')}`;
  }
  const length = magnitude(slot.blochVector);
  const vector = `(${formatNumber(slot.blochVector.x)}, ${formatNumber(slot.blochVector.y)}, ${formatNumber(slot.blochVector.z)})`;
  return length > 0.999
    ? `${say('чистое состояние', 'pure state')}, ⟨σ⟩ = ${vector}`
    : `${say('смешанное', 'mixed')}, |⟨σ⟩| = ${formatNumber(length)}`;
}

export function vectorText(vector: {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}): string {
  return `(${formatNumber(vector.x)}, ${formatNumber(vector.y)}, ${formatNumber(vector.z)})`;
}

export function slotTitle(slot: QuantumSlotView): string {
  return SLOT_TITLES[slot.observable] ?? slot.observable;
}

export function matterTitle(view: ParticleView): string {
  const charge = view.chargeInElementaryUnits;
  switch (view.family) {
    case 'nucleus':
      return `${say('ядро', 'nucleus')} ${view.symbol}`;
    case 'atom':
      return `${charge === 0 ? say('атом', 'atom') : say('ион', 'ion')} ${view.symbol}`;
    case 'molecule':
      return `${say('молекула', 'molecule')} ${view.symbol}`;
    default:
      return PARTICLE_GLOSSARY[view.name] ?? view.name;
  }
}

export function temperatureText(kelvin: number): string {
  if (kelvin === 0) {
    return `0 ${say('К', 'K')}`;
  }
  const [scale, russian, english] = TEMPERATURE_UNITS.find(
    ([threshold]) => kelvin >= threshold,
  ) ?? [1e-6, 'мкК', 'µK'];
  return `${formatNumber(kelvin / scale)} ${say(russian, english)}`;
}

export interface FoldedEvent {
  readonly event: SystemEvent;
  readonly text: string;
  readonly labels: readonly string[];
  readonly count: number;
}

export function foldedEvents(events: readonly SystemEvent[]): readonly FoldedEvent[] {
  const folded: { event: SystemEvent; text: string; labels: string[]; count: number }[] = [];
  const byKey = new Map<string, (typeof folded)[number]>();
  events.forEach((event) => {
    const text = localize(event.text);
    const [first] = event.labels;
    const body =
      first !== undefined && text.startsWith(`${first}: `) ? text.slice(first.length + 2) : text;
    const key = event.probabilitiesBefore === undefined ? `${event.kind}|${body}` : null;
    const known = key === null ? undefined : byKey.get(key);
    if (known !== undefined) {
      known.labels.push(...event.labels);
      known.count += 1;
      known.text = `×${String(known.count)} · ${body}`;
      return;
    }
    const entry = { event, text, labels: [...event.labels], count: 1 };
    folded.push(entry);
    if (key !== null) {
      byKey.set(key, entry);
    }
  });
  return folded;
}
