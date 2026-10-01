import { TIMELINE_COLUMNS, timeline, type TimelineColumn } from '@shelf-life/ranking';
import { diffDays, shelfFor, type PantryItem } from '@shelf-life/shared';
import { useRef, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { cx } from '../../lib/cx';
import { ClockIcon, LeafIcon, WarnIcon } from '../icons';

const chipStyle = {
  today: 'bg-terra-light text-terra-dark',
  soon: 'bg-apricot text-apricot-dark',
  fresh: 'bg-sage text-olive-dark',
} as const;
const chipIcon = {
  today: <WarnIcon size={14} />,
  soon: <ClockIcon size={14} />,
  fresh: <LeafIcon size={14} />,
} as const;

/** Chips shown per column before "+N more" (Figma web 11). */
const PER_COLUMN = 2;

/**
 * TOD-6 "Your shelf life" (SRS 7 ShelfTimeline): items as status chips above Today, Tomorrow,
 * 2 days, 3 days, This week and Later on a navy arrow. Each chip opens the item; arrow keys move
 * between chips; the strip scrolls sideways on phones.
 */
export function ShelfTimeline({
  items,
  today,
  onOpen,
}: {
  items: readonly PantryItem[];
  today: string;
  onOpen: (item: PantryItem) => void;
}) {
  const { t } = useTranslation();
  const cols = timeline(items, today);
  const ref = useRef<HTMLDivElement>(null);

  function onKeyDown(e: KeyboardEvent) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const chips = [...(ref.current?.querySelectorAll<HTMLElement>('[data-chip]') ?? [])];
    const at = chips.indexOf(document.activeElement as HTMLElement);
    if (at < 0) return;
    e.preventDefault();
    chips[Math.max(0, Math.min(chips.length - 1, at + (e.key === 'ArrowRight' ? 1 : -1)))]?.focus();
  }

  const short = (item: PantryItem) => {
    const d = diffDays(today, item.expiresOn);
    if (d <= 0) return t('today.timeline.short.today');
    if (d < 60) return t('today.timeline.short.days', { count: d });
    if (d < 365) return t('today.timeline.short.months', { count: Math.floor(d / 30) });
    return t('today.timeline.short.years', { count: Math.floor(d / 365) });
  };

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- arrow keys between the chip buttons inside
    <div ref={ref} onKeyDown={onKeyDown} className="overflow-x-auto rounded-hero bg-shelf">
      <div className="grid w-max min-w-full grid-cols-[repeat(6,minmax(9.5rem,1fr))] gap-x-3 px-6 pb-5 pt-6">
        {TIMELINE_COLUMNS.map((c: TimelineColumn) => {
          const list = cols[c];
          const extra = list.length - PER_COLUMN;
          return (
            <ul
              key={c}
              aria-label={t(`today.timeline.columns.${c}`)}
              className="flex min-h-24 flex-col-reverse justify-start gap-2"
            >
              {list.slice(0, PER_COLUMN).map((item) => {
                const shelf = shelfFor(item, today) as 'today' | 'soon' | 'fresh';
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      data-chip
                      onClick={() => onOpen(item)}
                      className={cx(
                        'inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-[0.625rem] px-2.5 text-left text-[0.8125rem] font-semibold',
                        chipStyle[shelf],
                      )}
                    >
                      {chipIcon[shelf]}
                      <span className="truncate">{item.name}</span>{' '}
                      <span className="shrink-0 font-normal">{short(item)}</span>
                    </button>
                  </li>
                );
              })}
              {extra > 0 ? (
                <li>
                  <Link
                    to="/pantry"
                    className="inline-flex min-h-11 items-center rounded-[0.625rem] bg-white px-2.5 text-[0.8125rem] font-semibold text-ink bordered"
                  >
                    {t('today.timeline.more', { count: extra })}
                  </Link>
                </li>
              ) : null}
            </ul>
          );
        })}
        {/* The arrow and its ticks (decorative; columns are labeled above). */}
        <div aria-hidden="true" className="col-span-6 mt-3 flex items-center">
          <span className="h-1.5 flex-1 rounded-l-chip bg-navy" />
          <svg viewBox="0 0 24 24" className="-ml-1 size-7 text-navy" fill="currentColor">
            <path d="M4 3l18 9-18 9z" />
          </svg>
        </div>
        {TIMELINE_COLUMNS.map((c) => (
          <p
            key={`label-${c}`}
            aria-hidden="true"
            className={cx(
              'mt-2 text-sm font-semibold',
              c === 'today' ? 'text-terra-dark' : 'text-ink',
            )}
          >
            {t(`today.timeline.columns.${c}`)}
          </p>
        ))}
      </div>
    </div>
  );
}

/** TOD-7 legend: icon + word for each status. */
export function ShelfLegend() {
  const { t } = useTranslation();
  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-ink">
      <li className="flex items-center gap-1.5">
        <WarnIcon size={16} /> {t('today.legend.today')}
      </li>
      <li className="flex items-center gap-1.5">
        <ClockIcon size={16} /> {t('today.legend.soon')}
      </li>
      <li className="flex items-center gap-1.5">
        <LeafIcon size={16} /> {t('today.legend.fresh')}
      </li>
      <li className="text-secondary">{t('today.legend.note')}</li>
    </ul>
  );
}
