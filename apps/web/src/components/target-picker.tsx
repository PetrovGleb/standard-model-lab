/* TargetPicker: particle labels as checkable chips; a group made by a create step with a count is one chip that picks the whole group and opens to its first members, any other member is picked by
   its number; nothing checked means every live particle; inside a titled subsection the field label is left out, and an optional tooltip says what picking means for this step. */
import { useState } from 'react';
import { FIELD_ICONS, FieldLabel } from '../icons';
import { say } from '../language';
import { GROUP_MEMBERS_SHOWN } from '../plan-edits';

interface Props {
  readonly labels: readonly string[];
  readonly targets: readonly string[] | undefined;
  readonly onChange: (targets: readonly string[] | undefined) => void;
  readonly tooltip?: string;
  readonly titled?: boolean;
  readonly environment?: boolean;
  readonly groups?: ReadonlyMap<string, readonly string[]>;
}

function Chip({
  label,
  text,
  checked,
  onToggle,
}: {
  readonly label: string;
  readonly text?: string;
  readonly checked: boolean;
  readonly onToggle: (label: string) => void;
}) {
  return (
    <label className={checked ? 'checkbox chip-check checked' : 'checkbox chip-check'}>
      <input type="checkbox" checked={checked} onChange={() => onToggle(label)} />
      {text ?? label}
    </label>
  );
}

export function TargetPicker({
  labels,
  targets,
  onChange,
  tooltip,
  titled = true,
  environment = false,
  groups = new Map(),
}: Props) {
  const chosen = targets ?? [];
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set());
  const [numbers, setNumbers] = useState<Readonly<Record<string, string>>>({});
  const grouped = new Set([...groups.values()].flat());
  const singles = labels.filter((label) => !grouped.has(label));
  const toggle = (label: string): void => {
    const next = chosen.includes(label)
      ? chosen.filter((candidate) => candidate !== label)
      : [...chosen, label];
    onChange(next.length === 0 ? undefined : next);
  };
  const toggleOpen = (group: string): void =>
    setOpened((current) => {
      const next = new Set(current);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  const addByNumber = (group: string, members: readonly string[]): void => {
    const member = members[Number(numbers[group] ?? '') - 1];
    if (member !== undefined && !chosen.includes(member)) {
      onChange([...chosen, member]);
    }
    setNumbers((current) => ({ ...current, [group]: '' }));
  };
  return (
    <div className="targets" data-tooltip={tooltip}>
      {titled && <FieldLabel icon={FIELD_ICONS.target}>{say('Цели', 'Targets')}</FieldLabel>}
      <div className="checkboxes">
        {singles.map((label) => (
          <Chip key={label} label={label} checked={chosen.includes(label)} onToggle={toggle} />
        ))}
        {[...groups.entries()].map(([group, members]) => (
          <span key={group} className="target-group">
            <Chip
              label={group}
              text={say(
                `${group} · вся группа · ${String(members.length)}`,
                `${group} · whole group · ${String(members.length)}`,
              )}
              checked={chosen.includes(group)}
              onToggle={toggle}
            />
            <button
              type="button"
              className="secondary group-toggle"
              aria-expanded={opened.has(group)}
              onClick={() => toggleOpen(group)}
            >
              {opened.has(group) ? say('свернуть', 'fold') : say('по одной', 'one by one')}
            </button>
          </span>
        ))}
      </div>
      {[...groups.entries()]
        .filter(([group]) => opened.has(group))
        .map(([group, members]) => {
          const shown = members.slice(0, GROUP_MEMBERS_SHOWN);
          const pickedBeyond = chosen.filter(
            (label) => members.includes(label) && !shown.includes(label),
          );
          return (
            <div key={group} className="target-members">
              <span className="target-members-title">
                {members.length > shown.length
                  ? say(
                      `${group}: первые ${String(shown.length)} из ${String(members.length)}, остальные — по номеру`,
                      `${group}: the first ${String(shown.length)} of ${String(members.length)}, the rest by number`,
                    )
                  : say(
                      `${group}: все ${String(members.length)}`,
                      `${group}: all ${String(members.length)}`,
                    )}
              </span>
              <div className="checkboxes">
                {[...shown, ...pickedBeyond].map((label) => (
                  <Chip
                    key={label}
                    label={label}
                    checked={chosen.includes(label)}
                    onToggle={toggle}
                  />
                ))}
                {members.length > shown.length && (
                  <span className="member-number">
                    <input
                      type="number"
                      min={1}
                      max={members.length}
                      value={numbers[group] ?? ''}
                      placeholder={`№ 1–${String(members.length)}`}
                      aria-label={say(
                        `номер частицы в группе ${group}`,
                        `number of the particle in group ${group}`,
                      )}
                      onChange={(event) =>
                        setNumbers((current) => ({ ...current, [group]: event.target.value }))
                      }
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          addByNumber(group, members);
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => addByNumber(group, members)}
                    >
                      {say('добавить', 'add')}
                    </button>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      <span className="hint">
        {chosen.length > 0
          ? say('Шаг действует только на выбранные.', 'The step acts on the picked ones only.')
          : environment
            ? labels.length === 0
              ? say(
                  'Выше этого шага частиц нет, поэтому окружение общее: в нем окажутся все частицы, созданные ниже. Чтобы задать окружение только для некоторых, поставьте шаг после их создания.',
                  'There are no particles above this step, so the environment is shared: every particle created below lands in it. To give the environment to some of them only, put the step after they are created.',
                )
              : say(
                  'Ничего не выбрано — окружение общее для всей системы, включая частицы, созданные позже.',
                  'Nothing picked: the environment is shared by the whole system, including particles created later.',
                )
            : labels.length === 0
              ? say(
                  'Выше этого шага частиц нет: создайте их раньше, чтобы шаг на них подействовал.',
                  'There are no particles above this step: create them earlier for the step to act on them.',
                )
              : say(
                  'Ничего не выбрано — шаг действует на все живые частицы.',
                  'Nothing picked: the step acts on every live particle.',
                )}
      </span>
    </div>
  );
}
