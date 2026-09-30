import {
  draftFromReceipt,
  rematchDraft,
  todayIso,
  type PantryItem,
  type Receipt,
} from '@shelf-life/shared';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import type * as Y from 'yjs';
import { Avatar } from '../../components/Avatar/Avatar';
import { Button } from '../../components/Button/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog/ConfirmDialog';
import { EditIcon, LockIcon, RefreshIcon, TrashIcon } from '../../components/icons';
import { ReceiptPaper } from '../../components/ReceiptPaper/ReceiptPaper';
import { SummaryPill } from '../../components/SummaryPill/SummaryPill';
import { useToast } from '../../components/Toast/Toast';
import { cx } from '../../lib/cx';
import { formatMoney, formatShortDate, formatTime } from '../../lib/format';
import type { Person } from '../../lib/people';
import { deleteReceipt, putReceipt } from '../../lib/sync/receiptStore';
import { useReviewDraft } from '../../stores/reviewDraft';

export type ReceiptDetailProps = {
  receipt: Receipt;
  pantry: readonly PantryItem[];
  doc: Y.Doc | null;
  scanner: Person | null;
  scannerName: string;
  /** Mobile shows the detail as its own page (h1); desktop as the side panel (h2). */
  asPage: boolean;
  className?: string;
};

/** Receipt detail (HIS-4, HIS-5, HIS-6; Figma mobile 14, right panel of web 16). */
export function ReceiptDetail({
  receipt,
  pantry,
  doc,
  scanner,
  scannerName,
  asPage,
  className,
}: ReceiptDetailProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const setDraft = useReviewDraft((s) => s.set);
  const [confirming, setConfirming] = useState(false);
  const today = todayIso();
  const Heading = asPage ? 'h1' : 'h2';

  const locations = useMemo(() => new Map(pantry.map((i) => [i.id, i.location])), [pantry]);
  const added = receipt.lines.filter((l) => l.pantryItemId !== null);
  const toCheck = added.filter((l) => !l.confirmed).length;
  const skipped = receipt.lines.filter((l) => l.kind === 'skipped').length;
  const ai = added.filter((l) => l.matchSource === 'ai').length;
  const scannedSameDay = todayIso(new Date(receipt.createdAt)) === receipt.purchasedOn;
  const when = scannedSameDay
    ? `${formatShortDate(receipt.purchasedOn, today)}, ${formatTime(receipt.createdAt)}`
    : formatShortDate(receipt.purchasedOn, today);

  function rerun() {
    const before = draftFromReceipt(receipt, pantry);
    const after = rematchDraft(before);
    const better = after.items.filter((item, i) => item.foodId !== before.items[i]!.foodId).length;
    if (better === 0) {
      toast({ message: t('receipts.detail.rerunNone') });
      return;
    }
    setDraft(after);
    toast({ message: t('receipts.detail.rerunDone', { count: better }) });
    navigate(`/scan/review?receipt=${receipt.id}`);
  }

  function remove() {
    setConfirming(false);
    if (!doc) return;
    const before = deleteReceipt(doc, receipt.id);
    toast({
      message: t('receipts.detail.deletedToast'),
      action: before
        ? { label: t('receipts.detail.undo'), onAction: () => putReceipt(doc, before) }
        : undefined,
    });
    navigate('/profile/receipts', { replace: true });
  }

  return (
    <section
      aria-labelledby={`receipt-${receipt.id}`}
      data-testid="receipt-detail"
      className={cx('flex flex-col gap-4', className)}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Heading
            id={`receipt-${receipt.id}`}
            className="text-[2rem] leading-[1.1] [overflow-wrap:anywhere] lg:text-[2.5rem]"
          >
            {receipt.storeName || t('review.unknownStore')}
          </Heading>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-secondary">
            {t('receipts.detail.scanned', { date: when })}
            {scanner ? <Avatar initial={scanner.initial} tone={scanner.tone} size={22} /> : null}
            {scannerName}
          </p>
        </div>
        <p className="font-display text-[1.75rem] text-ink">
          {receipt.total !== null ? (
            formatMoney(receipt.total)
          ) : (
            <span className="font-ui text-base text-secondary">{t('receipts.detail.noTotal')}</span>
          )}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <SummaryPill tone="matched">
          {t('receipts.detail.added', { count: added.length })}
        </SummaryPill>
        {ai > 0 ? (
          <SummaryPill tone="ai">{t('receipts.detail.ai', { count: ai })}</SummaryPill>
        ) : null}
        {toCheck > 0 ? (
          <SummaryPill tone="look">{t('receipts.detail.toCheck', { count: toCheck })}</SummaryPill>
        ) : null}
        <SummaryPill tone="skipped">{t('receipts.detail.skipped', { count: skipped })}</SummaryPill>
      </div>

      <ReceiptPaper
        lines={receipt.lines}
        locationOf={(l) => (l.pantryItemId ? (locations.get(l.pantryItemId) ?? null) : null)}
      />

      <p className="flex items-center gap-2 text-sm text-secondary">
        <LockIcon size={16} />
        {t('receipts.detail.photoNote')}
      </p>

      <div className="flex flex-wrap gap-3">
        <Button asChild className="max-lg:flex-1">
          <Link to={`/scan/review?receipt=${receipt.id}`}>
            <EditIcon size={20} />
            {t('receipts.detail.edit')}
          </Link>
        </Button>
        {/* HIS-5 Re-run matching is a web action (P1). */}
        <Button
          variant="secondary"
          className="max-lg:hidden"
          icon={<RefreshIcon size={20} />}
          onClick={rerun}
        >
          {t('receipts.detail.rerun')}
        </Button>
        <Button
          variant="danger"
          icon={<TrashIcon size={20} />}
          // Mobile shows the short "Delete" (Figma 14); the name stays the full action.
          aria-label={t('receipts.detail.delete')}
          onClick={() => setConfirming(true)}
        >
          <span className="lg:hidden">{t('receipts.detail.deleteShort')}</span>
          <span className="max-lg:hidden">{t('receipts.detail.delete')}</span>
        </Button>
      </div>

      <ConfirmDialog
        open={confirming}
        title={t('receipts.detail.deleteTitle')}
        body={t('receipts.detail.deleteBody')}
        confirmLabel={t('receipts.detail.deleteConfirm')}
        cancelLabel={t('receipts.detail.cancel')}
        icon={<TrashIcon size={20} />}
        onConfirm={remove}
        onCancel={() => setConfirming(false)}
      />
    </section>
  );
}
