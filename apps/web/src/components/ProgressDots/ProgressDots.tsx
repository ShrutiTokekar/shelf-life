import { useTranslation } from 'react-i18next';
import { cx } from '../../lib/cx';
import { CheckIcon } from '../icons';

/**
 * TOD-2 progress (SRS 7 ProgressDots): numbered circles that fill with a check when done, and
 * "X of N done", announced politely as it changes.
 */
export function ProgressDots({
  total,
  done,
  className,
}: {
  total: number;
  done: number;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className={cx('flex items-center gap-2', className)}>
      <ol aria-hidden="true" className="flex gap-1.5">
        {Array.from({ length: total }, (_, i) => {
          const complete = i < done;
          return (
            <li
              key={i}
              className={cx(
                'flex size-7 items-center justify-center rounded-chip text-[0.8125rem] font-semibold',
                complete ? 'bg-olive-dark text-white' : 'border-2 border-line bg-white text-ink',
              )}
            >
              {complete ? <CheckIcon size={14} strokeWidth={2.8} /> : i + 1}
            </li>
          );
        })}
      </ol>
      <p role="status" className="text-sm font-semibold text-ink">
        {t('today.progress', { done, total })}
      </p>
    </div>
  );
}
