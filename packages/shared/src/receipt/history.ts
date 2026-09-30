import type { IsoDate } from '../dates';
import type { Receipt } from './types';

/** HIS-1 filter. */
export const RECEIPT_FILTERS = ['all', 'review', 'month'] as const;
export type ReceiptFilter = (typeof RECEIPT_FILTERS)[number];

export type ReceiptQuery = {
  query: string;
  filter: ReceiptFilter;
  /** Web "Scanned by" select; null = anyone. */
  scannedBy: string | null;
};

export const ALL_RECEIPTS: ReceiptQuery = { query: '', filter: 'all', scannedBy: null };

/** HIS-7 page size. */
export const RECEIPT_PAGE = 20;

const needsReview = (r: Receipt) => r.reviewState === 'needs_review';
const sameMonth = (r: Receipt, today: IsoDate) => r.purchasedOn.slice(0, 7) === today.slice(0, 7);

/** Newest first: purchase date, then when it was scanned. */
export const byNewest = (a: Receipt, b: Receipt) =>
  b.purchasedOn.localeCompare(a.purchasedOn) || b.createdAt.localeCompare(a.createdAt);

/** HIS-1 search: store name, raw line text or matched item name, case-insensitive. */
export function matchesQuery(r: Receipt, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (r.storeName.toLowerCase().includes(q)) return true;
  return r.lines.some(
    (l) =>
      l.rawText.toLowerCase().includes(q) ||
      (l.kind === 'item' && (l.matchName ?? '').toLowerCase().includes(q)),
  );
}

export function filterReceipts(
  receipts: readonly Receipt[],
  q: ReceiptQuery,
  today: IsoDate,
): Receipt[] {
  return receipts
    .filter(
      (r) =>
        (q.filter === 'all' ||
          (q.filter === 'review' && needsReview(r)) ||
          (q.filter === 'month' && sameMonth(r, today))) &&
        (q.scannedBy === null || r.scannedBy === q.scannedBy) &&
        matchesQuery(r, q.query),
    )
    .sort(byNewest);
}

/** Counts on the filter control ("All 12 · Needs review 1 · This month 5"), after search. */
export function receiptFilterCounts(
  receipts: readonly Receipt[],
  q: Omit<ReceiptQuery, 'filter'>,
  today: IsoDate,
): Record<ReceiptFilter, number> {
  const base = receipts.filter(
    (r) => (q.scannedBy === null || r.scannedBy === q.scannedBy) && matchesQuery(r, q.query),
  );
  return {
    all: base.length,
    review: base.filter(needsReview).length,
    month: base.filter((r) => sameMonth(r, today)).length,
  };
}

export type MonthGroup = { month: string; receipts: Receipt[] };

/**
 * HIS-2 + HIS-3 + HIS-7: receipts needing review first (never paged, they need action), then the
 * rest grouped by purchase month, showing `limit` of them. `hidden` is how many older ones remain.
 */
export function groupReceipts(
  sorted: readonly Receipt[],
  limit: number = RECEIPT_PAGE,
): { needsReview: Receipt[]; months: MonthGroup[]; hidden: number } {
  const review = sorted.filter(needsReview);
  const rest = sorted.filter((r) => !needsReview(r));
  const months: MonthGroup[] = [];
  for (const r of rest.slice(0, limit)) {
    const month = r.purchasedOn.slice(0, 7);
    const last = months[months.length - 1];
    if (last?.month === month) last.receipts.push(r);
    else months.push({ month, receipts: [r] });
  }
  return { needsReview: review, months, hidden: Math.max(0, rest.length - limit) };
}
