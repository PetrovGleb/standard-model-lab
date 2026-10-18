/* CategoryChips: toggleable template categories with their icons, used to filter templates and to tag a plan. */
import type { TemplateCategory } from '@standard-model/contracts';
import { TEMPLATE_CATEGORY_LABELS } from '../glossary';
import { HINTS } from '../hints';
import { TEMPLATE_CATEGORY_ICONS } from '../icons';

const CHIP_ICON_SIZE = 20;

interface Props {
  readonly categories: readonly TemplateCategory[];
  readonly selected: readonly TemplateCategory[];
  readonly counts?: Readonly<Partial<Record<TemplateCategory, number>>>;
  readonly onToggle: (category: TemplateCategory) => void;
}

export function CategoryChips({ categories, selected, counts, onToggle }: Props) {
  return (
    <div className="category-chips">
      {categories.map((category) => {
        const Icon = TEMPLATE_CATEGORY_ICONS[category];
        const active = selected.includes(category);
        return (
          <button
            key={category}
            type="button"
            className={active ? 'category-chip active' : 'category-chip'}
            data-category={category}
            data-tooltip={HINTS.categoryChip}
            aria-pressed={active}
            onClick={() => onToggle(category)}
          >
            <Icon size={CHIP_ICON_SIZE} aria-hidden="true" />
            {TEMPLATE_CATEGORY_LABELS[category]}
            {counts !== undefined && <span className="chip-count">{counts[category] ?? 0}</span>}
          </button>
        );
      })}
    </div>
  );
}
