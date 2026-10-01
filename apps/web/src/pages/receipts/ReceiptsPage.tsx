import {
  filterReceipts,
  groupReceipts,
  RECEIPT_FILTERS,
  RECEIPT_PAGE,
  receiptFilterCounts,
  receiptStatus,
  todayIso,
  type Receipt,
  type ReceiptFilter,
  type ReceiptQuery,
} from '@shelf-life/shared';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { Button } from '../../components/Button/Button';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { ErrorState } from '../../components/ErrorState/ErrorState';
import { ChevronLeftIcon, ChevronRightIcon, LockIcon, ScanIcon } from '../../components/icons';
import { ReceiptRow } from '../../components/ReceiptRow/ReceiptRow';
import { SearchField } from '../../components/SearchField/SearchField';
import { SegmentedControl } from '../../components/SegmentedControl/SegmentedControl';
import { Select } from '../../components/Select/Select';
import { PageSkeleton } from '../../components/Skeleton/Skeleton';
import { formatMonth, formatShortDate, formatTime } from '../../lib/format';
import { useCurrentPantry } from '../../lib/pantries';
import { usePeople } from '../../lib/people';
import { useMe } from '../../lib/session';
import { useReceipts } from '../../lib/sync/useDocs';
import { DESKTOP_QUERY, useMediaQuery } from '../../lib/useMediaQuery';
import { ReceiptDetail } from './ReceiptDetail';

const ANYONE = 'anyone';

/**
 * Receipt history (SRS 6.12, Figma mobile 13–14, web 16). Mobile shows the list, or one receipt at
 * /profile/receipts/:id; desktop shows both, the selected receipt in a side panel. Receipts are
 * read from the pantry doc on this device, so the page works offline.
 */
