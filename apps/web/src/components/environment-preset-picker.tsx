/* EnvironmentPresetPicker: a dropdown of ready-made real-world media grouped by where they are found; choosing one fills the medium step's components, temperature, pressure and radiation temperature from the preset's source. */
import type { EnvironmentPreset, InfluenceStep } from '@standard-model/contracts';
import { FieldLabel, parameterIcon } from '../icons';
import { localize, say } from '../language';
import { applyEnvironmentPreset, environmentPresetOf } from '../plan-edits';

interface Props {
  readonly step: InfluenceStep;
  readonly presets: readonly EnvironmentPreset[];
  readonly onChange: (step: InfluenceStep) => void;
}

export function EnvironmentPresetPicker({ step, presets, onChange }: Props) {
  const selected = environmentPresetOf(step, presets);
  const groups = [...new Set(presets.map((preset) => localize(preset.group)))];
  return (
    <label
      className="wide-field environment-preset"
      data-tooltip={
        selected === undefined
          ? say(
              'Готовая среда: состав, температура, давление и излучение из указанного источника. Любое число потом можно поправить',
              'A ready medium: composition, temperature, pressure and radiation from the named source. Any number can be edited afterwards',
            )
          : `${say('Источник', 'Source')}: ${selected.source}`
      }
    >
      <FieldLabel icon={parameterIcon('components')}>
        {say('Готовая среда', 'Preset environment')}
      </FieldLabel>
      <select
        value={selected?.name ?? ''}
        onChange={(event) => {
          const preset = presets.find((candidate) => candidate.name === event.target.value);
          if (preset !== undefined) {
            onChange(applyEnvironmentPreset(step, preset));
          }
        }}
      >
        <option value="">{say('своя среда', 'custom medium')}</option>
        {groups.map((group) => (
          <optgroup key={group} label={group}>
            {presets
              .filter((preset) => localize(preset.group) === group)
              .map((preset) => (
                <option key={preset.name} value={preset.name}>
                  {localize(preset.title)}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
      {selected !== undefined && <span className="hint">{localize(selected.note)}</span>}
    </label>
  );
}
