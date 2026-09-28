import { diffDays, type IsoDate } from '../dates';
import type { PantryItem } from './types';

/** Shelf / status keys (SRS 4.5, 8.3). */
export type Shelf = 'today' | 'soon' | 'fresh' | 'out';

export function daysLeft(item: Pick<PantryItem, 'expiresOn'>, today: IsoDate): number {
  return diffDays(today, item.expiresOn);
}

/** Items that still belong on a shelf (used and discarded items are gone). */
export function isOnShelf(item: Pick<PantryItem, 'status'>): boolean {
  return item.status === 'active' || item.status === 'out';
}

/**
 * SRS 8.3: daysLeft ≤ 0 → today; 1–7 → soon; ≥ 8 → fresh; quantity 0 (or status out) → out.
 */
export function shelfFor(
  item: Pick<PantryItem, 'status' | 'quantity' | 'expiresOn'>,
  today: IsoDate,
): Shelf {
  if (item.status === 'out' || item.quantity === 0) return 'out';
  const d = daysLeft(item, today);
  if (d <= 0) return 'today';
  if (d <= 7) return 'soon';
  return 'fresh';
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/** Status words shown next to the icon (SRS 4.5): "Expires today", "2 days left", "3 weeks". */
export function formatTimeLeft(days: number): string {
  if (days < -1) return `Expired ${days * -1} days ago`;
  if (days === -1) return 'Expired yesterday';
  if (days === 0) return 'Expires today';
  if (days <= 7) return `${plural(days, 'day')} left`;
  if (days < 14) return plural(days, 'day');
  if (days < 60) return plural(Math.floor(days / 7), 'week');
  if (days < 365) return plural(Math.floor(days / 30), 'month');
  return plural(Math.floor(days / 365), 'year');
}

/** "Ran out today" / "Ran out yesterday" / "Ran out 3 days ago". */
export function formatRanOut(outAt: IsoDate | null, today: IsoDate): string {
  if (!outAt) return 'Ran out';
  const ago = diffDays(outAt, today);
  if (ago <= 0) return 'Ran out today';
  if (ago === 1) return 'Ran out yesterday';
  return `Ran out ${ago} days ago`;
}

/** "1 bag", "500 g", "6", "" (unknown quantity). */
export function formatQuantity(item: Pick<PantryItem, 'quantity' | 'unit'>): string {
  if (item.quantity === null) return item.unit;
  const n = Number.isInteger(item.quantity)
    ? String(item.quantity)
    : item.quantity.toFixed(1).replace(/\.0$/, '');
  return item.unit ? `${n} ${item.unit}` : n;
}
