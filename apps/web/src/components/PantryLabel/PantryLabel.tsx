import type { ListColor } from '@shelf-life/shared';
import { cx } from '../../lib/cx';

export const listDotClass: Record<ListColor, string> = {
  navy: 'bg-list-navy',
  olive: 'bg-list-olive',
  amber: 'bg-list-amber',
  terra: 'bg-list-terra',
  gray: 'bg-list-gray',
};

/** Color dot + list name. The dot is decorative; the name carries the meaning (PAN-7). */
export function PantryLabel({
  listName,
  color,
  className,
}: {
  listName: string;
  color: ListColor;
  className?: string;
}) {
  return (
    <span
      className={cx(
        'inline-flex min-w-0 items-center gap-1.5 text-xs font-semibold text-secondary',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cx('size-2 shrink-0 rounded-chip', listDotClass[color])}
      />
      <span className="truncate">{listName}</span>
    </span>
  );
}
