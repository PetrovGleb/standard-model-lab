/* InfluenceRegistry: builds influences by name from plain parameters and publishes each influence's parameter definition for plan steps and the UI. */
import { particleSpec } from '@standard-model/constants';
import { idealGasPressureInPascals } from '../environment/aggregate-state.js';
import {
  MEDIUM_REACTION_MODES,
  PARTICLE_NAMES,
  type Influence,
  type InfluenceDefinition,
  type InfluenceParameters,
  type InfluenceParameterSpec,
  type MediumComponent,
  type MediumReactionMode,
  type ParticleName,
} from '@standard-model/contracts';
import { isLepton } from '../collisions/atomic-processes.js';
import { equilibriumNumberDensityPerCubicMeter } from '../particles/deconfinement.js';
import type { EngineInfluenceContext } from './context.js';
import {
  ApplyElectricField,
  ApplyMagneticField,
  RemoveMagneticField,
  SetCoherenceTimes,
  SetMedium,
} from './field-influences.js';
import { Boost, Evolve, Randomize, RotateSpin, Thermalize, Travel } from './particle-influences.js';
import { Electrolyze } from './electrolysis.js';
import { Irradiate, LaserCool } from './radiation-influences.js';
import { ChangeTemperature, SetTemperature } from './temperature-influences.js';
import { LocalizedError, localizedText } from '@standard-model/contracts';

const METERS_PER_KILOMETER = 1000;
const DEFAULT_BEAM_POWER_IN_WATTS = 1;
const DEFAULT_BEAM_AREA_IN_SQUARE_METERS = 1e-4;
const DEFAULT_EXPOSURE_IN_SECONDS = 1e-3;
const OPTIMAL_DETUNING_IN_LINEWIDTHS = -0.5;
const DEFAULT_SATURATION = 1;
const DEFAULT_CURRENT_IN_AMPERES = 1;
const DEFAULT_ELECTROLYSIS_IN_SECONDS = 1e-3;

export type InfluenceFactory = (
  parameters: InfluenceParameters,
) => Influence<EngineInfluenceContext>;

export function requireNumber(parameters: InfluenceParameters, key: string): number {
  const value = parameters[key];
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new LocalizedError(
      localizedText(
        `параметр воздействия ${key} должен быть числом`,
        `Influence parameter ${key} must be a number`,
      ),
    );
  }
  return value;
}

export function optionalNumber(
  parameters: InfluenceParameters,
  key: string,
  fallback: number,
): number {
  return key in parameters ? requireNumber(parameters, key) : fallback;
}

function isKnownParticle(value: unknown): value is ParticleName {
  if (typeof value !== 'string') {
    return false;
  }
  if (PARTICLE_NAMES.some((name) => name === value)) {
    return true;
  }
  try {
    particleSpec(value as ParticleName);
    return true;
  } catch {
    return false;
  }
}

function requireParticleName(parameters: InfluenceParameters, key: string): ParticleName {
  const value = parameters[key];
  if (!isKnownParticle(value)) {
    throw new LocalizedError(
      localizedText(
        `параметр воздействия ${key} должен быть именем частицы: из каталога, ядра, атома или молекулы`,
        `Influence parameter ${key} must be a particle name: from the catalog, a nucleus, an atom or a molecule`,
      ),
    );
  }
  return value;
}

function requireReactionMode(parameters: InfluenceParameters): MediumReactionMode {
  const value = parameters.reactionMode ?? 'oneReactionPerStep';
  const match = MEDIUM_REACTION_MODES.find((mode) => mode === value);
  if (match === undefined) {
    throw new LocalizedError(
      localizedText(
        `параметр воздействия reactionMode должен быть ${MEDIUM_REACTION_MODES.join(' или ')}`,
        `Influence parameter reactionMode must be ${MEDIUM_REACTION_MODES.join(' or ')}`,
      ),
    );
  }
  return match;
}

export const DENSITY_LAWS = ['given', 'thermalEquilibrium'] as const;

