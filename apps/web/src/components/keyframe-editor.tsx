/* Editor of a keyframe step: its name and the rows of watched quantities, each a target (the system, a medium by its name, a particle by its label) and one of the quantities that target has. */
import type { KeyframeStep, KeyframeWatch } from '@standard-model/contracts';
import { FIELD_ICONS, FieldLabel } from '../icons';
import { KEYFRAME_SYSTEM_TARGET_LABELS, keyframeQuantityLabel } from '../glossary';
import { say } from '../language';
import type { KeyframeTarget, KeyframeTargetKind } from '../plan-edits';
import { Select } from './select';
import { SmlIcon } from './sml-icon';

interface Props {
  readonly step: KeyframeStep;
  readonly targets: readonly KeyframeTarget[];
  readonly quantitiesOf: (kind: KeyframeTargetKind) => readonly string[];
  readonly symbolOf: (name: string) => string;
  readonly onChange: (step: KeyframeStep) => void;
}

export function KeyframeEditor({ step, targets, quantitiesOf, symbolOf, onChange }: Props) {
  const kindOf = (target: string): KeyframeTargetKind =>
    targets.find((candidate) => candidate.target === target)?.kind ?? 'medium';
  const setWatch = (watch: readonly KeyframeWatch[]) => onChange({ ...step, watch });
  const targetLabels = Object.fromEntries(
    targets.map(({ target, kind }) => [
      target,
      kind === 'system'
        ? KEYFRAME_SYSTEM_TARGET_LABELS.system
        : kind === 'medium'
          ? say(`среда ${target}`, `medium ${target}`)
          : say(`частица ${target}`, `particle ${target}`),
    ]),
  );
  return (
    <>
      <label
        data-tooltip={say(
          'Имя кадра: под ним величины попадут в отчет как имя.цель.величина',
          'The keyframe name: the quantities go into the report as name.target.quantity',
        )}
      >
        <FieldLabel icon={FIELD_ICONS.record}>{say('Имя кадра', 'Keyframe name')}</FieldLabel>
        <input
          value={step.name}
          onChange={(event) => onChange({ ...step, name: event.target.value })}
        />
      </label>
      <div className="wide-field">
        <div className="list-table keyframe-watch">
          {step.watch.map((watch, index) => {
            const quantities = quantitiesOf(kindOf(watch.target));
            return (
              <div key={index} className="list-table-row">
                <span className="row-index">{index + 1}</span>
                <Select
                  value={watch.target}
                  options={targets.map((target) => target.target)}
                  labels={targetLabels}
                  onChange={(target) => {
                    const options = quantitiesOf(kindOf(target));
                    setWatch(
                      step.watch.map((existing, position) =>
                        position === index
                          ? {
                              target,
                              quantity: options.includes(existing.quantity)
                                ? existing.quantity
                                : (options[0] ?? existing.quantity),
                            }
                          : existing,
                      ),
                    );
                  }}
                />
                <Select
                  value={watch.quantity}
                  options={quantities}
                  labels={Object.fromEntries(
                    quantities.map((quantity) => [
                      quantity,
                      keyframeQuantityLabel(quantity, symbolOf),
                    ]),
                  )}
                  onChange={(quantity) =>
                    setWatch(
                      step.watch.map((existing, position) =>
                        position === index ? { ...existing, quantity } : existing,
                      ),
                    )
                  }
                />
                <button
                  type="button"
                  className="icon-button round danger"
                  aria-label={say('Убрать величину', 'Remove the quantity')}
                  data-tooltip={say('Убрать величину', 'Remove the quantity')}
                  disabled={step.watch.length <= 1}
                  onClick={() =>
                    setWatch(step.watch.filter((unused, position) => position !== index))
                  }
                >
                  <SmlIcon name="delete" size={16} aria-hidden="true" />
                </button>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          className="add-row"
          onClick={() => {
            const last = step.watch[step.watch.length - 1];
            const target = last?.target ?? targets[0]?.target ?? 'system';
            const taken = new Set(
              step.watch.filter((watch) => watch.target === target).map((watch) => watch.quantity),
            );
            const quantity =
              quantitiesOf(kindOf(target)).find((candidate) => !taken.has(candidate)) ??
              quantitiesOf(kindOf(target))[0] ??
              'particleCount';
            setWatch([...step.watch, { target, quantity }]);
          }}
        >
          <SmlIcon name="add-step" size={16} aria-hidden="true" />
          {say('Следить еще за величиной', 'Watch one more quantity')}
        </button>
      </div>
    </>
  );
}
