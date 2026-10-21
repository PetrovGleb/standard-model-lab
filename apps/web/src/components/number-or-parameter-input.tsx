/* NumberOrParameterInput: one value field with a source switch instead of three controls: a typed number, a plan {{parameter}} shown with its current value, or a physical preset named under the field; the switch is a chip at the right edge.
   A scale binds to the number itself or, for a {{parameter}}, to the value of that plan parameter. */
import type { NumberOrParameter, ParameterReference, Preset } from '@standard-model/contracts';
import { createContext, useContext } from 'react';
import { formatNumber } from '../format';
import { localize, say } from '../language';
import { SmlIcon } from './sml-icon';

const NUMBER_MODE = '__number__';
const PRESET_PREFIX = 'preset:';
const PARAMETER_REFERENCE = /^\{\{(.+)\}\}$/;

export const PlanParametersContext = createContext<Readonly<Record<string, number>>>({});
export const PlanParameterSetterContext = createContext<
  ((name: string, value: number) => void) | null
>(null);

export interface ScaleBinding {
  readonly value: number;
  readonly set: (value: number) => void;
}

export function scaleBinding(
  value: unknown,
  setNumber: (value: number) => void,
  parameterValues: Readonly<Record<string, number>>,
  setParameter: ((name: string, value: number) => void) | null,
): ScaleBinding | null {
  if (typeof value === 'number') {
    return { value, set: setNumber };
  }
  const reference = typeof value === 'string' ? PARAMETER_REFERENCE.exec(value)?.[1] : undefined;
  const resolved = reference === undefined ? undefined : parameterValues[reference];
  return reference === undefined || resolved === undefined || setParameter === null
    ? null
    : { value: resolved, set: (next) => setParameter(reference, next) };
}

interface Props {
  readonly value: NumberOrParameter;
  readonly parameters: readonly string[];
  readonly presets?: readonly Preset[];
  readonly unit?: string;
  readonly onChange: (value: NumberOrParameter) => void;
}

export function selectedPresetIndex(presets: readonly Preset[], value: NumberOrParameter): number {
  return typeof value === 'number' && value !== 0
    ? presets.findIndex((preset) => preset.value === value)
    : -1;
}

export function NumberOrParameterInput({ value, parameters, presets = [], unit, onChange }: Props) {
  const parameterValues = useContext(PlanParametersContext);
  const reference =
    typeof value === 'string' ? (PARAMETER_REFERENCE.exec(value)?.[1] ?? value) : null;
  const selected = selectedPresetIndex(presets, value);
  const preset = selected >= 0 ? presets[selected] : undefined;
  const source = reference !== null ? 'parameter' : preset !== undefined ? 'preset' : 'number';
  const resolved = reference === null ? undefined : parameterValues[reference];
  const sourceLabel =
    source === 'parameter'
      ? say('параметр', 'parameter')
      : source === 'preset'
        ? say('пресет', 'preset')
        : say('число', 'number');
  const choose = (choice: string): void => {
    if (choice === NUMBER_MODE) {
      onChange(typeof value === 'number' ? value : (resolved ?? 0));
      return;
    }
    if (choice.startsWith(PRESET_PREFIX)) {
      const chosen = presets[Number(choice.slice(PRESET_PREFIX.length))];
      if (chosen !== undefined) {
        onChange(chosen.value);
      }
      return;
    }
    onChange(choice as ParameterReference);
  };
  const canSwitch = parameters.length > 0 || presets.length > 0;
  return (
    <span className="value-field-wrap">
      <span className={`value-field source-${source}`}>
        {reference !== null ? (
          <span className="value-parameter">
            <span className="value-parameter-name">{reference}</span>
            {resolved !== undefined && (
              <span className="value-resolved">
                = {formatNumber(resolved)}
                {unit === undefined || unit === '' ? '' : ` ${unit}`}
              </span>
            )}
          </span>
        ) : (
          <>
            <input
              type="number"
              step="any"
              value={value}
              onChange={(event) => onChange(Number(event.target.value))}
            />
            {unit !== undefined && unit !== '' && <span className="value-unit">{unit}</span>}
          </>
        )}
        {canSwitch && (
          <span className="source-chip">
            {sourceLabel}
            <SmlIcon name="expand" size={12} aria-hidden="true" />
            <select
              aria-label={say('Источник значения', 'Value source')}
              data-tooltip={say(
                'Число, параметр плана {{имя}} или известное из физики значение',
                'A number, a plan parameter {{name}} or a known physical value',
              )}
              value={
                source === 'parameter'
                  ? String(value)
                  : source === 'preset'
                    ? `${PRESET_PREFIX}${String(selected)}`
                    : NUMBER_MODE
              }
              onChange={(event) => choose(event.target.value)}
            >
              <option value={NUMBER_MODE}>{say('число', 'number')}</option>
              {parameters.length > 0 && (
                <optgroup label={say('параметр плана', 'plan parameter')}>
                  {parameters.map((name) => (
                    <option key={name} value={`{{${name}}}`}>
                      {name}
                    </option>
                  ))}
                </optgroup>
              )}
              {presets.length > 0 && (
                <optgroup label={say('пресет', 'preset')}>
                  {presets.map((candidate, index) => (
                    <option
                      key={index}
                      value={`${PRESET_PREFIX}${String(index)}`}
                      title={localize(candidate.note)}
                    >
                      {localize(candidate.label)}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </span>
        )}
      </span>
      {preset !== undefined && (
        <span className="value-note" data-tooltip={localize(preset.note)}>
          {say('пресет', 'preset')} «{localize(preset.label)}»
        </span>
      )}
    </span>
  );
}
