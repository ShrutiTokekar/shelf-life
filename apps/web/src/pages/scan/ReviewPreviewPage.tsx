import { formatQuantity } from '@shelf-life/shared';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button } from '../../components/Button/Button';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { ScanIcon } from '../../components/icons';
import { StatusTag } from '../../components/StatusTag/StatusTag';
import { useScanResult } from '../../stores/scanResult';

/**
 * Interim /scan/review (Milestone 3 end state, approved): a read-only summary of what the scan
 * found. Milestone 4 replaces this with the real review screen (REV-1..REV-7) that saves items.
 */
export function ReviewPreviewPage() {
  const { t } = useTranslation();
  const result = useScanResult((s) => s.result);

  if (!result) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6 page-x py-8">
        <h1 className="text-[2rem] leading-[1.125] lg:text-[3.5rem]">{t('review.title')}</h1>
        <EmptyState
          title={t('review.emptyTitle')}
          body={t('review.emptyBody')}
          action={
            <Button asChild>
              <Link to="/scan">
                <ScanIcon size={22} />
                {t('pantry.scanReceipt')}
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  const date = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${result.purchasedOn}T12:00:00`));
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 page-x py-8">
      <div>
        <h1 className="text-[2rem] leading-[1.125] lg:text-[3.5rem]">{t('review.title')}</h1>
        <p className="mt-1 font-semibold text-ink">
          {t('review.store', { store: result.store ?? t('review.unknownStore'), date })}
        </p>
        <p className="text-secondary">
          {t('review.summary', { lines: result.lineCount, items: result.items.length })}
        </p>
      </div>
      <p className="rounded-card bg-periwinkle px-4 py-3 text-ink">{t('review.interimNote')}</p>
      <ul className="flex flex-col gap-3">
        {result.items.map((item) => (
          <li
            key={item.index}
            className="flex flex-col gap-1.5 rounded-card bg-white p-4 bordered"
            data-testid="scanned-item"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
              {item.raw}
            </p>
            <p className="font-semibold text-ink">{item.name}</p>
            <p className="text-sm text-secondary">
              {[
                formatQuantity({ quantity: item.quantity, unit: item.unit ?? '' }),
                t(`locations.${item.location}`),
                `${t('review.expires', { date: item.expiresOn })} ${t('review.est')}`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            <StatusTag
              className="self-start"
              status={item.status === 'matched' ? 'fresh' : 'soon'}
              text={`${item.status === 'matched' ? t('review.matched') : t('review.needsLook')} · ${t('review.confidence', { percent: Math.round(item.confidence * 100) })}`}
            />
          </li>
        ))}
      </ul>
      <p className="text-sm text-secondary">
        {t('review.skipped', { count: result.skipped.length })}
      </p>
      <Button asChild variant="secondary">
        <Link to="/scan">
          <ScanIcon size={22} />
          {t('review.scanAnother')}
        </Link>
      </Button>
    </div>
  );
}
