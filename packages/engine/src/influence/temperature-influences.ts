/* Temperature influences: set an absolute temperature or change it by a delta; cool and heat are the two signs. */
import type { Influence, InfluenceOutcome, Particle } from '@standard-model/contracts';
import type { EngineInfluenceContext } from './context.js';
import { LocalizedError, localizedText } from '@standard-model/contracts';

export class SetTemperature implements Influence<EngineInfluenceContext> {
  readonly name = 'setTemperature';

  constructor(private readonly temperatureInKelvin: number) {
    if (temperatureInKelvin < 0) {
      throw new LocalizedError(
        localizedText(
          'температура не может быть ниже абсолютного нуля',
          'Temperature cannot be below absolute zero',
        ),
      );
    }
  }

  apply(targets: readonly Particle[], context: EngineInfluenceContext): InfluenceOutcome {
    return {
      environment: context.environment.with('temperature', {
        temperatureInKelvin: this.temperatureInKelvin,
      }),
      notes: [],
    };
  }
}

export class ChangeTemperature implements Influence<EngineInfluenceContext> {
  readonly name = 'changeTemperature';

  constructor(private readonly deltaInKelvin: number) {}

  apply(targets: readonly Particle[], context: EngineInfluenceContext): InfluenceOutcome {
    const current = context.environment.get('temperature');
    if (current === undefined) {
      throw new LocalizedError(
        localizedText(
          'сначала задайте температуру, потом меняйте ее',
          'Set a temperature before changing it',
        ),
      );
    }
    const next = current.temperatureInKelvin + this.deltaInKelvin;
    if (next < 0) {
      throw new LocalizedError(
        localizedText(
          `охлаждение на ${String(-this.deltaInKelvin)} К опустит температуру ниже абсолютного нуля`,
          `Cooling by ${String(-this.deltaInKelvin)} K would go below absolute zero`,
        ),
      );
    }
    return {
      environment: context.environment.with('temperature', { temperatureInKelvin: next }),
      notes: [],
    };
  }
}

export function cool(byKelvin: number): ChangeTemperature {
  return new ChangeTemperature(-byKelvin);
}

export function heat(byKelvin: number): ChangeTemperature {
  return new ChangeTemperature(byKelvin);
}
