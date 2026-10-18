/* Checks preset lookup by parameter name and the particle grouping used by the guided picker. */
import type { PresetCatalog } from '@standard-model/contracts';
import { describe, expect, it } from 'vitest';
import { selectedPresetIndex } from '../src/components/number-or-parameter-input';
import {
  matterKindOf,
  momentumPresets,
  particleClassOf,
  presetsForParameter,
} from '../src/presets';

const PRESETS: PresetCatalog = {
  momentumInGev: [{ label: 'rest', value: 0, note: '' }],
  momentumInGevByParticle: { muon: [{ label: 'cosmic', value: 4, note: '' }] },
  durationInSeconds: [{ label: 'ns', value: 1e-9, note: '' }],
  magneticFieldInTesla: [{ label: 'mri', value: 1.5, note: '' }],
  electricFieldInVoltsPerMeter: [{ label: 'air', value: 3e6, note: '' }],
  temperatureInKelvin: [{ label: 'room', value: 293, note: '' }],
  coherenceTimeInSeconds: [{ label: 'qubit', value: 1e-4, note: '' }],
  numberDensityPerCubicMeter: [{ label: 'air', value: 2.7e25, note: '' }],
  crossSectionInSquareMeters: [{ label: 'thomson', value: 6.65e-29, note: '' }],
  velocityFraction: [{ label: 'half', value: 0.5, note: '' }],
  velocityInMetersPerSecond: [{ label: 'wind', value: 4e5, note: '' }],
  angleDegrees: [{ label: '90', value: 90, note: '' }],
  angleRadians: [{ label: 'pi', value: Math.PI, note: '' }],
  distanceInKilometers: [{ label: 't2k', value: 295, note: '' }],
  shots: [{ label: '1e4', value: 10_000, note: '' }],
  slitSeparationInMeters: [{ label: 'd', value: 1e-6, note: '' }],
  slitWidthInMeters: [{ label: 'a', value: 2e-7, note: '' }],
  screenDistanceInMeters: [{ label: 'L', value: 1, note: '' }],
  cellSizeInMeters: [{ label: 'cell', value: 5e-11, note: '' }],
  packetWidthInMeters: [{ label: 'width', value: 1e-10, note: '' }],
  spaceDurationInSeconds: [{ label: 'fs', value: 1e-15, note: '' }],
  potentialEnergyInEv: [{ label: 'ev', value: 1, note: '' }],
  frequencyInHertz: [{ label: 'microwave', value: 2.45e9, note: '' }],
  powerInWatts: [{ label: 'kW', value: 1e3, note: '' }],
  beamAreaInSquareMeters: [{ label: 'cm2', value: 1e-4, note: '' }],
  detuningInLinewidths: [{ label: 'half', value: -0.5, note: '' }],
  saturationParameter: [{ label: 'weak', value: 0.1, note: '' }],
};

describe('presets', () => {
  it('maps parameter names to preset lists by their unit suffix', () => {
    expect(presetsForParameter(PRESETS, 'zInTesla')[0]?.label).toBe('mri');
    expect(presetsForParameter(PRESETS, 'byKelvin')[0]?.label).toBe('room');
    expect(presetsForParameter(PRESETS, 'dephasingTimeInSeconds')[0]?.label).toBe('qubit');
    expect(presetsForParameter(PRESETS, 'durationInSeconds')[0]?.label).toBe('ns');
    expect(presetsForParameter(PRESETS, 'xFraction')[0]?.label).toBe('half');
    expect(presetsForParameter(PRESETS, 'polarAngleDegrees')[0]?.label).toBe('90');
    expect(presetsForParameter(PRESETS, 'species')).toEqual([]);
    expect(presetsForParameter(PRESETS, 'frequencyInHertz')[0]?.label).toBe('microwave');
    expect(presetsForParameter(PRESETS, 'detuningInLinewidths')[0]?.label).toBe('half');
  });

  it('shows the preset whose value the field currently holds', () => {
    expect(selectedPresetIndex(PRESETS.angleDegrees, 90)).toBe(0);
    expect(selectedPresetIndex(PRESETS.angleDegrees, 91)).toBe(-1);
    expect(selectedPresetIndex(PRESETS.angleDegrees, '{{angle}}')).toBe(-1);
    expect(selectedPresetIndex([{ label: 'rest', value: 0, note: '' }], 0)).toBe(-1);
  });

  it('prepends particle-specific momentum presets and groups particles', () => {
    expect(momentumPresets(PRESETS, 'muon').map((preset) => preset.label)).toEqual([
      'cosmic',
      'rest',
    ]);
    expect(momentumPresets(PRESETS, 'photon').map((preset) => preset.label)).toEqual(['rest']);
    expect(particleClassOf({ family: 'neutrino' })).toBe('fermion');
    expect(particleClassOf({ family: 'scalarBoson' })).toBe('boson');
    expect(particleClassOf({ family: 'baryon' })).toBe('hadron');
    expect(particleClassOf({ family: 'nucleus' })).toBe('nucleus');
    expect(particleClassOf({ family: 'atom' })).toBe('atom');
    expect(particleClassOf({ family: 'diquark' })).toBeNull();
    expect(matterKindOf({ pdgId: -11 })).toBe('antimatter');
    expect(matterKindOf({ pdgId: 22 })).toBe('matter');
  });
});
