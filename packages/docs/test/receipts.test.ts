import {
  commitReview,
  draftFromParsed,
  draftFromReceipt,
  parseReceipt,
  toggleItem,
} from '@shelf-life/shared';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { applyReview, deleteReceipt, putReceipt, readActivity, readItems, readReceipt, readReceipts, receiptsMap } from '../src';

const TEXT = `PATEL BROTHERS
09/27/26 14:32
TOOR DAL 4LB 8.99
PANEER 400G 5.49
CILANTRO 0.99
TAX 1.23
TOTAL 16.70`;
const lines = TEXT.split('\n').map((text) => ({ text, confidence: 0.95 }));
const ctx = { pantryId: 'p', userId: 'u1', now: '2026-09-28T10:00:00.000Z' };
const draft = () => draftFromParsed(parseReceipt(lines, '2026-09-28'), 'home');

describe('receiptStore (SRS 8.7 receipts map)', () => {
  it('REV-7 writes items, the receipt and activity in one transaction', () => {
    const doc = new Y.Doc();
    let updates = 0;
    doc.on('update', () => updates++);
    const commit = commitReview(draft(), ctx);
    const activity = {
      id: 'act',
      pantryId: 'p',
      listId: 'home',
      actorId: 'u1',
      type: 'scanned' as const,
      subject: 'Patel Brothers',
      itemId: null,
      beforeExpiry: null,
      createdAt: ctx.now,
    };
    applyReview(doc, commit, [activity]);
    expect(updates).toBe(1);
    expect(readItems(doc)).toHaveLength(3);
    expect(readReceipts(doc)).toEqual([commit.receipt]);
    expect(readActivity(doc).map((a) => a.type)).toEqual(['scanned']);
  });

  it('HIS-5 edit applies updates and removals to the same receipt', () => {
    const doc = new Y.Doc();
    const first = commitReview(draft(), ctx);
    applyReview(doc, first);
    let d = draftFromReceipt(first.receipt, readItems(doc));
    d = toggleItem(d, d.items[0]!.index);
    d = { ...d, listId: 'roommates' };
    applyReview(doc, commitReview(d, { ...ctx, pantry: readItems(doc) }));
    expect(readItems(doc)).toHaveLength(2);
    expect(readItems(doc).every((i) => i.listId === 'roommates')).toBe(true);
    expect(readReceipts(doc)).toHaveLength(1);
    expect(readReceipt(doc, first.receipt.id)!.reviewState).toBe('edited');
  });

  it('HIS-5 delete removes the record but keeps the pantry items', () => {
    const doc = new Y.Doc();
    const commit = commitReview(draft(), ctx);
    applyReview(doc, commit);
    const before = deleteReceipt(doc, commit.receipt.id);
    expect(before?.id).toBe(commit.receipt.id);
    expect(readReceipts(doc)).toEqual([]);
    expect(readItems(doc)).toHaveLength(3);
    expect(deleteReceipt(doc, 'missing')).toBeNull();
    putReceipt(doc, before!);
    expect(readReceipts(doc)).toHaveLength(1);
  });

  it('ignores malformed entries from other devices', () => {
    const doc = new Y.Doc();
    receiptsMap(doc).set('bad', { id: 'bad' } as never);
    expect(readReceipts(doc)).toEqual([]);
    expect(readReceipt(doc, 'bad')).toBeNull();
  });
});
