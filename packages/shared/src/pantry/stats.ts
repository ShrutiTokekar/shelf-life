import type { Receipt } from '../receipt/types';
import type { Activity } from './activity';

export type ImpactStats = {
  /** Items this person used on or before their date, this calendar month (SRS 10). */
  savedThisMonth: number;
  /** Receipts this person scanned. */
  receiptsScanned: number;
  /** "I made this" by this person. */
  recipesCooked: number;
};

/**
 * PRO-1 impact stats, computed on the device from the pantry doc (works offline), counting what
 * this person did (decided Oct 5, 2026). `month` is "YYYY-MM" in local time.
 */
export function impactStats(
  activity: readonly Activity[],
  receipts: readonly Pick<Receipt, 'scannedBy'>[],
  userId: string,
  month: string,
  localMonth: (iso: string) => string = (iso) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  },
): ImpactStats {
  let savedThisMonth = 0;
  let recipesCooked = 0;
  for (const a of activity) {
    if (a.actorId !== userId) continue;
    if (a.type === 'used' && a.beforeExpiry && localMonth(a.createdAt) === month) savedThisMonth++;
    if (a.type === 'cooked') recipesCooked++;
  }
  return {
    savedThisMonth,
    receiptsScanned: receipts.filter((r) => r.scannedBy === userId).length,
    recipesCooked,
  };
}
