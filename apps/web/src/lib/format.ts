/** Display formatting in the user's locale. Receipt amounts are US dollars (SRS 2.3). */

const money = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' });
export const formatMoney = (amount: number) => money.format(amount);

/** Noon avoids a calendar date shifting a day in far-off time zones. */
const atNoon = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`);

/** "Sep 24"; adds the year when it isn't this year. */
export function formatShortDate(iso: string, today: string): string {
  const sameYear = iso.slice(0, 4) === today.slice(0, 4);
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(atNoon(iso));
}

/** "September", or "September 2025" for another year ("2025-09"). */
export function formatMonth(month: string, today: string): string {
  const sameYear = month.slice(0, 4) === today.slice(0, 4);
  return new Intl.DateTimeFormat(undefined, {
    month: 'long',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(atNoon(`${month}-15`));
}

/** "6:41 PM" from an ISO timestamp, in local time. */
export const formatTime = (timestamp: string) =>
  new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(
    new Date(timestamp),
  );
