/* ParameterForm: the plan's parameters with their units plus shots and seed, in the builder's field style, for running a template without opening the builder. */
import type { ParameterDefinitions } from '@standard-model/contracts';
import { PARAMETER_GLOSSARY } from '../glossary';
import { HINTS } from '../hints';
import { FieldLabel } from '../icons';
import { say } from '../language';
import { unitOfParameter } from '../presets';
import { sml } from './sml-icon';

export interface RunSettings {
  readonly parameters: Record<string, number>;
  readonly shots: number;
  readonly seed: number;
}

interface Props {
  readonly defaults: ParameterDefinitions;
  readonly settings: RunSettings;
  readonly onChange: (settings: RunSettings) => void;
}

export function ParameterForm({ defaults, settings, onChange }: Props) {
  return (
    <div className="form-grid parameter-form">
      {Object.keys(defaults).map((name) => (
        <label key={name} data-tooltip={PARAMETER_GLOSSARY[name] ?? HINTS.parameter}>
          <FieldLabel icon={sml('parameter')}>
            <span className="mono-label">{name}</span>
          </FieldLabel>
          <span className="value-field">
            <input
              type="number"
              step="any"
              value={settings.parameters[name] ?? defaults[name] ?? 0}
              onChange={(event) =>
                onChange({
                  ...settings,
                  parameters: { ...settings.parameters, [name]: Number(event.target.value) },
                })
              }
            />
            <span className="value-unit">{unitOfParameter(name)}</span>
          </span>
        </label>
      ))}
      <label data-tooltip={HINTS.shots}>
        <FieldLabel icon={sml('shots')}>{say('Выстрелов', 'Shots')}</FieldLabel>
        <input
          type="number"
          min={1}
          value={settings.shots}
          onChange={(event) => onChange({ ...settings, shots: Number(event.target.value) })}
        />
      </label>
      <label data-tooltip={HINTS.seed}>
        <FieldLabel icon={sml('seed')}>Seed</FieldLabel>
        <input
          type="number"
          value={settings.seed}
          onChange={(event) => onChange({ ...settings, seed: Number(event.target.value) })}
        />
      </label>
    </div>
  );
}