export function ReceiptsPage() {
  const { t } = useTranslation();
  const me = useMe();
  const { id } = useParams();
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const people = usePeople(me);
  const today = todayIso();
  const current = useCurrentPantry();
  const { doc, receipts, items, status, retry } = useReceipts(current.pantry.id);
  const [query, setQuery] = useState<ReceiptQuery>({ query: '', filter: 'all', scannedBy: null });
  const [limit, setLimit] = useState(RECEIPT_PAGE);

  const onSearch = useCallback((q: string) => setQuery((s) => ({ ...s, query: q })), []);
  const visible = useMemo(() => filterReceipts(receipts, query, today), [receipts, query, today]);
  const groups = useMemo(() => groupReceipts(visible, limit), [visible, limit]);
  const counts = useMemo(
    () => receiptFilterCounts(receipts, query, today),
    [receipts, query, today],
  );
  const scanners = useMemo(() => [...new Set(receipts.map((r) => r.scannedBy))], [receipts]);
  const itemsAdded = receipts.reduce((n, r) => n + r.itemsAdded, 0);

  const scannerName = (userId: string) =>
    userId === me.user.id ? t('receipts.you') : (people.get(userId)?.name ?? '');
  const dateText = (r: Receipt) =>
    r.purchasedOn === today && todayIso(new Date(r.createdAt)) === today
      ? `${t('receipts.today')}, ${formatTime(r.createdAt)}`
      : formatShortDate(r.purchasedOn, today);

  const selected = id ? (receipts.find((r) => r.id === id) ?? null) : null;
  // Desktop opens the first receipt in the panel when none is picked (web 16).
  const panel =
    selected ?? (isDesktop ? (groups.needsReview[0] ?? groups.months[0]?.receipts[0]) : null);

  if (status === 'loading') return <PageSkeleton />;

  const detail = (r: Receipt, asPage: boolean) => (
    <ReceiptDetail
      key={r.id}
      receipt={r}
      pantry={items}
      doc={doc}
      readOnly={!current.pantry.canEdit}
      scanner={people.get(r.scannedBy) ?? null}
      scannerName={scannerName(r.scannedBy)}
      asPage={asPage}
      className={asPage ? '' : 'rounded-hero bg-shelf p-6 lg:sticky lg:top-6 lg:p-8'}
    />
  );

  // Mobile detail page (Figma 14).
  if (id && !isDesktop) {
    return (
      <div
        id="receipts"
        tabIndex={-1}
        className="mx-auto flex max-w-3xl flex-col gap-4 page-x pb-8 pt-6 outline-none"
      >
        <Link
          to="/profile/receipts"
          aria-label={t('receipts.detail.close')}
          className="-ml-3 flex size-11 items-center justify-center rounded-xl text-ink"
        >
          <ChevronLeftIcon size={24} />
        </Link>
        {status === 'error' ? (
          <ErrorState message={t('receipts.storageError')} onRetry={retry} />
        ) : selected ? (
          detail(selected, true)
        ) : (
          <EmptyState title={t('receipts.emptyTitle')} body={t('review.notFound')} />
        )}
      </div>
    );
  }

  const row = (r: Receipt, review = false) => (
    <li key={r.id}>
      <ReceiptRow
        receipt={r}
        dateText={dateText(r)}
        scanner={people.get(r.scannedBy) ?? null}
        scannerName={scannerName(r.scannedBy)}
        href={`/profile/receipts/${r.id}`}
        selected={isDesktop && panel?.id === r.id}
        action={
          review ? (
            <Button asChild fullWidth className="lg:w-auto">
              <Link to={`/scan/review?receipt=${r.id}`}>
                {isDesktop
                  ? t('receipts.review')
                  : t('receipts.reviewLines', { count: receiptStatus(r).unresolved })}
              </Link>
            </Button>
          ) : undefined
        }
      />
    </li>
  );

  const filtered = query.query.trim() !== '' || query.filter !== 'all' || query.scannedBy !== null;
  let list: JSX.Element;
  if (status === 'error') {
    list = <ErrorState message={t('receipts.storageError')} onRetry={retry} />;
  } else if (receipts.length === 0) {
    list = (
      <EmptyState
        title={t('receipts.emptyTitle')}
        body={t('receipts.emptyBody')}
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
  } else if (visible.length === 0) {
    list = (
      <EmptyState
        title={t('receipts.noMatches')}
        body={t('receipts.emptyBody')}
        action={
          filtered ? (
            <Button
              variant="secondary"
              onClick={() => setQuery((q) => ({ ...q, filter: 'all', scannedBy: null }))}
            >
              {t('receipts.clearFilters')}
            </Button>
          ) : undefined
        }
      />
    );
  } else {
    list = (
      <div className="flex flex-col gap-6">
        {groups.needsReview.length > 0 ? (
          <section aria-labelledby="needs-review" className="flex flex-col gap-3">
            <h2
              id="needs-review"
              className="font-ui text-sm font-semibold uppercase tracking-[0.08em] text-terra-dark"
            >
              {t('receipts.needsReview', { count: groups.needsReview.length })}
            </h2>
            <ul className="flex flex-col gap-3">{groups.needsReview.map((r) => row(r, true))}</ul>
          </section>
        ) : null}
        {groups.months.map((g) => (
          <section key={g.month} aria-labelledby={`m-${g.month}`} className="flex flex-col gap-3">
            <h2
              id={`m-${g.month}`}
              className="font-ui text-sm font-semibold uppercase tracking-[0.08em] text-secondary"
            >
              {formatMonth(g.month, today)}
            </h2>
            <ul className="flex flex-col gap-3">{g.receipts.map((r) => row(r))}</ul>
          </section>
        ))}
        {groups.hidden > 0 ? (
          <Button variant="secondary" fullWidth onClick={() => setLimit((l) => l + RECEIPT_PAGE)}>
            {t('receipts.showOlder', { count: Math.min(groups.hidden, RECEIPT_PAGE) })}
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-4 page-x pb-8 pt-6 lg:gap-6 lg:pt-7">
      <nav aria-label={t('receipts.breadcrumb')}>
        <Link
          to="/profile"
          className="-ml-3 inline-flex min-h-11 items-center gap-1 rounded-xl px-2 font-semibold text-navy"
        >
          <ChevronLeftIcon size={20} className="lg:hidden" />
          {t('receipts.breadcrumb')}
          <ChevronRightIcon size={18} className="text-slate max-lg:hidden" />
          <span className="font-medium text-secondary max-lg:hidden">{t('receipts.title')}</span>
        </Link>
      </nav>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-[2.25rem] leading-[1.1] lg:text-[4rem]">{t('receipts.title')}</h1>
          <p className="mt-1 flex items-center gap-2 text-sm font-medium text-secondary lg:text-lg">
            <LockIcon size={16} />
            {t('receipts.privacy', { count: receipts.length, items: itemsAdded })}
          </p>
        </div>
        <SearchField
          className="lg:w-80"
          label={t('receipts.search')}
          placeholder={isDesktop ? t('receipts.searchPlaceholder') : t('receipts.search')}
          clearLabel={t('receipts.clearSearch')}
          hideLabel
          onSearch={onSearch}
        />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <SegmentedControl
          className="lg:w-fit"
          label={t('receipts.filter')}
          value={query.filter}
          onChange={(filter: ReceiptFilter) => setQuery((q) => ({ ...q, filter }))}
          options={RECEIPT_FILTERS.map((f) => ({
            value: f,
            label: t(`receipts.filters.${f}`, { count: counts[f] }),
          }))}
        />
        {isDesktop && scanners.length > 1 ? (
          <Select
            className="w-60"
            label={t('receipts.scannedBy')}
            value={query.scannedBy ?? ANYONE}
            onChange={(v) => setQuery((q) => ({ ...q, scannedBy: v === ANYONE ? null : v }))}
            options={[
              { value: ANYONE, label: t('receipts.anyone') },
              ...scanners.map((s) => ({ value: s, label: scannerName(s) || s })),
            ]}
          />
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start">
        <div id="receipts" tabIndex={-1} className="outline-none">
          {list}
        </div>
        {isDesktop && panel ? detail(panel, false) : null}
      </div>
    </div>
  );
}