function mediumComponents(
  parameters: InfluenceParameters,
  temperatureInKelvin: () => number,
): readonly MediumComponent[] {
  const listed = parameters.components;
  if (listed !== undefined && !Array.isArray(listed)) {
    throw new LocalizedError(
      localizedText(
        'параметр воздействия components должен быть списком',
        'Influence parameter components must be a list',
      ),
    );
  }
  const records: readonly InfluenceParameters[] = listed ?? [parameters];
  const components = records.map((record) => {
    const species = requireParticleName(record, 'species');
    return {
      species,
      numberDensityPerCubicMeter:
        record.densityLaw === 'thermalEquilibrium'
          ? equilibriumNumberDensityPerCubicMeter(species, temperatureInKelvin())
          : requireNumber(record, 'numberDensityPerCubicMeter'),
      crossSectionInSquareMeters: optionalNumber(record, 'crossSectionInSquareMeters', 0),
    };
  });
  const species = components.map((component) => component.species);
  if (components.length === 0) {
    throw new LocalizedError(
      localizedText('среде нужен хотя бы один компонент', 'A medium needs at least one component'),
    );
  }
  if (new Set(species).size !== species.length) {
    throw new LocalizedError(
      localizedText(
        `компоненты среды повторяют вид частиц: ${species.join(', ')}`,
        `Medium components repeat a species: ${species.join(', ')}`,
      ),
    );
  }
  if (species.filter(isLepton).length > 1) {
    throw new LocalizedError(
      localizedText(
        'в среде может быть не больше одного электронного или позитронного компонента',
        'A medium holds at most one electron or positron component',
      ),
    );
  }
  return components;
}

function vectorFrom(parameters: InfluenceParameters, suffix: string) {
  return {
    x: optionalNumber(parameters, `x${suffix}`, 0),
    y: optionalNumber(parameters, `y${suffix}`, 0),
    z: optionalNumber(parameters, `z${suffix}`, 0),
  };
}

function required(name: string): InfluenceParameterSpec {
  return { name, kind: 'number', required: true };
}

function optional(name: string, defaultValue: number): InfluenceParameterSpec {
  return { name, kind: 'number', required: false, defaultValue };
}

function optionalWithoutDefault(name: string): InfluenceParameterSpec {
  return { name, kind: 'number', required: false };
}

function vectorSpecs(suffix: string): readonly InfluenceParameterSpec[] {
  return [optional(`x${suffix}`, 0), optional(`y${suffix}`, 0), optional(`z${suffix}`, 0)];
}

export class InfluenceRegistry {
  private readonly factories = new Map<string, InfluenceFactory>();
  private readonly definitionsByName = new Map<string, InfluenceDefinition>();

  register(definition: InfluenceDefinition, factory: InfluenceFactory): this {
    this.factories.set(definition.name, factory);
    this.definitionsByName.set(definition.name, definition);
    return this;
  }

  get names(): readonly string[] {
    return [...this.factories.keys()];
  }

  get definitions(): readonly InfluenceDefinition[] {
    return [...this.definitionsByName.values()];
  }

  definition(name: string): InfluenceDefinition {
    const definition = this.definitionsByName.get(name);
    if (definition === undefined) {
      throw new LocalizedError(
        localizedText(
          `неизвестное воздействие ${name}; известны: ${this.names.join(', ')}`,
          `Unknown influence ${name}; known: ${this.names.join(', ')}`,
        ),
      );
    }
    return definition;
  }

  create(name: string, parameters: InfluenceParameters = {}): Influence<EngineInfluenceContext> {
    const factory = this.factories.get(name);
    if (factory === undefined) {
      throw new LocalizedError(
        localizedText(
          `неизвестное воздействие ${name}; известны: ${this.names.join(', ')}`,
          `Unknown influence ${name}; known: ${this.names.join(', ')}`,
        ),
      );
    }
    return factory(parameters);
  }
}

