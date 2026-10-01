import type { PantryItem } from '@shelf-life/shared';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { addListItem, openEntryFor, readListItems, removeListItem } from '../src';
import {
  addItems,
  readActivity,
  readItem,
  readItems,
  recordActivity,
  removeActivity,
  removeItem,
  restoreItem,
  updateItem,
} from '../src';

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

describe('pantryStore (SRS 8.7 pantry map)', () => {
  it('adds, reads, updates and restores items', () => {
    const doc = new Y.Doc();
    addItems(doc, [base]);
    expect(readItems(doc)).toEqual([base]);

    const before = updateItem(doc, 'a', { quantity: 0, status: 'out', outAt: '2026-09-28' });
    expect(before).toEqual(base);
    expect(readItem(doc, 'a')).toMatchObject({ quantity: 0, status: 'out' });

    restoreItem(doc, before!);
    expect(readItem(doc, 'a')).toMatchObject({ quantity: 1, status: 'active', outAt: null });
  });

  it('delete returns the item and Undo puts it back', () => {
    const doc = new Y.Doc();
    addItems(doc, [base]);
    const removed = removeItem(doc, 'a');
    expect(readItems(doc)).toEqual([]);
    restoreItem(doc, removed!);
    expect(readItems(doc)).toEqual([base]);
  });

  it('rejects invalid writes instead of storing them', () => {
    const doc = new Y.Doc();
    addItems(doc, [base]);
    expect(() => updateItem(doc, 'a', { name: '' })).toThrow();
    expect(readItem(doc, 'a')!.name).toBe('Spinach');
    expect(updateItem(doc, 'missing', { name: 'x' })).toBeNull();
  });

  it('SRS 8.7 two devices editing different fields of one item both keep their change', () => {
    const phone = new Y.Doc();
    const laptop = new Y.Doc();
    addItems(phone, [base]);
    Y.applyUpdate(laptop, Y.encodeStateAsUpdate(phone));

    updateItem(phone, 'a', { note: 'for palak paneer' });
    updateItem(laptop, 'a', { location: 'freezer' });
    Y.applyUpdate(laptop, Y.encodeStateAsUpdate(phone));
    Y.applyUpdate(phone, Y.encodeStateAsUpdate(laptop));

    for (const doc of [phone, laptop]) {
      expect(readItem(doc, 'a')).toMatchObject({ note: 'for palak paneer', location: 'freezer' });
    }
  });
});

describe('listStore (PAN-9)', () => {
  it('adds a ran-out item to a list and finds the open entry', () => {
    const doc = new Y.Doc();
    addListItem(doc, {
      id: 'e1',
      listId: 'home',
      name: 'Eggs',
      quantity: null,
      unit: '',
      note: '',
      reason: 'ran_out',
      recipeId: null,
      pantryItemId: 'a',
      addedBy: 'u1',
      claimedBy: 'u2',
      checked: false,
      checkedBy: null,
      checkedAt: null,
      createdAt: '2026-09-28T00:00:00.000Z',
    });
    const items = readListItems(doc);
    expect(openEntryFor(items, 'a')).toMatchObject({ id: 'e1', claimedBy: 'u2' });
    expect(openEntryFor(items, 'other')).toBeUndefined();
    removeListItem(doc, 'e1');
    expect(readListItems(doc)).toEqual([]);
  });
});

describe('activity (SRS 8.7)', () => {
  it('records entries in order and removes them for Undo', () => {
    const doc = new Y.Doc();
    const entry = (id: string, type: 'used' | 'ran_out', createdAt: string) => ({
      id,
      pantryId: 'p',
      listId: 'home',
      actorId: 'u1',
      type,
      subject: 'Spinach',
      itemId: 'a',
      beforeExpiry: type === 'used' ? true : null,
      createdAt,
    });
    recordActivity(doc, [
      entry('b', 'ran_out', '2026-09-28T10:00:01Z'),
      entry('a', 'used', '2026-09-28T10:00:00Z'),
    ]);
    expect(readActivity(doc).map((e) => [e.id, e.type])).toEqual([
      ['a', 'used'],
      ['b', 'ran_out'],
    ]);
    removeActivity(doc, ['a', 'b']);
    expect(readActivity(doc)).toEqual([]);
  });

  it('rejects malformed entries', () => {
    const doc = new Y.Doc();
    expect(() => recordActivity(doc, [{ id: '' } as never])).toThrow();
  });
});
