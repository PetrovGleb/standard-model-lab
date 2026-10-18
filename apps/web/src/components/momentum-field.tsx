/* MomentumField: the three momentum components of a created object in GeV, each a number or a {{parameter}} with physical presets. */
import type { ParameterizableVector3, Preset } from '@standard-model/contracts';
import { FIELD_ICONS, FieldLabel } from '../icons';
import { NumberOrParameterInput } from './number-or-parameter-input';
import { say } from '../language';

const AXES = ['x', 'y', 'z'] as const;

interface Props {
  readonly value: ParameterizableVector3 | undefined;
  readonly parameters: readonly string[];
  readonly presets: readonly Preset[];
  readonly onChange: (momentum: ParameterizableVector3) => void;
}

export function MomentumField({ value, parameters, presets, onChange }: Props) {
  return (
    <fieldset
      className="vector-field"
      data-tooltip={say(
        'Импульс в ГэВ по осям; пресеты подставляют известные из физики значения',
        'Momentum in GeV along the axes; presets insert known physical values',
      )}
    >
      <legend>
        <FieldLabel icon={FIELD_ICONS.momentum}>{say('Импульс, ГэВ', 'Momentum, GeV')}</FieldLabel>
      </legend>
      <div className="vector-axes">
        {AXES.map((axis) => (
          <label key={axis} className="axis">
            <span className="axis-name">{axis}</span>
            <NumberOrParameterInput
              value={value?.[axis] ?? 0}
              parameters={parameters}
              presets={presets}
              onChange={(component) =>
                onChange({
                  x: value?.x ?? 0,
                  y: value?.y ?? 0,
                  z: value?.z ?? 0,
                  [axis]: component,
                })
              }
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}
