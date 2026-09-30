import { receiptStatus, type Receipt } from '@shelf-life/shared';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { cx } from '../../lib/cx';
import { formatMoney } from '../../lib/format';
import type { Person } from '../../lib/people';
import { Avatar } from '../Avatar/Avatar';
import { CheckIcon, ChevronRightIcon, EditIcon, ReceiptIcon, WarnIcon } from '../icons';

export type ReceiptRowProps = {
  receipt: Receipt;
  /** "Sep 24" or "Today, 9:02 AM". */
  dateText: string;
  scanner: Person | null;
  /** "You" when the scanner is the user. */
  scannerName: string;
  href: string;
  /** Desktop: the receipt open in the side panel. */
  selected?: boolean;
  /** HIS-2 needs-review card: the primary Review button. */
  action?: ReactNode;
};

/** Status chip (HIS-3): All added, N edited, N lines to check. Icon + words (SRS 4.5). */
export function ReceiptStatusChip({ receipt }: { receipt: Receipt }) {
  const { t } = useTranslation();
  const s = receiptStatus(receipt);
  const [cls, icon, text] =
    s.state === 'needs_review'
      ? [
          'bg-terra-light text-terra-dark',
          <WarnIcon key="i" size={15} />,
          t('receipts.status.review', { count: s.unresolved }),
        ]
      : s.state === 'edited'
        ? [
            'bg-periwinkle text-ink',
            <EditIcon key="i" size={15} />,
            t('receipts.status.edited', { count: s.edited }),
          ]
        : [
            'bg-sage text-olive-dark',
            <CheckIcon key="i" size={15} strokeWidth={2.4} />,
            t('receipts.status.clean'),
          ];
  return (
    <span
      data-state={s.state}
      className={cx(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-chip px-2.5 py-1 text-[0.8125rem] font-semibold',
        cls,
      )}
    >
      {icon}
      {text}
    </span>
  );
}

/**
 * A receipt in the history list (SRS 7 ReceiptRow, HIS-3): receipt icon (the photo is never kept),
 * store, total, date, item count, scanner and status chip. The store name is the link; it covers
 * the card so the whole row opens it, while `action` stays its own button.
 */
export function ReceiptRow({
  receipt,
  dateText,
  scanner,
  scannerName,
  href,
  selected,
  action,
}: ReceiptRowProps) {
  const { t } = useTranslation();
  const review = receipt.reviewState === 'needs_review';
  const store = receipt.storeName || t('review.unknownStore');
  return (
    <article
      data-testid="receipt-row"
      className={cx(
        'relative flex flex-col gap-3 rounded-card border-2 bg-white p-4 focus-within:outline-none',
        review ? 'border-terra' : selected ? 'border-navy' : 'border-line',
      )}
    >
      <div className="flex items-start gap-3">
        <ReceiptIcon size={34} className="mt-0.5 shrink-0 text-slate" strokeWidth={1.6} />
        <div className="min-w-0 flex-1">
          <h3 className="font-ui text-lg font-semibold text-ink">
            <Link
              to={href}
              aria-current={selected ? 'true' : undefined}
              className="rounded-sm after:absolute after:inset-0 after:rounded-card after:content-['']"
            >
              {store}
            </Link>
            {receipt.total !== null ? (
              <span className="ml-2 font-medium text-secondary">{formatMoney(receipt.total)}</span>
            ) : null}
          </h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-sm text-secondary">
            <span>{dateText}</span>
            <span aria-hidden="true">·</span>
            <span>{t('receipts.items', { count: receipt.itemsAdded })}</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">
              {scanner ? <Avatar initial={scanner.initial} tone={scanner.tone} size={20} /> : null}
              {scannerName}
            </span>
          </p>
          <div className="mt-2 lg:hidden">
            <ReceiptStatusChip receipt={receipt} />
          </div>
        </div>
        <div className="max-lg:hidden">
          <ReceiptStatusChip receipt={receipt} />
        </div>
        {!action ? (
          <ChevronRightIcon size={20} className="mt-1 shrink-0 text-navy lg:hidden" />
        ) : null}
      </div>
      {action ? <div className="relative z-10">{action}</div> : null}
    </article>
  );
}
