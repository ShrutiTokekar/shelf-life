import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';

export type EmptyStateProps = {
  title: string;
  body: string;
  /** One next action (SRS 6: empty state = friendly message plus one next action). */
  action?: ReactNode;
  icon?: ReactNode;
  headingLevel?: 2 | 3;
  className?: string;
};

export function EmptyState({
  title,
  body,
  action,
  icon,
  headingLevel = 2,
  className,
}: EmptyStateProps) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <section
      className={cx(
        'flex flex-col items-center gap-3 rounded-card bg-white px-6 py-10 text-center bordered',
        className,
      )}
    >
      {icon ? <span className="text-navy">{icon}</span> : null}
      <Heading className="text-2xl">{title}</Heading>
      <p className="max-w-md text-[1.0625rem] text-secondary">{body}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </section>
  );
}
