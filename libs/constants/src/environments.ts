/* Typed access to data/environments.json: ready-made media of the real world (standard atmosphere, ocean, planets, stars, interstellar phases, laboratory, early Universe), each with its source, and the landmarks drawn on the density, temperature and pressure scales. */
import type { EnvironmentPreset, EnvironmentScales } from '@standard-model/contracts';
import environmentsJson from '../data/environments.json' with { type: 'json' };

interface EnvironmentsFile {
  readonly source: string;
  readonly environments: readonly EnvironmentPreset[];
  readonly scales: EnvironmentScales;
}

const file = environmentsJson as unknown as EnvironmentsFile;

export const ENVIRONMENT_PRESETS: readonly EnvironmentPreset[] = file.environments;
export const ENVIRONMENT_SCALES: EnvironmentScales = file.scales;
export const ENVIRONMENTS_SOURCE = file.source;
