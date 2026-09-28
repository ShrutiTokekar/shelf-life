import { useTranslation } from 'react-i18next';
import type { ScanProgress, ScanStep } from '../../features/ocr/scanSession';
import { SCAN_STEPS } from '../../features/ocr/scanSession';
import { cx } from '../../lib/cx';
import { CheckIcon, DotsIcon, LockIcon } from '../icons';
import { ProgressBar } from '../ProgressBar/ProgressBar';

export type ScanProgressSheetProps = {
  progress: ScanProgress;
  onCancel: () => void;
  /** Mobile: a sheet under the viewfinder. Desktop: a card. */
  variant?: 'sheet' | 'card';
  lockText: string;
};

/**
 * SCN-3 progress: percentage, bar and four steps (done / in progress / to do), SCN-6 lock note and
 * Cancel (SCN-4). Step changes are announced politely (SRS 7).
 */
export function ScanProgressSheet({
  progress,
  onCancel,
  variant = 'sheet',
  lockText,
}: ScanProgressSheetProps) {
  const { t } = useTranslation();
  const label = (step: ScanStep) => {
    const state = progress.steps[step];
    if (step === 'read' && state === 'done')
      return t('scan.steps.read', { count: progress.lineCount ?? 0 });
    return state === 'done' ? t(`scan.steps.${step}`) : t(`scan.steps.${step}Active`);
  };
  const current = SCAN_STEPS.find((s) => progress.steps[s] === 'active');

  return (
    <section
      aria-labelledby="scan-progress-title"
      className={cx(
        'flex flex-col gap-4 bg-cream px-6 pb-9 pt-6',
        variant === 'sheet' ? 'rounded-t-[1.75rem]' : 'rounded-hero bordered',
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="scan-progress-title" className="text-[1.375rem] leading-tight">
          {t('scan.reading')}
        </h2>
        <span aria-hidden="true" className="font-semibold text-navy">
          {t('scan.percent', { percent: progress.percent })}
        </span>
      </div>
      <ProgressBar value={progress.percent} label={t('scan.progressLabel')} />
      {progress.preparing ? <p className="text-sm text-secondary">{t('scan.preparing')}</p> : null}
      <ol className="flex flex-col gap-2.5">
        {SCAN_STEPS.map((step) => {
          const state = progress.steps[step];
          return (
            <li key={step} className="flex items-center gap-2.5 text-[0.9375rem]">
              <span
                aria-hidden="true"
                className={cx(
                  'flex size-6 shrink-0 items-center justify-center rounded-chip',
                  state === 'done' && 'bg-sage text-olive-dark',
                  state === 'active' && 'bg-periwinkle text-navy',
                  state === 'todo' && 'bg-white bordered',
                )}
              >
                {state === 'done' ? (
                  <CheckIcon size={14} strokeWidth={2.5} />
                ) : state === 'active' ? (
                  <DotsIcon />
                ) : null}
              </span>
              <span
                className={cx(
                  state === 'active'
                    ? 'font-semibold text-ink'
                    : state === 'done'
                      ? 'text-ink'
                      : 'text-secondary',
                )}
              >
                {label(step)}
              </span>
              <span className="sr-only">, {t(`scan.stepState.${state}`)}</span>
            </li>
          );
        })}
      </ol>
      {/* Screen readers hear each new step once, not every percentage tick. */}
      <p role="status" aria-live="polite" className="sr-only">
        {current ? label(current) : progress.percent === 100 ? label('expiry') : ''}
      </p>
      <p className="flex items-center gap-2 text-[0.8125rem] text-secondary">
        <LockIcon size={16} />
        {lockText}
      </p>
      <button
        type="button"
        onClick={onCancel}
        className="min-h-11 self-start rounded-xl px-1 font-semibold text-navy"
      >
        {t('scan.cancel')}
      </button>
    </section>
  );
}
