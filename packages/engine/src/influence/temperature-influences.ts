/* Temperature influences: set an absolute temperature or change it by a delta; cool and heat are the two signs. A medium in the same scope takes the new temperature too, so heating the
   environment of some particles heats the gas they react with, and every body of a medium placed in space takes it too; a change starts from the medium temperature when no temperature was set. */
import type { Environment, Influence, InfluenceOutcome, Particle } from '@standard-model/contracts';
import type { EngineInfluenceContext } from './context.js';
import { LocalizedError, localizedText } from '@standard-model/contracts';
import { mediumAtTemperature } from '../environment/medium-extent.js';

function atTemperature(environment: Environment, temperatureInKelvin: number): Environment {
  const medium = environment.get('medium');
  const bodies = environment.get('bodies')?.bodies;
  const withBath = environment.with('temperature', { temperatureInKelvin });
  const withMedium =
    medium === undefined
      ? withBath
      : withBath.with('medium', mediumAtTemperature(medium, temperatureInKelvin));
  return bodies === undefined
    ? withMedium
    : withMedium.with('bodies', {
        bodies: bodies.map((body) => mediumAtTemperature(body, temperatureInKelvin)),
      });
}

export class SetTemperature implements Influence<EngineInfluenceContext> {
  readonly name = 'setTemperature';
  readonly environmentOnly = true;

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
      environment: atTemperature(context.environment, this.temperatureInKelvin),
      notes: [],
    };
  }
}

export class ChangeTemperature implements Influence<EngineInfluenceContext> {
  readonly name = 'changeTemperature';
  readonly environmentOnly = true;

  constructor(private readonly deltaInKelvin: number) {}

  apply(targets: readonly Particle[], context: EngineInfluenceContext): InfluenceOutcome {
    const current =
      context.environment.get('temperature')?.temperatureInKelvin ??
      context.environment.get('medium')?.temperatureInKelvin;
    if (current === undefined) {
      throw new LocalizedError(
        localizedText(
          'сначала задайте температуру или среду, потом меняйте температуру',
          'Set a temperature or a medium before changing the temperature',
        ),
      );
    }
    const next = current + this.deltaInKelvin;
    if (next < 0) {
      throw new LocalizedError(
        localizedText(
          `охлаждение на ${String(-this.deltaInKelvin)} К опустит температуру ниже абсолютного нуля`,
          `Cooling by ${String(-this.deltaInKelvin)} K would go below absolute zero`,
        ),
      );
    }
    return { environment: atTemperature(context.environment, next), notes: [] };
  }
}

export function cool(byKelvin: number): ChangeTemperature {
  return new ChangeTemperature(-byKelvin);
}

export function heat(byKelvin: number): ChangeTemperature {
  return new ChangeTemperature(byKelvin);
}
