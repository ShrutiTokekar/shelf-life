import { cx } from '../../lib/cx';

export type BadgeProps = {
  count: number;
  tone?: 'navy' | 'terra';
  className?: string;
};

/**
 * Count pill. Hidden when 0. Always aria-hidden: the parent control carries the count in its
 * accessible name, e.g. "Reminders, 2 unread" (SRS 7).
 */
export function Badge({ count, tone = 'navy', className }: BadgeProps) {
  if (count <= 0) return null;
  return (
    <span
      aria-hidden="true"
      data-testid="badge"
      className={cx(
        'inline-flex min-w-[1.25rem] items-center justify-center rounded-chip px-2 py-0.5 text-[0.8125rem] font-semibold leading-tight text-white',
        tone === 'navy' ? 'bg-navy' : 'bg-terra-dark',
        className,
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}
