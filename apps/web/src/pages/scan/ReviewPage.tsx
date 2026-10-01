import {
  commitReview,
  confirmItem,
  draftFromReceipt,
  lineCaption,
  editItem,
  newId,
  restoreSkipped,
  reviewCounts,
  todayIso,
  toggleItem,
  type PantryItem,
  type ReviewDraft,
  type ReviewItem,
} from '@shelf-life/shared';
import { useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/Button/Button';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { ErrorState } from '../../components/ErrorState/ErrorState';
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  LockIcon,
  PlusIcon,
  ScanIcon,
  WarnIcon,
} from '../../components/icons';
import { ItemSheet } from '../../components/ItemSheet/ItemSheet';
import { listDotClass } from '../../components/PantryLabel/PantryLabel';
import { ReviewItemCard } from '../../components/ReviewItemCard/ReviewItemCard';
import { Select } from '../../components/Select/Select';
import { PageSkeleton } from '../../components/Skeleton/Skeleton';
import { SkipLink } from '../../components/SkipLink/SkipLink';
import { SummaryPill } from '../../components/SummaryPill/SummaryPill';
import { useToast } from '../../components/Toast/Toast';
import { cx } from '../../lib/cx';
import { formatShortDate } from '../../lib/format';
import { useCurrentPantry } from '../../lib/pantries';
import { useMe } from '../../lib/session';
import { applyReview } from '@shelf-life/docs';
import { useReceipts } from '../../lib/sync/useDocs';
import { useReviewDraft, type PantryHighlightState } from '../../stores/reviewDraft';

/**
 * Review scan (SRS 6.5, Figma mobile 05). Works on the in-memory draft from the scanner, or on a
 * saved receipt via `?receipt=<id>` ("Edit items", HIS-5). Everything is written locally, so it
 * works offline.
 */
export function ReviewPage() {
  const { t } = useTranslation();
  const me = useMe();
  // Scans land in a pantry this user can edit (SHR-6).
  const pantryId = useCurrentPantry().writable.id;
  const [params] = useSearchParams();
  const receiptId = params.get('receipt');
  const { doc, receipts, items: pantry, status, retry } = useReceipts(pantryId);
  const draft = useReviewDraft((s) => s.draft);
  const setDraft = useReviewDraft((s) => s.set);
  const saved = receiptId ? (receipts.find((r) => r.id === receiptId) ?? null) : null;

  // "Edit items": start from the saved receipt, unless its draft is already open (Re-run matching).
  useEffect(() => {
    if (saved && draft?.receiptId !== saved.id) setDraft(draftFromReceipt(saved, pantry));
  }, [saved, draft?.receiptId, pantry, setDraft]);

  const backTo = receiptId ? `/profile/receipts/${receiptId}` : '/scan';
  let body: JSX.Element;
  if (status === 'error') {
    body = <ErrorState message={t('review.storageError')} onRetry={retry} />;
  } else if (receiptId && status === 'loading') {
    body = <PageSkeleton />;
  } else if (receiptId && !saved) {
    body = <EmptyState title={t('review.emptyTitle')} body={t('review.notFound')} />;
  } else if (!draft || draft.receiptId !== receiptId) {
    body = receiptId ? (
      <PageSkeleton />
    ) : (
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
    );
  } else {
    return (
      <ReviewForm
        draft={draft}
        backTo={backTo}
        ready={doc !== null}
        onSave={(d) => {
          if (!doc) return null;
          const commit = commitReview(d, {
            pantryId,
            userId: me.user.id,
            now: new Date().toISOString(),
            pantry,
            scannedBy: saved?.scannedBy,
          });
          applyReview(
            doc,
            commit,
            d.receiptId
              ? []
              : [
                  {
                    id: newId(),
                    pantryId,
                    listId: d.listId,
                    actorId: me.user.id,
                    type: 'scanned',
                    subject: commit.receipt.storeName,
                    itemId: null,
                    beforeExpiry: null,
                    createdAt: commit.receipt.createdAt,
                  },
                ],
          );
          return commit;
        }}
      />
    );
  }

  return (
    <div className="min-h-dvh bg-cream">
      <SkipLink targetId="main" text={t('skip.review')} />
      <main id="main" className="mx-auto flex max-w-2xl flex-col gap-6 page-x py-8">
        <BackLink to={backTo} />
        {body}
      </main>
    </div>
  );
}

