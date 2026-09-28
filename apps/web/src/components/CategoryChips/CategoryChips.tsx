import { CATEGORIES, type Category } from '@shelf-life/shared';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { cx } from '../../lib/cx';
import { Chip } from '../Chip/Chip';
import { BoxIcon, GrainIcon, GridIcon, LeafIcon, MilkIcon, SnowIcon, SpiceIcon } from '../icons';

export const categoryIcon: Record<Category, JSX.Element> = {
  produce: <LeafIcon size={18} />,
  dairy_eggs: <MilkIcon size={18} />,
  grains_dals: <GrainIcon size={18} />,
  spices_oils: <SpiceIcon size={18} />,
  frozen: <SnowIcon size={18} />,
  other: <BoxIcon size={18} />,
};

export type CategoryChipsProps = {
  value: Category | null;
  onChange: (category: Category | null) => void;
  counts: Record<Category, number> & { all: number };
  className?: string;
};

/** Category filter (PAN-4): chips with icon and count, "All" first. */
export function CategoryChips({ value, onChange, counts, className }: CategoryChipsProps) {
  const { t } = useTranslation();
  const labelId = useId();
  return (
    <div className={cx('flex items-center gap-2', className)}>
      <span id={labelId} className="hidden shrink-0 text-sm font-semibold text-ink lg:inline">
        {t('pantry.category')}
      </span>
      <div
        role="group"
        aria-labelledby={labelId}
        className="-mx-[var(--page-pad)] flex gap-2 overflow-x-auto px-[var(--page-pad)] pb-1 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0"
      >
        <Chip
          selected={value === null}
          onToggle={() => onChange(null)}
          count={counts.all}
          icon={<GridIcon size={18} />}
        >
          {t('pantry.all')}
        </Chip>
        {CATEGORIES.map((c) => (
          <Chip
            key={c}
            selected={value === c}
            onToggle={() => onChange(value === c ? null : c)}
            count={counts[c]}
            icon={categoryIcon[c]}
          >
            {t(`categories.${c}`)}
          </Chip>
        ))}
      </div>
    </div>
  );
}
