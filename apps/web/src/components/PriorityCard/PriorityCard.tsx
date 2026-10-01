import type { ReactNode } from 'react';
import { useId } from 'react';
import { cx } from '../../lib/cx';

export type PriorityTone = 'today' | 'out' | 'plan' | 'review';

const tile: Record<PriorityTone, string> = {
  today: 'bg-terra-light text-terra-dark',
  out: 'bg-peach text-peach-dark',
  plan: 'bg-periwinkle text-navy',
  review: 'bg-apricot text-apricot-dark',
};
const tag: Record<PriorityTone, string> = {
  today: 'bg-terra-light text-terra-dark',
  out: 'bg-peach text-peach-dark',
  plan: 'bg-periwinkle text-ink',
  review: 'bg-apricot text-apricot-dark',
};

export type PriorityCardProps = {
  rank: 1 | 2 | 3;
  tone: PriorityTone;
  /** Urgency tag: icon + words (SRS 4.5). */
  urgency: { icon: ReactNode; text: string };
  title: string;
  reason: string;
  /** Primary and secondary actions (buttons or links). */
  actions: ReactNode;
  /** Rank 1 is the hero (TOD-3); 2 and 3 are compact (TOD-4). */
  size: 'hero' | 'compact';
};

/**
 * One of today's priorities (SRS 7 PriorityCard, TOD-3, TOD-4): rank tile, urgency tag, title (h2),
 * one-sentence reason and actions. The hero gets a terra border and the biggest type.
 */
export function PriorityCard({
  rank,
  tone,
  urgency,
  title,
  reason,
  actions,
  size,
}: PriorityCardProps) {
  const titleId = useId();
  const hero = size === 'hero';
  return (
    <article
      aria-labelledby={titleId}
      data-testid="priority"
      className={cx(
        'flex gap-4 rounded-hero border-2 bg-white',
        hero ? 'border-terra p-5 lg:gap-8 lg:p-7' : 'border-line p-5 lg:p-6',
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          'flex shrink-0 items-center justify-center rounded-[1.125rem] font-display leading-none',
          tile[tone],
          hero
            ? 'size-16 text-[2.5rem] lg:size-[7.25rem] lg:text-[4.5rem]'
            : 'size-14 text-[2rem] lg:size-[4.5rem] lg:text-[2.75rem]',
        )}
      >
        {rank}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <span
          className={cx(
            'inline-flex items-center gap-1.5 self-start rounded-[0.625rem] px-2.5 py-1 text-[0.8125rem] font-semibold',
            tag[tone],
          )}
        >
          {urgency.icon}
          {urgency.text}
        </span>
        <h2
          id={titleId}
          className={cx(
            'leading-tight [overflow-wrap:anywhere]',
            hero
              ? 'text-[1.625rem] lg:text-[2.25rem]'
              : 'font-ui text-lg font-semibold lg:font-display lg:text-[1.625rem] lg:font-normal',
          )}
        >
          <span className="sr-only">{`${rank}.`}</span> {title}
        </h2>
        <p
          className={cx(
            'text-ink',
            hero ? 'text-base lg:text-lg' : 'text-sm text-secondary lg:text-base',
          )}
        >
          {reason}
        </p>
        <div
          className={cx(
            'mt-2 flex flex-wrap items-center gap-3',
            hero && 'max-lg:flex-col max-lg:items-stretch',
          )}
        >
          {actions}
        </div>
      </div>
    </article>
  );
}