export function createDefaultInfluenceRegistry(): InfluenceRegistry {
  return new InfluenceRegistry()
    .register(
      {
        name: 'setTemperature',
        description: 'Set the environment temperature',
        parameters: [required('temperatureInKelvin')],
      },
      (parameters) => new SetTemperature(requireNumber(parameters, 'temperatureInKelvin')),
    )
    .register(
      {
        name: 'cool',
        description: 'Lower the temperature by an amount',
        parameters: [required('byKelvin')],
      },
      (parameters) => new ChangeTemperature(-requireNumber(parameters, 'byKelvin')),
    )
    .register(
      {
        name: 'heat',
        description: 'Raise the temperature by an amount',
        parameters: [required('byKelvin')],
      },
      (parameters) => new ChangeTemperature(requireNumber(parameters, 'byKelvin')),
    )
    .register(
      {
        name: 'applyMagneticField',
        description: 'Set a uniform magnetic field vector',
        parameters: vectorSpecs('InTesla'),
      },
      (parameters) => new ApplyMagneticField(vectorFrom(parameters, 'InTesla')),
    )
    .register(
      { name: 'removeMagneticField', description: 'Remove the magnetic field', parameters: [] },
      () => new RemoveMagneticField(),
    )
    .register(
      {
        name: 'applyElectricField',
        description: 'Set a uniform electric field vector',
        parameters: vectorSpecs('InVoltsPerMeter'),
      },
      (parameters) => new ApplyElectricField(vectorFrom(parameters, 'InVoltsPerMeter')),
    )
    .register(
      {
        name: 'setCoherenceTimes',
        description: 'Set phenomenological T2 (dephasing) and T1 (relaxation) times',
        parameters: [
          optionalWithoutDefault('dephasingTimeInSeconds'),
          optionalWithoutDefault('relaxationTimeInSeconds'),
        ],
      },
      (parameters) =>
        new SetCoherenceTimes({
          dephasingTimeInSeconds:
            'dephasingTimeInSeconds' in parameters
              ? requireNumber(parameters, 'dephasingTimeInSeconds')
              : null,
          relaxationTimeInSeconds:
            'relaxationTimeInSeconds' in parameters
              ? requireNumber(parameters, 'relaxationTimeInSeconds')
              : null,
        }),
    )
    .register(
      {
        name: 'setMedium',
        description:
          'Fill space with a statistical medium of one or more particle species sharing one temperature and flow',
        parameters: [
          {
            name: 'components',
            kind: 'list',
            required: true,
            fields: [
              { name: 'species', kind: 'particleName', required: true },
              required('numberDensityPerCubicMeter'),
              optional('crossSectionInSquareMeters', 0),
              {
                name: 'densityLaw',
                kind: 'choice',
                required: false,
                defaultValue: 'given',
                choices: DENSITY_LAWS,
              },
            ],
          },
          required('temperatureInKelvin'),
          optionalWithoutDefault('pressureInPascals'),
          optionalWithoutDefault('radiationTemperatureInKelvin'),
          optionalWithoutDefault('thicknessInMeters'),
          {
            name: 'reactionMode',
            kind: 'choice',
            required: false,
            defaultValue: 'oneReactionPerStep',
            choices: MEDIUM_REACTION_MODES,
          },
          ...vectorSpecs('VelocityInMetersPerSecond'),
        ],
      },
      (parameters) => {
        const components = mediumComponents(parameters, () =>
          requireNumber(parameters, 'temperatureInKelvin'),
        );
        const temperatureInKelvin = requireNumber(parameters, 'temperatureInKelvin');
        const radiation = optionalNumber(parameters, 'radiationTemperatureInKelvin', Number.NaN);
        const thickness = optionalNumber(parameters, 'thicknessInMeters', Number.NaN);
        return new SetMedium({
          components,
          temperatureInKelvin,
          bulkVelocityInMetersPerSecond: vectorFrom(parameters, 'VelocityInMetersPerSecond'),
          reactionMode: requireReactionMode(parameters),
          pressureInPascals: optionalNumber(
            parameters,
            'pressureInPascals',
            idealGasPressureInPascals(components, temperatureInKelvin),
          ),
          ...(Number.isNaN(radiation) ? {} : { radiationTemperatureInKelvin: radiation }),
          ...(Number.isNaN(thickness) ? {} : { thicknessInMeters: thickness }),
        });
      },
    )
    .register(
      {
        name: 'boost',
        description: 'Lorentz boost the targets by a velocity fraction vector',
        parameters: vectorSpecs('Fraction'),
      },
      (parameters) => new Boost(vectorFrom(parameters, 'Fraction')),
    )
    .register(
      {
        name: 'rotateSpin',
        description: 'Rotate the spin about an axis given by polar and azimuth angles',
        parameters: [
          optional('polarAngleDegrees', 0),
          optional('azimuthDegrees', 0),
          required('angleRadians'),
        ],
      },
      (parameters) =>
        new RotateSpin(
          {
            polarAngleDegrees: optionalNumber(parameters, 'polarAngleDegrees', 0),
            azimuthDegrees: optionalNumber(parameters, 'azimuthDegrees', 0),
          },
          requireNumber(parameters, 'angleRadians'),
        ),
    )
    .register(
      {
        name: 'thermalize',
        description: 'Put the spin into a Boltzmann-sampled energy eigenstate',
        parameters: [],
      },
      () => new Thermalize(),
    )
    .register(
      { name: 'randomize', description: 'Put the spin into a Haar-random state', parameters: [] },
      () => new Randomize(),
    )
    .register(
      {
        name: 'evolve',
        description: 'Evolve the targets in time',
        parameters: [required('durationInSeconds')],
      },
      (parameters) => new Evolve(requireNumber(parameters, 'durationInSeconds')),
    )
    .register(
      {
        name: 'travel',
        description: 'Let the targets fly a distance at their own speed',
        parameters: [required('distanceInKilometers')],
      },
      (parameters) =>
        new Travel(requireNumber(parameters, 'distanceInKilometers') * METERS_PER_KILOMETER),
    )
    .register(
      {
        name: 'irradiate',
        description:
          'Shine a photon beam: the frequency sets the photon energy, power over beam area the flux',
        parameters: [
          required('frequencyInHertz'),
          optional('powerInWatts', DEFAULT_BEAM_POWER_IN_WATTS),
          optional('beamAreaInSquareMeters', DEFAULT_BEAM_AREA_IN_SQUARE_METERS),
          optional('durationInSeconds', DEFAULT_EXPOSURE_IN_SECONDS),
        ],
      },
      (parameters) =>
        new Irradiate({
          frequencyInHertz: requireNumber(parameters, 'frequencyInHertz'),
          powerInWatts: optionalNumber(parameters, 'powerInWatts', DEFAULT_BEAM_POWER_IN_WATTS),
          beamAreaInSquareMeters: optionalNumber(
            parameters,
            'beamAreaInSquareMeters',
            DEFAULT_BEAM_AREA_IN_SQUARE_METERS,
          ),
          durationInSeconds: optionalNumber(
            parameters,
            'durationInSeconds',
            DEFAULT_EXPOSURE_IN_SECONDS,
          ),
        }),
    )
    .register(
      {
        name: 'laserCool',
        description: 'Doppler-cool atoms or ions on their closed NIST transition',
        parameters: [
          optional('detuningInLinewidths', OPTIMAL_DETUNING_IN_LINEWIDTHS),
          optional('saturationParameter', DEFAULT_SATURATION),
          optional('durationInSeconds', DEFAULT_EXPOSURE_IN_SECONDS),
        ],
      },
      (parameters) =>
        new LaserCool({
          detuningInLinewidths: optionalNumber(
            parameters,
            'detuningInLinewidths',
            OPTIMAL_DETUNING_IN_LINEWIDTHS,
          ),
          saturationParameter: optionalNumber(
            parameters,
            'saturationParameter',
            DEFAULT_SATURATION,
          ),
          durationInSeconds: optionalNumber(
            parameters,
            'durationInSeconds',
            DEFAULT_EXPOSURE_IN_SECONDS,
          ),
        }),
    )
    .register(
      {
        name: 'electrolyze',
        description:
          'Pass a current between electrodes at a voltage: molecules above their decomposition voltage split into their elements by Faraday law',
        parameters: [
          required('voltageInVolts'),
          optional('currentInAmperes', DEFAULT_CURRENT_IN_AMPERES),
          optional('durationInSeconds', DEFAULT_ELECTROLYSIS_IN_SECONDS),
        ],
      },
      (parameters) =>
        new Electrolyze({
          voltageInVolts: requireNumber(parameters, 'voltageInVolts'),
          currentInAmperes: optionalNumber(
            parameters,
            'currentInAmperes',
            DEFAULT_CURRENT_IN_AMPERES,
          ),
          durationInSeconds: optionalNumber(
            parameters,
            'durationInSeconds',
            DEFAULT_ELECTROLYSIS_IN_SECONDS,
          ),
        }),
    );
}
