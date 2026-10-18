/* Checks the preset environments and scales: every preset is bilingual, sourced and made of known species, the Earth atmosphere presets obey the ideal gas law, the scale landmarks ascend, and the phase tables key substances by their bond graph regardless of isotopes and atom order while telling isomers apart. */
import type { ScaleLandmark } from '@standard-model/contracts';
import { BOLTZMANN_CONSTANT } from '../src/codata.generated.js';
import { ENVIRONMENT_PRESETS, ENVIRONMENT_SCALES } from '../src/environments.js';
import { MOLECULE_CATALOG } from '../src/molecule-catalog.js';
import { criticalData, substanceKey } from '../src/phase-data.js';
import { moleculeName, particleSpec } from '../src/particles/matter.js';
import { describe, expect, it } from 'vitest';

const IDEAL_GAS_AGREEMENT = 0.03;
const MINIMUM_LANDMARKS = 3;
const ISOTOPOLOGUES = ['deuterium', 'hydrogenDeuteride', 'heavyWater', 'semiheavyWater'];

function idealGasPressure(preset: (typeof ENVIRONMENT_PRESETS)[number]): number {
  return (
    preset.components.reduce((sum, component) => sum + component.numberDensityPerCubicMeter, 0) *
    BOLTZMANN_CONSTANT.value *
    preset.temperatureInKelvin
  );
}

describe('environment presets', () => {
  it('names every preset once, in both languages, with a source and known species', () => {
    const names = ENVIRONMENT_PRESETS.map((preset) => preset.name);
    expect(new Set(names).size).toBe(names.length);
    ENVIRONMENT_PRESETS.forEach((preset) => {
      expect(preset.title.ru.length).toBeGreaterThan(0);
      expect(preset.title.en.length).toBeGreaterThan(0);
      expect(preset.group.ru.length).toBeGreaterThan(0);
      expect(preset.group.en.length).toBeGreaterThan(0);
      expect(preset.note.ru.length).toBeGreaterThan(0);
      expect(preset.note.en.length).toBeGreaterThan(0);
      expect(preset.source.length).toBeGreaterThan(0);
      expect(preset.components.length).toBeGreaterThan(0);
      expect(preset.temperatureInKelvin).toBeGreaterThan(0);
      expect(preset.pressureInPascals).toBeGreaterThanOrEqual(0);
      preset.components.forEach((component) => {
        expect(particleSpec(component.species).name).toBe(component.species);
        expect(component.numberDensityPerCubicMeter).toBeGreaterThan(0);
      });
      if (preset.radiationTemperatureInKelvin !== null) {
        expect(preset.radiationTemperatureInKelvin).toBeGreaterThan(0);
      }
    });
  });

  it('keeps the Earth atmosphere presets on the ideal gas law', () => {
    const atmosphere = ENVIRONMENT_PRESETS.filter((preset) => preset.name.startsWith('earth'));
    expect(atmosphere.length).toBeGreaterThan(MINIMUM_LANDMARKS);
    atmosphere.forEach((preset) => {
      expect(Math.abs(idealGasPressure(preset) / preset.pressureInPascals - 1)).toBeLessThan(
        IDEAL_GAS_AGREEMENT,
      );
    });
  });

  it('draws ascending bilingual landmarks on every scale', () => {
    Object.values(ENVIRONMENT_SCALES).forEach((landmarks) => {
      expect(landmarks.length).toBeGreaterThanOrEqual(MINIMUM_LANDMARKS);
      landmarks.forEach((landmark: ScaleLandmark, index: number) => {
        expect(landmark.label.ru.length).toBeGreaterThan(0);
        expect(landmark.label.en.length).toBeGreaterThan(0);
        if (index > 0) {
          expect(landmark.value).toBeGreaterThan(landmarks[index - 1]?.value ?? 0);
        }
      });
    });
  });
});

describe('critical-point table', () => {
  it('finds water by composition whatever the isotopes and orders its points', () => {
    const light = moleculeName({
      atoms: [
        { protons: 8, massNumber: 16 },
        { protons: 1, massNumber: 1 },
        { protons: 1, massNumber: 1 },
      ],
      bonds: [
        { first: 0, second: 1, order: 1 },
        { first: 0, second: 2, order: 1 },
      ],
    });
    const heavy = moleculeName({
      atoms: [
        { protons: 1, massNumber: 2 },
        { protons: 8, massNumber: 18 },
        { protons: 1, massNumber: 2 },
      ],
      bonds: [
        { first: 1, second: 0, order: 1 },
        { first: 1, second: 2, order: 1 },
      ],
    });
    expect(substanceKey(light)).toBe(substanceKey(heavy));
    const water = criticalData(light);
    expect(water).not.toBeNull();
    expect(water?.criticalTemperatureInKelvin ?? 0).toBeGreaterThan(
      water?.boilingTemperatureInKelvin ?? 0,
    );
    expect(water?.boilingTemperatureInKelvin ?? 0).toBeGreaterThan(
      water?.meltingTemperatureInKelvin ?? 0,
    );
    expect(criticalData('electron')).toBeNull();
  });

  it('tells every isomer in the molecule catalogue apart and joins only isotopologues', () => {
    const keys = MOLECULE_CATALOG.map((entry) => substanceKey(entry.name));
    expect(new Set(keys).size).toBe(MOLECULE_CATALOG.length - ISOTOPOLOGUES.length);
    const key = (name: string) =>
      substanceKey(MOLECULE_CATALOG.find((entry) => entry.key === name)?.name ?? 'electron');
    expect(key('ethanol')).not.toBe(key('dimethylEther'));
    expect(key('leucine')).not.toBe(key('isoleucine'));
    expect(key('heavyWater')).toBe(key('water'));
  });
});