function BackLink({ to }: { to: string }) {
  const { t } = useTranslation();
  return (
    <Link
      to={to}
      aria-label={t('review.back')}
      className="-ml-3 flex size-11 items-center justify-center rounded-xl text-ink"
    >
      <ChevronLeftIcon size={24} />
    </Link>
  );
}

type ReviewFormProps = {
  draft: ReviewDraft;
  backTo: string;
  ready: boolean;
  onSave: (draft: ReviewDraft) => ReturnType<typeof commitReview> | null;
};

function ReviewForm({ draft, backTo, ready, onSave }: ReviewFormProps) {
  const { t } = useTranslation();
  const me = useMe();
  const navigate = useNavigate();
  const toast = useToast();
  const update = useReviewDraft((s) => s.update);
  const clear = useReviewDraft((s) => s.clear);
  const today = todayIso();
  const storeId = useId();
  const skippedId = useId();
  const [editing, setEditing] = useState<number | null>(null);
  const [showSkipped, setShowSkipped] = useState(false);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isEdit = draft.receiptId !== null;
  const counts = reviewCounts(draft);
  const { writable, writableLists } = useCurrentPantry();
  // REV-6: labels are lists of this pantry that the user may add to.
  const lists = useMemo(() => writableLists.filter((l) => l.role !== 'view'), [writableLists]);
  const editingItem = draft.items.find((i) => i.index === editing) ?? null;

  function save() {
    if (!isEdit && counts.checked === 0) {
      setError(t('review.noneChecked'));
      return;
    }
    const commit = onSave(draft);
    if (!commit) return;
    clear();
    if (isEdit) {
      toast({ message: t('review.savedToast') });
      navigate(`/profile/receipts/${commit.receipt.id}`, { replace: true });
    } else {
      toast({ message: t('review.addedToast', { count: commit.add.length }) });
      navigate('/pantry', {
        replace: true,
        state: { highlight: commit.add.map((i) => i.id) } satisfies PantryHighlightState,
      });
    }
  }

  const date = formatShortDate(draft.purchasedOn, today);
  const asPantryItem = (item: ReviewItem): PantryItem => ({
    id: `review-${item.index}`,
    pantryId: writable.id,
    listId: draft.listId,
    foodId: item.foodId,
    name: item.name.slice(0, 60),
    category: item.category,
    location: item.location,
    quantity: item.quantity,
    unit: item.unit,
    note: item.note,
    purchasedOn: draft.purchasedOn,
    expiresOn: item.expiresOn,
    expiryIsEstimate: item.expirySource !== 'user',
    expirySource: item.expirySource,
    status: 'active',
    outAt: null,
    addedBy: me.user.id,
    receiptLineId: null,
    updatedAt: '',
  });

  return (
    <div className="min-h-dvh bg-cream">
      <SkipLink targetId="review-items" text={t('skip.review')} />
      <main className="mx-auto flex max-w-2xl flex-col gap-5 page-x pb-48 pt-8">
        <div className="flex items-center gap-1">
          <BackLink to={backTo} />
          <h1 className="font-ui text-lg font-semibold text-ink">
            {isEdit ? t('review.editTitle') : t('review.title')}
          </h1>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={storeId} className="sr-only">
            {t('review.storeLabel')}
          </label>
          <input
            id={storeId}
            value={draft.storeName}
            placeholder={t('review.storePlaceholder')}
            maxLength={60}
            autoComplete="off"
            onChange={(e) => update((d) => ({ ...d, storeName: e.target.value }))}
            className="-mx-2 min-h-12 rounded-xl border-2 border-transparent bg-transparent px-2 font-display text-[2rem] leading-tight text-ink hover:border-line focus:border-navy lg:text-[2.75rem]"
          />
          <p className="text-secondary">
            {t('review.summary', { date, lines: draft.lineCount, items: draft.items.length })}
          </p>
        </div>

        <div className="flex flex-wrap gap-2" role="status">
          <SummaryPill tone="matched">
            {t('review.pills.matched', { count: counts.matched })}
          </SummaryPill>
          <SummaryPill tone="look">
            {t('review.pills.needsLook', { count: counts.needsLook })}
          </SummaryPill>
          <SummaryPill tone="skipped">
            {t('review.pills.skipped', { count: counts.skipped })}
          </SummaryPill>
        </div>

        {draft.items.length === 0 ? (
          <EmptyState title={t('review.noItemsTitle')} body={t('review.noItemsBody')} />
        ) : null}

        <ul
          id="review-items"
          tabIndex={-1}
          aria-label={t('review.itemsHeading')}
          className="flex flex-col gap-3 outline-none"
        >
          {draft.items.map((item) => (
            <ReviewItemCard
              key={item.index}
              item={item}
              today={today}
              autoFocusEdit={focusIndex === item.index}
              onToggle={() => {
                setError(null);
                update((d) => toggleItem(d, item.index));
              }}
              onConfirm={() => update((d) => confirmItem(d, item.index))}
              onEdit={() => setEditing(item.index)}
            />
          ))}
        </ul>

        {draft.skipped.length > 0 ? (
          <div className="rounded-card border-2 border-dashed border-line">
            <button
              type="button"
              aria-expanded={showSkipped}
              aria-controls={skippedId}
              onClick={() => setShowSkipped((s) => !s)}
              className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-left font-semibold text-ink"
            >
              {t('review.skippedRow', { count: draft.skipped.length })}
              <ChevronDownIcon
                size={20}
                className={cx('shrink-0 text-slate', showSkipped && 'rotate-180')}
              />
            </button>
            <ul id={skippedId} hidden={!showSkipped} className="flex flex-col px-4 pb-2">
              {draft.skipped.map((s) => (
                <li
                  key={s.index}
                  data-testid="skipped-line"
                  className="flex items-center gap-3 border-t-2 border-dashed border-line py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold uppercase tracking-[0.06em] text-ink [overflow-wrap:anywhere]">
                      {lineCaption(s.raw)}
                    </p>
                    <p className="text-sm text-secondary">{t(`review.reasons.${s.reason}`)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<PlusIcon size={18} />}
                    aria-label={t('review.restoreLabel', { raw: lineCaption(s.raw) })}
                    onClick={() => {
                      update((d) => restoreSkipped(d, s.index));
                      setFocusIndex(s.index);
                      setError(null);
                      toast({ message: t('review.restoredToast', { raw: lineCaption(s.raw) }) });
                    }}
                  >
                    {t('review.restore')}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <p className="flex items-center gap-2 text-sm text-secondary">
          <LockIcon size={16} />
          {t('review.privacy')}
        </p>
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-line bg-cream/95 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl flex-col gap-1 page-x">
          {error ? (
            <p role="alert" className="flex items-center gap-2 text-sm font-medium text-terra-dark">
              <WarnIcon size={16} />
              {error}
            </p>
          ) : null}
          <Button fullWidth loading={!ready} onClick={save}>
            {isEdit ? t('review.save') : t('review.add', { count: counts.checked })}
          </Button>
          <Select
            inline
            label={t('review.labelPrefix')}
            value={draft.listId}
            onChange={(listId) => update((d) => ({ ...d, listId }))}
            options={lists.map((l) => ({
              value: l.id,
              label: l.name,
              icon: (
                <span
                  aria-hidden="true"
                  className={`size-2.5 rounded-chip ${listDotClass[l.color]}`}
                />
              ),
            }))}
          />
        </div>
      </footer>

      <ItemSheet
        open={editingItem !== null}
        mode="edit"
        item={editingItem ? asPantryItem(editingItem) : null}
        lists={lists}
        defaultListId={draft.listId}
        today={today}
        hideList
        onClose={() => setEditing(null)}
        onSave={(form, meta) => {
          if (editing !== null) update((d) => editItem(d, editing, form, meta.estimated));
          setEditing(null);
        }}
      />
    </div>
  );
}
