import { useTranslation } from 'react-i18next';
import { cx } from '../../lib/cx';

/** Grey block shaped like the final layout (SRS 6: loading = skeletons, not spinners). */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cx('animate-pulse rounded-card bg-shelf', className)} />
  );
}

/** Page-level loading placeholder with a text status for screen readers. */
export function PageSkeleton() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-4 page-x py-8" role="status" aria-live="polite">
      <span className="sr-only">{t('common.loading')}</span>
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
