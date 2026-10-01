import { useId, type ReactNode } from 'react';
import { cx } from '../../lib/cx';

export type ListGroupTone = 'today' | 'week' | 'cart';

const band: Record<ListGroupTone, string> = {
  today: 'bg-terra-light text-terra-dark',
  week: 'bg-apricot text-apricot-dark',
  cart: 'bg-sage text-olive-dark',
};

/** A tinted group of list rows (SRS 7 ListGroup, LST-3): heading band with icon, title, helper. */
export function ListGroup({
  tone,
  icon,
  title,
  helper,
  children,
  className,
}: {
  tone: ListGroupTone;
  icon: ReactNode;
  title: string;
  helper?: string;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className={cx('overflow-hidden rounded-card border-2 border-line bg-white', className)}
    >
      <div
        className={cx('flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-5 py-3.5', band[tone])}
      >
        <h2
          id={id}
          className="flex items-center gap-2 text-[1.375rem] leading-tight lg:text-[1.625rem]"
        >
          <span className="self-center">{icon}</span>
          {title}
        </h2>
        {helper ? <p className="text-sm font-medium">{helper}</p> : null}
      </div>
      <ul className="divide-y-2 divide-line">{children}</ul>
    </section>
  );
}
