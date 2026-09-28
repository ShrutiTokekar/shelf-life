import type { ListColor } from '@shelf-life/shared';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { cx } from '../../lib/cx';
import { Chip } from '../Chip/Chip';
import { listDotClass } from '../PantryLabel/PantryLabel';

export type FilterList = { id: string; name: string; color: ListColor };

export type ListFilterChipsProps = {
  lists: readonly FilterList[];
  /** Selected list id, or null for All lists. */
  value: string | null;
  onChange: (listId: string | null) => void;
  counts: Record<string, number> & { all: number };
  className?: string;
};

/** "From list" filter (PAN-3): single-select, All lists first; scrolls sideways on mobile. */
export function ListFilterChips({
  lists,
  value,
  onChange,
  counts,
  className,
}: ListFilterChipsProps) {
  const { t } = useTranslation();
  const labelId = useId();
  return (
    <div className={cx('flex items-center gap-2', className)}>
      <span id={labelId} className="hidden shrink-0 text-sm font-semibold text-ink lg:inline">
        {t('pantry.fromList')}
      </span>
      <div
        role="group"
        aria-labelledby={labelId}
        className="-mx-[var(--page-pad)] flex gap-2 overflow-x-auto px-[var(--page-pad)] pb-1 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0"
      >
        <Chip selected={value === null} onToggle={() => onChange(null)} count={counts.all}>
          {t('pantry.allLists')}
        </Chip>
        {lists.map((list) => (
          <Chip
            key={list.id}
            selected={value === list.id}
            onToggle={() => onChange(value === list.id ? null : list.id)}
            count={counts[list.id] ?? 0}
            icon={
              <span
                aria-hidden="true"
                className={cx('size-2.5 rounded-chip', listDotClass[list.color])}
              />
            }
          >
            {list.name}
          </Chip>
        ))}
      </div>
    </div>
  );
}
