/* Preset lookups and particle grouping for the builder: which preset list fits a numeric field, particle class and matter kind. */
import type {
  EnvironmentScales,
  ParticleCatalogEntry,
  ScaleLandmark,
  ParticleName,
  Preset,
  PresetCatalog,
} from '@standard-model/contracts';
import { bilingual, say } from './language';

export function presetsForParameter(presets: PresetCatalog, name: string): readonly Preset[] {
  if (name.endsWith('InTesla')) {
    return presets.magneticFieldInTesla;
  }
  if (name.endsWith('InVoltsPerMeter')) {
    return presets.electricFieldInVoltsPerMeter;
  }
  if (name === 'temperatureInKelvin' || name === 'byKelvin') {
    return presets.temperatureInKelvin;
  }
  if (name === 'durationInSeconds') {
    return presets.durationInSeconds;
  }
  if (name.endsWith('TimeInSeconds')) {
    return presets.coherenceTimeInSeconds;
  }
  if (name === 'numberDensityPerCubicMeter') {
    return presets.numberDensityPerCubicMeter;
  }
  if (name === 'crossSectionInSquareMeters') {
    return presets.crossSectionInSquareMeters;
  }
  if (name.endsWith('Fraction')) {
    return presets.velocityFraction;
  }
  if (name.endsWith('VelocityInMetersPerSecond')) {
    return presets.velocityInMetersPerSecond;
  }
  if (name.endsWith('AngleDegrees') || name === 'azimuthDegrees') {
    return presets.angleDegrees;
  }
  if (name === 'angleRadians') {
    return presets.angleRadians;
  }
  if (name === 'cellSizeInMeters') {
    return presets.cellSizeInMeters;
  }
  if (name === 'widthInMeters' || name === 'barrierThicknessInMeters') {
    return presets.packetWidthInMeters;
  }
  if (name === 'potentialEnergyInEv') {
    return presets.potentialEnergyInEv;
  }
  if (name === 'spaceDurationInSeconds') {
    return presets.spaceDurationInSeconds;
  }
  if (name === 'slitSeparationInMeters') {
    return presets.slitSeparationInMeters;
  }
  if (name === 'slitWidthInMeters') {
    return presets.slitWidthInMeters;
  }
  if (name === 'screenDistanceInMeters') {
    return presets.screenDistanceInMeters;
  }
  if (name === 'distanceInKilometers') {
    return presets.distanceInKilometers;
  }
  if (name === 'frequencyInHertz') {
    return presets.frequencyInHertz;
  }
  if (name === 'powerInWatts') {
    return presets.powerInWatts;
  }
  if (name === 'beamAreaInSquareMeters') {
    return presets.beamAreaInSquareMeters;
  }
  if (name === 'detuningInLinewidths') {
    return presets.detuningInLinewidths;
  }
  if (name === 'saturationParameter') {
    return presets.saturationParameter;
  }
  return [];
}

export function momentumPresets(
  presets: PresetCatalog,
  particle: ParticleName | null,
): readonly Preset[] {
  const specific = particle === null ? [] : (presets.momentumInGevByParticle[particle] ?? []);
  return [...specific, ...presets.momentumInGev];
}

export type ParticleClass = 'fermion' | 'boson' | 'hadron' | 'nucleus' | 'atom';
export type MatterKind = 'matter' | 'antimatter';

export const PARTICLE_CLASS_LABELS = bilingual<ParticleClass>({
  fermion: ['Фермион', 'Fermion'],
  boson: ['Бозон', 'Boson'],
  hadron: ['Адрон: мезон или барион', 'Hadron: meson or baryon'],
  nucleus: ['Атомное ядро', 'Atomic nucleus'],
  atom: ['Атом или ион', 'Atom or ion'],
});

export const MATTER_KIND_LABELS = bilingual<MatterKind>({
  matter: ['Вещество', 'Matter'],
  antimatter: ['Антивещество', 'Antimatter'],
});

export function particleClassOf(entry: Pick<ParticleCatalogEntry, 'family'>): ParticleClass | null {
  switch (entry.family) {
    case 'quark':
    case 'chargedLepton':
    case 'neutrino':
      return 'fermion';
    case 'gaugeBoson':
    case 'scalarBoson':
      return 'boson';
    case 'baryon':
    case 'meson':
      return 'hadron';
    case 'nucleus':
      return 'nucleus';
    case 'atom':
      return 'atom';
    case 'diquark':
    case 'molecule':
      return null;
  }
}

export function matterKindOf(entry: Pick<ParticleCatalogEntry, 'pdgId'>): MatterKind {
  return entry.pdgId < 0 ? 'antimatter' : 'matter';
}

export function particlesIn(
  entries: readonly ParticleCatalogEntry[],
  particleClass: ParticleClass,
  kind: MatterKind,
): readonly ParticleCatalogEntry[] {
  return entries.filter(
    (entry) => particleClassOf(entry) === particleClass && matterKindOf(entry) === kind,
  );
}

const SCALE_OF_PARAMETER: Readonly<Record<string, keyof EnvironmentScales>> = {
  numberDensityPerCubicMeter: 'numberDensityPerCubicMeter',
  temperatureInKelvin: 'temperatureInKelvin',
  radiationTemperatureInKelvin: 'temperatureInKelvin',
  pressureInPascals: 'pressureInPascals',
};

export const SCALE_UNITS = bilingual<string>({
  numberDensityPerCubicMeter: ['м⁻³', 'm⁻³'],
  temperatureInKelvin: ['К', 'K'],
  radiationTemperatureInKelvin: ['К', 'K'],
  pressureInPascals: ['Па', 'Pa'],
});

export function scaleLandmarks(
  scales: EnvironmentScales | undefined,
  parameter: string,
): readonly ScaleLandmark[] | undefined {
  const key = SCALE_OF_PARAMETER[parameter];
  return key === undefined ? undefined : scales?.[key];
}

const PARAMETER_UNITS: readonly (readonly [RegExp, readonly [string, string]])[] = [
  [/InKelvin$|^byKelvin$/, ['К', 'K']],
  [/InPascals$/, ['Па', 'Pa']],
  [/PerCubicMeter$/, ['м⁻³', 'm⁻³']],
  [/InSquareMeters$/, ['м²', 'm²']],
  [/InMetersPerSecond$/, ['м/с', 'm/s']],
  [/InVoltsPerMeter$/, ['В/м', 'V/m']],
  [/InKilometers$/, ['км', 'km']],
  [/InMeters$/, ['м', 'm']],
  [/InSeconds$/, ['с', 's']],
  [/InTesla$/, ['Тл', 'T']],
  [/InGev$/, ['ГэВ', 'GeV']],
  [/InKev$/, ['кэВ', 'keV']],
  [/InEv$/, ['эВ', 'eV']],
  [/InHertz$/, ['Гц', 'Hz']],
  [/InWatts$/, ['Вт', 'W']],
  [/Degrees$/, ['°', '°']],
  [/Radians$/, ['рад', 'rad']],
  [/Fraction$/, ['c', 'c']],
  [/InLinewidths$/, ['Γ', 'Γ']],
];

export function unitOfParameter(name: string): string {
  const unit = PARAMETER_UNITS.find(([pattern]) => pattern.test(name))?.[1];
  return unit === undefined ? '' : say(unit[0], unit[1]);
}
