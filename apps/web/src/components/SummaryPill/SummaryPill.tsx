import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import { CheckIcon, SkipIcon, SparkIcon, WarnIcon } from '../icons';

export type SummaryTone = 'matched' | 'look' | 'skipped' | 'ai';

const styles: Record<SummaryTone, string> = {
  matched: 'bg-sage text-olive-dark',
  look: 'bg-peach text-peach-dark',
  skipped: 'bg-white text-ink bordered',
  ai: 'bg-periwinkle text-ink',
};

const icons: Record<SummaryTone, ReactNode> = {
  matched: <CheckIcon size={15} strokeWidth={2.4} />,
  look: <WarnIcon size={15} strokeWidth={2.2} />,
  skipped: <SkipIcon size={15} strokeWidth={2.2} />,
  ai: <SparkIcon size={15} strokeWidth={2.2} />,
};

/**
 * Count pill for a scan or receipt summary (REV-2, HIS-4): "10 matched", "2 need a look",
 * "2 skipped". Icon + words, never color alone (SRS 4.5).
 */
export function SummaryPill({
  tone,
  children,
  className,
}: {
  tone: SummaryTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      data-tone={tone}
      className={cx(
        'inline-flex items-center gap-1.5 rounded-chip px-3 py-1.5 text-[0.8125rem] font-semibold',
        styles[tone],
        className,
      )}
    >
      {icons[tone]}
      {children}
    </span>
  );
}
