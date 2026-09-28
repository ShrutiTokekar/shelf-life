import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';

export type ChipProps = {
  selected: boolean;
  onToggle: () => void;
  icon?: ReactNode;
  count?: number;
  children: ReactNode;
  className?: string;
};

/** Toggle chip (SRS 7): aria-pressed, 44 px tall, optional icon and count. */
export function Chip({ selected, onToggle, icon, count, children, className }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      className={cx(
        'inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-chip px-3.5 text-sm font-semibold',
        selected ? 'border-2 border-navy bg-navy text-white' : 'bg-white text-ink bordered',
        className,
      )}
    >
      {icon ? <span className="inline-flex">{icon}</span> : null}
      {children}
      {/* A space so screen readers say "Produce 9", not "Produce9"; flex hides it visually. */}
      {count !== undefined ? ' ' : null}
      {count !== undefined ? (
        // Figma shows periwinkle on navy here, but that's ~3.6:1; white passes AA (A11Y-1).
        <span
          className={cx('text-[0.8125rem] font-normal', selected ? 'text-white' : 'text-secondary')}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}
