import { useId, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cx } from '../../lib/cx';

export type ShelfTone = 'today' | 'soon' | 'fresh' | 'out' | 'neutral';

const tile: Record<ShelfTone, string> = {
  today: 'bg-terra-light text-terra-dark',
  soon: 'bg-apricot text-apricot-dark',
  fresh: 'bg-sage text-olive-dark',
  out: 'bg-shelf text-slate',
  neutral: 'bg-periwinkle text-navy',
};

export type ShelfProps = {
  id?: string;
  tone: ShelfTone;
  icon: ReactNode;
  title: string;
  helper: string;
  count: number;
  /** Jar <li>s. */
  children: ReactNode[];
  /** Show only this many jars until "Show all" (PAN-6: Good for now shows 4 + "+N more"). */
  limit?: number;
};

/** Shelf header + jar row + plank (SRS 4.6, 7). Mobile scrolls sideways with snap; web wraps. */
export function Shelf({ id, tone, icon, title, helper, count, children, limit }: ShelfProps) {
  const { t } = useTranslation();
  const headingId = useId();
  const [expanded, setExpanded] = useState(false);
  const hidden = limit !== undefined && !expanded ? Math.max(0, children.length - limit) : 0;
  const visible = hidden > 0 ? children.slice(0, limit) : children;

  return (
    <section
      id={id}
      tabIndex={id ? -1 : undefined}
      aria-labelledby={headingId}
      className="flex flex-col outline-none"
    >
      <header className="flex flex-wrap items-center gap-x-2.5 gap-y-1 pb-2.5">
        <span
          aria-hidden="true"
          className={cx(
            'flex size-8 items-center justify-center rounded-[0.625rem] lg:size-10',
            tile[tone],
          )}
        >
          {icon}
        </span>
        <h2 id={headingId} className="text-[1.375rem] leading-tight lg:text-[1.875rem]">
          {title}
          <span className="sr-only">, {t('pantry.count', { count })}</span>
        </h2>
        <span
          aria-hidden="true"
          className={cx('rounded-chip px-2 py-0.5 text-[0.8125rem] font-semibold', tile[tone])}
        >
          {count}
        </span>
        <p className="text-sm text-secondary lg:ml-1">{helper}</p>
      </header>

      {count === 0 ? (
        <p className="pb-3 pl-2 text-sm text-secondary">{t('pantry.shelfEmpty')}</p>
      ) : (
        // `relative` makes this scroller the containing block, so absolutely positioned children
        // (e.g. sr-only text) are clipped by it instead of widening the page on phones.
        // Proximity snap (not mandatory): swipes still settle on a jar, but focusing a jar's button
        // or scrolling it into view is never undone by the snap. scroll-px keeps snapped jars off
        // the screen edge.
        <ul className="relative -mx-[var(--page-pad)] flex snap-x snap-proximity scroll-px-[var(--page-pad)] items-end gap-3 overflow-x-auto px-[var(--page-pad)] pb-1 pl-[calc(var(--page-pad)+0.5rem)] lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-5">
          {visible}
          {hidden > 0 || (limit !== undefined && expanded && children.length > limit) ? (
            <li className="flex shrink-0 snap-start items-end">
              <button
                type="button"
                aria-expanded={expanded}
                aria-label={
                  expanded
                    ? t('pantry.showFewer')
                    : t('pantry.showAllLabel', { total: children.length, shelf: title })
                }
                onClick={() => setExpanded((e) => !e)}
                className="flex min-h-20 w-[8.5rem] flex-col items-center justify-center gap-0.5 rounded-[1.125rem] border-2 border-dashed border-line px-3 text-navy lg:w-40"
              >
                {expanded ? (
                  <span className="font-semibold">{t('pantry.showFewer')}</span>
                ) : (
                  <>
                    <span className="text-lg font-semibold">{t('pantry.more', { hidden })}</span>
                    <span className="text-[0.8125rem] text-secondary">{t('pantry.showAll')}</span>
                  </>
                )}
              </button>
            </li>
          ) : null}
        </ul>
      )}
      <Plank out={tone === 'out'} />
    </section>
  );
}

/** Navy plank with two brackets; lighter for Ran out (Figma 03/13). */
function Plank({ out }: { out: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={cx('relative h-6 lg:h-[1.875rem]', out ? 'text-out-lid' : 'text-navy')}
    >
      <div className="h-2 rounded-[0.25rem] bg-current lg:h-2.5" />
      <svg
        viewBox="0 0 16 14"
        className="absolute left-6 top-2 h-3.5 w-4 lg:left-[3.75rem] lg:top-2.5 lg:h-5 lg:w-[1.375rem]"
      >
        <path d="M1 1h14L1 13V1Z" fill="currentColor" />
      </svg>
      <svg
        viewBox="0 0 16 14"
        className="absolute right-6 top-2 h-3.5 w-4 lg:right-[3.5rem] lg:top-2.5 lg:h-5 lg:w-[1.375rem]"
      >
        <path d="M1 1h14L1 13V1Z" fill="currentColor" />
      </svg>
    </div>
  );
}
