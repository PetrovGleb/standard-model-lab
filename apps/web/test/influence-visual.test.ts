/* Checks how influence steps are pictured on the system stage: spectral band of a photon beam, fields, baths and captions. */
import { describe, expect, it } from 'vitest';
import { environmentVisual, influenceVisual } from '../src/influence-visual';

describe('influenceVisual', () => {
  it('pictures irradiation as a beam of its spectral band', () => {
    const microwave = influenceVisual({
      operation: 'influence',
      influence: 'irradiate',
      parameters: { frequencyInHertz: 2.45e9, powerInWatts: 1000 },
    });
    expect(microwave).toMatchObject({ kind: 'beam', tone: 'microwave', icon: 'microwave' });
    expect(microwave.caption).toBe('СВЧ 2.45 ГГц · 1 кВт');
    const gammaRay = influenceVisual({
      operation: 'influence',
      influence: 'irradiate',
      parameters: { frequencyInHertz: 9.7e20 },
    });
    expect(gammaRay.tone).toBe('gamma');
    const gammaWithEnergy = influenceVisual(
      {
        operation: 'influence',
        influence: 'irradiate',
        parameters: { frequencyInHertz: 1e21, powerInWatts: 1 },
      },
      4e-15,
    );
    expect(gammaWithEnergy.caption).toBe('гамма 4 МэВ · 1 Вт');
  });

  it('pictures fields, baths and gases', () => {
    expect(
      influenceVisual({
        operation: 'influence',
        influence: 'applyMagneticField',
        parameters: { zInTesla: 1 },
      }),
    ).toMatchObject({ kind: 'field', caption: 'B = 1 Тл' });
    expect(
      influenceVisual({ operation: 'influence', influence: 'cool', parameters: { byKelvin: 10 } })
        .kind,
    ).toBe('cold');
    expect(
      influenceVisual({ operation: 'influence', influence: 'setMedium', parameters: {} }).kind,
    ).toBe('gas');
  });
});

describe('environmentVisual', () => {
  it('writes pressure into the medium caption and the radiation temperature into its detail', () => {
    const visual = environmentVisual('medium', {
      components: [{ species: 'hydrogenAtom', numberDensityPerCubicMeter: 1e23 }],
      temperatureInKelvin: 5772,
      pressureInPascals: 1e4,
      radiationTemperatureInKelvin: 5772,
    });
    expect(visual.caption).toContain('P = ');
    expect(visual.caption).not.toContain('T_γ');
    expect(visual.detail).toContain('T_γ = ');
  });
});
