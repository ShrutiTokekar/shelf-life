import type { PantryItem } from '@shelf-life/shared';
import { addItems, readItems } from '@shelf-life/docs';
import { describe, expect, it } from 'vitest';
import { getDoc, pantryDocName, resetDocsForTests } from './docs';

const base: PantryItem = {
  id: 'a',
  pantryId: 'p',
  listId: 'home',
  foodId: null,
  name: 'Spinach',
  category: 'produce',
  location: 'fridge',
  quantity: 1,
  unit: 'bag',
  note: '',
  purchasedOn: '2026-09-25',
  expiresOn: '2026-09-28',
  expiryIsEstimate: false,
  expirySource: 'user',
  status: 'active',
  outAt: null,
  addedBy: 'u1',
  receiptLineId: null,
  updatedAt: '2026-09-28T00:00:00.000Z',
};

describe('docs (y-indexeddb)', () => {
  it('SRS 8.7 items survive closing and reopening the pantry doc', async () => {
    const name = pantryDocName('persist-test');
    const first = getDoc(name);
    await first.ready;
    addItems(first.doc, [base]);
    // Give y-indexeddb a moment to write the update.
    await new Promise((r) => setTimeout(r, 50));
    resetDocsForTests();

    const reopened = getDoc(name);
    await reopened.ready;
    expect(readItems(reopened.doc)).toEqual([base]);
  });

  it('shares one doc per name for the session', () => {
    expect(getDoc(pantryDocName('x'))).toBe(getDoc(pantryDocName('x')));
  });
});
