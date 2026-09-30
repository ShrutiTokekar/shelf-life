import { isUnresolved, lineCaption, type Location, type ReceiptLine } from '@shelf-life/shared';
import { useId, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cx } from '../../lib/cx';
import { ArrowRightIcon, CheckIcon, SkipIcon, SparkIcon, WarnIcon } from '../icons';

export type ReceiptPaperProps = {
  lines: readonly ReceiptLine[];
  /** Where each added line's pantry item lives now (null when that item is gone). */
  locationOf: (line: ReceiptLine) => Location | null;
  /** Lines shown before "+ N more lines". */
  initialCount?: number;
  className?: string;
};

/** Zig-zag paper edge (SRS 7 ReceiptPaper: torn edges). Fill follows the paper token. */
function TornEdge({ flip }: { flip?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 120 6"
      preserveAspectRatio="none"
      className={cx('block h-2 w-full text-white', flip && 'rotate-180')}
    >
      <path
        fill="currentColor"
        d="M0 6V3l5-3 5 3 5-3 5 3 5-3 5 3 5-3 5 3 5-3 5 3 5-3 5 3 5-3 5 3 5-3 5 3 5-3 5 3 5-3 5 3 5-3 5 3 5-3 5 3 5-3 5 3v3Z"
      />
    </svg>
  );
}

function Result({ line, location }: { line: ReceiptLine; location: Location | null }) {
  const { t } = useTranslation();
  const name = line.matchName ?? '';
  let tone: string;
  let icon: ReactNode;
  let text: string;
  if (line.kind === 'skipped') {
    tone = 'bg-shelf text-slate';
    icon = <SkipIcon size={15} />;
    text = t('receipts.detail.resultSkipped', {
      reason: t(`review.reasons.${line.skipReason ?? 'other'}`).toLowerCase(),
    });
  } else if (line.pantryItemId === null) {
    tone = 'bg-white text-slate bordered';
    icon = <SkipIcon size={15} />;
    text = t('receipts.detail.resultNotAdded', { name });
  } else if (isUnresolved(line)) {
    tone = 'bg-peach text-peach-dark';
    icon = <WarnIcon size={15} />;
    text = t('receipts.detail.resultUnsure', { name });
  } else {
    // AI-matched lines (Milestone 6) get the spark; everything else is a plain match.
    const ai = line.matchSource === 'ai';
    tone = ai ? 'bg-periwinkle text-ink' : 'bg-sage text-olive-dark';
    icon = ai ? <SparkIcon size={15} /> : <CheckIcon size={15} strokeWidth={2.4} />;
    text = location
      ? t('receipts.detail.resultAdded', { name, location: t(`locations.${location}`) })
      : name;
  }
  return (
    <span
      className={cx(
        'inline-flex max-w-full items-center gap-1.5 rounded-chip px-2.5 py-1 text-[0.8125rem] font-semibold',
        tone,
      )}
    >
      {icon}
      <span className="[overflow-wrap:anywhere]">{text}</span>
    </span>
  );
}

/**
 * The saved receipt text (HIS-4): each raw line → what it became. Torn edges and dashed dividers
 * echo the paper; long receipts collapse after `initialCount` lines.
 */
export function ReceiptPaper({
  lines,
  locationOf,
  initialCount = 8,
  className,
}: ReceiptPaperProps) {
  const { t } = useTranslation();
  const listId = useId();
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? lines : lines.slice(0, initialCount);
  const hidden = lines.length - shown.length;

  return (
    <div className={cx('flex flex-col', className)}>
      <TornEdge />
      <div className="bg-white px-5 py-2">
        <ol id={listId} aria-label={t('receipts.detail.linesHeading')}>
          {shown.map((line) => (
            <li
              key={line.id}
              data-testid="receipt-line"
              className="flex flex-col gap-1.5 border-b-2 border-dashed border-line py-3 last:border-b-0 lg:flex-row lg:items-center lg:gap-3"
            >
              <span className="flex items-center gap-2 lg:w-[45%] lg:shrink-0">
                <span className="min-w-0 flex-1 font-semibold uppercase tracking-[0.06em] text-ink [overflow-wrap:anywhere]">
                  {lineCaption(line.rawText)}
                </span>
                {line.price !== null ? (
                  <span className="text-sm font-medium tabular-nums text-secondary">
                    {line.price.toFixed(2)}
                  </span>
                ) : null}
                <ArrowRightIcon size={16} className="text-slate max-lg:rotate-90" />
                <span className="sr-only">{t('receipts.detail.becomes')}</span>
              </span>
              <span>
                <Result line={line} location={locationOf(line)} />
              </span>
            </li>
          ))}
        </ol>
        {hidden > 0 || expanded ? (
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={listId}
            onClick={() => setExpanded((e) => !e)}
            className="flex min-h-11 items-center font-semibold text-navy"
          >
            {expanded ? t('receipts.detail.fewer') : t('receipts.detail.more', { count: hidden })}
          </button>
        ) : null}
      </div>
      <TornEdge flip />
    </div>
  );
}
