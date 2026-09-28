import { cx } from '../../lib/cx';
import { ClockIcon, EmptyJarIcon, LeafIcon, SkipIcon, SparkIcon, WarnIcon } from '../icons';

export type StatusTagStatus = 'today' | 'soon' | 'fresh' | 'out' | 'ai' | 'skipped';

const styles: Record<StatusTagStatus, string> = {
  today: 'bg-terra-light text-terra-dark',
  soon: 'bg-apricot text-apricot-dark',
  fresh: 'bg-sage text-olive-dark',
  out: 'bg-shelf text-slate',
  ai: 'bg-periwinkle text-navy',
  skipped: 'bg-shelf text-slate',
};

const icons = {
  today: <WarnIcon size={15} strokeWidth={2.2} />,
  soon: <ClockIcon size={15} strokeWidth={2.2} />,
  fresh: <LeafIcon size={15} strokeWidth={2.2} />,
  out: <EmptyJarIcon size={15} strokeWidth={2.2} />,
  ai: <SparkIcon size={15} strokeWidth={2.2} />,
  skipped: <SkipIcon size={15} strokeWidth={2.2} />,
} satisfies Record<StatusTagStatus, JSX.Element>;

/**
 * Status is never color alone: always icon + words (SRS 4.5).
 * `suffix` adds a short visible note with a fuller spoken version, e.g. "· est." / ", estimated".
 */
export function StatusTag({
  status,
  text,
  suffix,
  className,
}: {
  status: StatusTagStatus;
  text: string;
  suffix?: { visible: string; spoken: string };
  className?: string;
}) {
  return (
    <span
      data-status={status}
      className={cx(
        'inline-flex items-center gap-1.5 rounded-[0.625rem] py-1.5 pl-2 pr-2.5 text-[0.8125rem] font-semibold',
        styles[status],
        className,
      )}
    >
      {icons[status]}
      {text}
      {suffix ? (
        <>
          <span aria-hidden="true" className="-ml-0.5 font-medium">
            {suffix.visible}
          </span>
          <span className="sr-only">{suffix.spoken}</span>
        </>
      ) : null}
    </span>
  );
}
