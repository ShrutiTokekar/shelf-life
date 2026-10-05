import { describe, expect, it } from 'vitest';
import { impactStats, type Activity } from '../src';

const a = (over: Partial<Activity>): Activity => ({
  id: Math.random().toString(),
  pantryId: 'p',
  listId: 'l',
  actorId: 'me',
  type: 'used',
  subject: 'Spinach',
  itemId: 'i',
  beforeExpiry: true,
  createdAt: '2026-10-03T12:00:00.000Z',
  ...over,
});
const utcMonth = (iso: string) => iso.slice(0, 7);

describe('PRO-1 impact stats', () => {
  it('counts what I saved this month, receipts I scanned and recipes I cooked', () => {
    const stats = impactStats(
      [
        a({}),
        a({}),
        a({ beforeExpiry: false }),
        a({ actorId: 'someone-else' }),
        a({ createdAt: '2026-09-30T12:00:00.000Z' }),
        a({ type: 'ran_out', beforeExpiry: null }),
        a({ type: 'cooked', beforeExpiry: null, recipeId: 'r' }),
        a({ type: 'cooked', beforeExpiry: null, recipeId: 'r', createdAt: '2026-08-01T00:00:00Z' }),
      ],
      [{ scannedBy: 'me' }, { scannedBy: 'me' }, { scannedBy: 'other' }],
      'me',
      '2026-10',
      utcMonth,
    );
    expect(stats).toEqual({ savedThisMonth: 2, receiptsScanned: 2, recipesCooked: 2 });
  });
});
