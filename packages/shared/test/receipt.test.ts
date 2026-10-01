import { describe, expect, it } from 'vitest';
import {
  addDays,
  ALL_RECEIPTS,
  applyAiCleanup,
  applyAiShelfLife,
  linesForAi,
  commitReview,
  confirmItem,
  draftFromParsed,
  draftFromReceipt,
  editItem,
  filterReceipts,
  groupReceipts,
  itemFromSkippedLine,
  lineCaption,
  matchesQuery,
  needsLook,
  parseReceipt,
  receiptFilterCounts,
  receiptSchema,
  receiptStatus,
  rematchDraft,
  restoreSkipped,
  reviewCounts,
  toggleItem,
  type PantryItem,
  type Receipt,
  type ReviewDraft,
} from '../src';
import { asOcr, COSTCO, PATEL_BROTHERS, TARGET } from './fixtures/receipts';

const TODAY = '2026-09-28';
const NOW = '2026-09-28T18:41:00.000Z';
const ctx = { pantryId: 'p1', userId: 'u1', now: NOW };

function patelDraft(confidence = 0.95): ReviewDraft {
  return draftFromParsed(parseReceipt(asOcr(PATEL_BROTHERS, confidence), TODAY), 'home');
}
const itemByRaw = (d: ReviewDraft, fragment: string) =>
  d.items.find((i) => i.raw.includes(fragment))!;

describe('SRS 8.2 receipt total', () => {
  it('reads the TOTAL line, not the subtotal or the card line', () => {
    expect(parseReceipt(asOcr(PATEL_BROTHERS), TODAY).total).toBe(48.88);
    expect(parseReceipt(asOcr(COSTCO), TODAY).total).toBe(52.39);
  });

  it('is null when there is only a subtotal', () => {
    expect(parseReceipt(asOcr('PATEL BROTHERS\nMILK 4.29\nSUBTOTAL 4.29'), TODAY).total).toBeNull();
  });
});

describe('REV-1..REV-6 review draft', () => {
  it('REV-1 carries store, date, line count and total; REV-6 defaults to the given list', () => {
    const d = patelDraft();
    expect(d).toMatchObject({
      storeName: 'Patel Brothers',
      purchasedOn: '2026-09-27',
      total: 48.88,
      listId: 'home',
      receiptId: null,
    });
    expect(d.lineCount).toBeGreaterThan(d.items.length);
  });

  it('REV-3 every item starts ticked; REV-2 counts matched / need a look / skipped', () => {
    const d = patelDraft();
    expect(d.items.every((i) => i.included)).toBe(true);
    const c = reviewCounts(d);
    expect(c.matched + c.needsLook).toBe(d.items.length);
    expect(c.skipped).toBe(d.skipped.length);
    expect(c.checked).toBe(d.items.length);
  });

  it('REV-4 blurry lines need a look until confirmed', () => {
    const d = patelDraft(0.55);
    const milk = itemByRaw(d, 'GV WHL MLK');
    expect(needsLook(milk)).toBe(true);
    const confirmed = confirmItem(d, milk.index);
    expect(needsLook(itemByRaw(confirmed, 'GV WHL MLK'))).toBe(false);
    expect(reviewCounts(confirmed).needsLook).toBe(reviewCounts(d).needsLook - 1);
  });

  it('REV-3 unticking lowers the count and marks the line edited', () => {
    const d = patelDraft();
    const next = toggleItem(d, d.items[0]!.index);
    expect(reviewCounts(next).checked).toBe(d.items.length - 1);
    expect(next.items[0]).toMatchObject({ included: false, edited: true });
  });

  it('editing re-matches a new name, confirms it, and keeps an untouched estimate', () => {
    const d = patelDraft(0.55);
    const milk = itemByRaw(d, 'GV WHL MLK');
    const form = {
      name: 'Paneer',
      quantity: 2,
      unit: 'pack',
      category: milk.category,
      location: milk.location,
      expiresOn: milk.expiresOn,
      note: '',
    };
    const renamed = itemByRaw(editItem(d, milk.index, form, true), 'GV WHL MLK');
    expect(renamed).toMatchObject({
      name: 'Paneer',
      foodId: 'paneer',
      quantity: 2,
      confirmed: true,
      edited: true,
      expirySource: milk.expirySource,
    });
    const dated = itemByRaw(
      editItem(d, milk.index, { ...form, name: milk.name, expiresOn: '2026-10-30' }, false),
      'GV WHL MLK',
    );
    expect(dated).toMatchObject({ expirySource: 'user', foodId: milk.foodId });
    const moved = itemByRaw(
      editItem(d, milk.index, { ...form, name: milk.name, location: 'freezer' }, true),
      'GV WHL MLK',
    );
    expect(moved.expirySource).toBe('category_default');
  });

  it('REV-5 restores a skipped line as a ticked item', () => {
    const d = draftFromParsed(
      parseReceipt(asOcr('PATEL BROTHERS\nPAPER TOWELS 5.99\nMILK 4.29\nTOTAL 10.28'), TODAY),
      'home',
    );
    const towels = d.skipped.find((s) => s.raw.includes('PAPER TOWELS'))!;
    expect(towels.reason).toBe('not_food');
    const next = restoreSkipped(d, towels.index);
    expect(next.skipped.some((s) => s.index === towels.index)).toBe(false);
    const restored = next.items.find((i) => i.index === towels.index)!;
    expect(restored).toMatchObject({ included: true, edited: true, price: 5.99 });
    expect(next.items.map((i) => i.index)).toEqual(
      [...next.items.map((i) => i.index)].sort((a, b) => a - b),
    );
    expect(restoreSkipped(d, 999)).toBe(d);
  });

  it('a restored line that matches poorly still needs a look', () => {
    const item = itemFromSkippedLine('TOTAL 10.28', 3, TODAY);
    expect(item).toMatchObject({ index: 3, price: 10.28, status: 'needs_look' });
    expect(item.name.length).toBeGreaterThan(0);
  });
});

describe('REV-7 commit', () => {
  it('writes one pantry item per ticked line, all with the receipt date and list label', () => {
    let d = patelDraft();
    d = toggleItem(d, d.items[0]!.index);
    const { receipt, add, update, remove } = commitReview(d, ctx);
    expect(add).toHaveLength(d.items.length - 1);
    expect(update).toEqual([]);
    expect(remove).toEqual([]);
    for (const item of add) {
      expect(item).toMatchObject({
        pantryId: 'p1',
        listId: 'home',
        purchasedOn: '2026-09-27',
        status: 'active',
        addedBy: 'u1',
        expiryIsEstimate: true,
      });
      expect(item.receiptLineId).toMatch(new RegExp(`^${receipt.id}:\\d+$`));
    }
    expect(() => receiptSchema.parse(receipt)).not.toThrow();
    expect(receipt).toMatchObject({
      storeName: 'Patel Brothers',
      total: 48.88,
      scannedBy: 'u1',
      itemsAdded: add.length,
      reviewState: 'edited',
      createdAt: NOW,
    });
    expect(receipt.lines).toHaveLength(d.items.length + d.skipped.length);
    const unticked = receipt.lines.find((l) => l.index === d.items[0]!.index)!;
    expect(unticked).toMatchObject({ kind: 'item', pantryItemId: null, edited: true });
    expect(receipt.lines.filter((l) => l.kind === 'skipped').every((l) => l.skipReason)).toBe(true);
  });

  it('SEC-5 the record holds text lines only', () => {
    const { receipt } = commitReview(patelDraft(), ctx);
    const json = JSON.stringify(receipt);
    expect(json).not.toMatch(/data:image|blob:|base64/i);
    expect(Object.keys(receipt.lines[0]!).sort()).toEqual(
      [
        'confidence',
        'confirmed',
        'edited',
        'id',
        'index',
        'kind',
        'matchName',
        'matchSource',
        'pantryItemId',
        'price',
        'rawText',
        'skipReason',
      ].sort(),
    );
  });

  it('is clean when nothing was touched and needs review when an unsure line was added unconfirmed', () => {
    expect(commitReview(patelDraft(), ctx).receipt.reviewState).toBe('clean');
    const blurry = commitReview(patelDraft(0.55), ctx).receipt;
    expect(blurry.reviewState).toBe('needs_review');
    expect(receiptStatus(blurry).unresolved).toBeGreaterThan(0);
  });

  it('a user-set date is not an estimate', () => {
    const d = patelDraft();
    const first = d.items[0]!;
    const edited = editItem(
      d,
      first.index,
      { ...first, quantity: first.quantity, expiresOn: '2026-12-01' },
      false,
    );
    const item = commitReview(edited, ctx).add.find((i) =>
      i.receiptLineId?.endsWith(`:${first.index}`),
    )!;
    expect(item).toMatchObject({
      expiresOn: '2026-12-01',
      expiryIsEstimate: false,
      expirySource: 'user',
    });
  });
});

describe('HIS-5 edit items', () => {
  function saved() {
    const first = commitReview(patelDraft(0.55), ctx);
    return { ...first, pantry: first.add as PantryItem[] };
  }

  it('rebuilds the draft from the receipt and the current pantry items', () => {
    const { receipt, pantry } = saved();
    const renamed = pantry.map((p, i) => (i === 0 ? { ...p, name: 'Renamed in pantry' } : p));
    const d = draftFromReceipt(receipt, renamed);
    expect(d.receiptId).toBe(receipt.id);
    expect(d.createdAt).toBe(NOW);
    expect(d.items).toHaveLength(pantry.length);
    expect(d.items[0]).toMatchObject({ name: 'Renamed in pantry', included: true });
    expect(d.skipped).toHaveLength(receipt.lines.filter((l) => l.kind === 'skipped').length);
  });

  it('updates kept items, removes unticked ones and re-adds lines whose item was deleted', () => {
    const { receipt, pantry } = saved();
    let d = draftFromReceipt(receipt, pantry.slice(1)); // item 0 was deleted from the pantry
    expect(d.items[0]!.included).toBe(false);
    d = toggleItem(d, d.items[0]!.index); // tick it again → re-added
    d = toggleItem(d, d.items[1]!.index); // untick → removed
    d = { ...d, listId: 'roommates' };
    const later = '2026-09-29T09:00:00.000Z';
    const out = commitReview(d, {
      ...ctx,
      userId: 'u2',
      now: later,
      pantry: pantry.slice(1),
      scannedBy: 'u1',
    });
    expect(out.receipt.id).toBe(receipt.id);
    expect(out.receipt).toMatchObject({ scannedBy: 'u1', createdAt: NOW, updatedAt: later });
    expect(out.add).toHaveLength(1);
    expect(out.remove).toEqual([pantry[1]!.id]);
    expect(out.update).toHaveLength(pantry.length - 2);
    expect(out.update.every((u) => u.patch.listId === 'roommates')).toBe(true);
  });

  it('confirming every unsure line clears "needs review"', () => {
    const { receipt, pantry } = saved();
    let d = draftFromReceipt(receipt, pantry);
    for (const item of d.items.filter(needsLook)) d = confirmItem(d, item.index);
    expect(commitReview(d, { ...ctx, pantry }).receipt.reviewState).not.toBe('needs_review');
  });

  it('matches lines that were not added again from their text', () => {
    const { receipt } = saved();
    const d = draftFromReceipt(receipt, []);
    const milk = d.items.find((i) => i.raw.includes('GV WHL MLK'))!;
    expect(milk).toMatchObject({ foodId: 'milk', included: false });
  });

  it('re-run matching updates untouched lines only', () => {
    const d = patelDraft();
    const stale: ReviewDraft = {
      ...d,
      items: d.items.map((i, n) =>
        n === 0
          ? { ...i, foodId: null, name: 'Mystery', confidence: 0.3, unsure: true }
          : n === 1
            ? { ...i, foodId: null, name: 'Mine', edited: true }
            : i,
      ),
    };
    const fresh = rematchDraft(stale);
    expect(fresh.items[0]!.foodId).toBe(d.items[0]!.foodId);
    expect(fresh.items[0]!.unsure).toBe(false);
    expect(fresh.items[1]!.name).toBe('Mine');
  });
});

describe('HIS-1..HIS-3, HIS-7 history', () => {
  function receipt(over: Partial<Receipt> & { id: string }): Receipt {
    const base = commitReview(patelDraft(), ctx).receipt;
    return { ...base, ...over };
  }
  const receipts = [
    receipt({ id: 'a', storeName: 'Patel Brothers', purchasedOn: '2026-09-24' }),
    receipt({ id: 'b', storeName: 'Costco', purchasedOn: '2026-09-20', scannedBy: 'u2' }),
    receipt({
      id: 'c',
      storeName: 'Trader Joe’s',
      purchasedOn: '2026-09-28',
      reviewState: 'needs_review',
    }),
    receipt({ id: 'd', storeName: 'H Mart', purchasedOn: '2026-08-30' }),
  ];

  it('HIS-1 searches store names and item names', () => {
    expect(matchesQuery(receipts[1]!, 'cost')).toBe(true);
    expect(matchesQuery(receipts[1]!, 'paneer')).toBe(true); // matched item name
    expect(matchesQuery(receipts[1]!, 'toor dal 4lb')).toBe(true); // raw line
    expect(matchesQuery(receipts[1]!, 'kimchi')).toBe(false);
    expect(
      filterReceipts(receipts, { ...ALL_RECEIPTS, query: 'mart' }, TODAY).map((r) => r.id),
    ).toEqual(['d']);
  });

  it('HIS-1 filters: needs review, this month, scanned by', () => {
    const ids = (f: Parameters<typeof filterReceipts>[1]) =>
      filterReceipts(receipts, f, TODAY).map((r) => r.id);
    expect(ids(ALL_RECEIPTS)).toEqual(['c', 'a', 'b', 'd']);
    expect(ids({ ...ALL_RECEIPTS, filter: 'review' })).toEqual(['c']);
    expect(ids({ ...ALL_RECEIPTS, filter: 'month' })).toEqual(['c', 'a', 'b']);
    expect(ids({ ...ALL_RECEIPTS, scannedBy: 'u2' })).toEqual(['b']);
    expect(receiptFilterCounts(receipts, { query: '', scannedBy: null }, TODAY)).toEqual({
      all: 4,
      review: 1,
      month: 3,
    });
  });

  it('HIS-2 + HIS-3 needs-review first, then by month; HIS-7 pages the rest', () => {
    const sorted = filterReceipts(receipts, ALL_RECEIPTS, TODAY);
    const g = groupReceipts(sorted);
    expect(g.needsReview.map((r) => r.id)).toEqual(['c']);
    expect(g.months.map((m) => [m.month, m.receipts.map((r) => r.id)])).toEqual([
      ['2026-09', ['a', 'b']],
      ['2026-08', ['d']],
    ]);
    expect(g.hidden).toBe(0);
    const paged = groupReceipts(sorted, 2);
    expect(paged.months.flatMap((m) => m.receipts)).toHaveLength(2);
    expect(paged.hidden).toBe(1);
  });

  it('HIS-3 status chip numbers', () => {
    let d = patelDraft();
    d = toggleItem(d, d.items[0]!.index);
    d = toggleItem(d, d.items[1]!.index);
    expect(receiptStatus(commitReview(d, ctx).receipt)).toEqual({
      state: 'edited',
      unresolved: 0,
      edited: 2,
    });
  });

  it('works on other store formats too', () => {
    const d = draftFromParsed(parseReceipt(asOcr(TARGET), TODAY), 'home');
    expect(commitReview(d, ctx).add.length).toBe(d.items.length);
  });
});

describe('lineCaption', () => {
  it.each([
    ['TOOR DAL 4LB      8.99', 'TOOR DAL 4LB'],
    ['E 1234567 KS ORG EGGS 24CT 9.99 E', 'E 1234567 KS ORG EGGS 24CT'],
    ['COUPON 3.00-', 'COUPON'],
    ['CILANTRO', 'CILANTRO'],
    ['4.99', '4.99'],
  ])('%s → %s', (raw, caption) => expect(lineCaption(raw)).toBe(caption));
});

describe('SRS 9.2 AI cleanup on the review draft', () => {
  // Two lines the dictionary can't read (confidence < 0.5) and one it can.
  const blurry = () =>
    draftFromParsed(
      parseReceipt(
        asOcr('PATEL BROTHERS\nTOOR DAL 4LB 8.99\nXQ BRKT 2.00\nZZPN WHL 3.00', 0.6),
        TODAY,
      ),
      'home',
    );

  it('picks only untouched lines under 0.5 confidence, and only once', () => {
    const d = blurry();
    expect(linesForAi(d).map((i) => i.raw)).toEqual(['XQ BRKT 2.00', 'ZZPN WHL 3.00']);
    expect(linesForAi({ ...d, aiChecked: true })).toEqual([]);
    const touched = toggleItem(d, d.items[1]!.index);
    expect(linesForAi(touched).map((i) => i.raw)).toEqual(['ZZPN WHL 3.00']);
  });

  it('applies AI names: dictionary foods get their shelf life, others the category default', () => {
    const d = blurry();
    const next = applyAiCleanup(d, [
      {
        raw: 'XQ BRKT 2.00',
        name: 'Yuzu kosho',
        category: 'other',
        location: 'fridge',
        confidence: 0.6,
      },
      {
        raw: 'ZZPN WHL 3.00',
        name: 'Whole milk',
        category: 'dairy_eggs',
        location: 'fridge',
        confidence: 0.92,
      },
      {
        raw: 'TOOR DAL 4LB 8.99',
        name: null,
        category: 'other',
        location: 'cupboard',
        confidence: 0.9,
      },
    ]);
    expect(next.aiChecked).toBe(true);
    const [dal, brisket, milk] = next.items;
    expect(milk).toMatchObject({
      name: 'Milk',
      foodId: 'milk',
      matchSource: 'ai',
      unsure: true,
      confidence: 0.92,
      expirySource: 'dictionary',
    });
    expect(brisket).toMatchObject({
      name: 'Yuzu kosho',
      foodId: null,
      category: 'other',
      location: 'fridge',
      expirySource: 'category_default',
      matchSource: 'ai',
    });
    // "Not food" from AI leaves the line as the parser had it.
    expect(dal).toEqual(d.items[0]);
    const estimated = applyAiShelfLife(next, brisket!.index, 4);
    expect(estimated.items[1]).toMatchObject({
      expirySource: 'ai',
      expiresOn: addDays(d.purchasedOn, 4),
    });
    // Only replaces a category default, never a dictionary or user date.
    expect(applyAiShelfLife(next, milk!.index, 99).items[2]).toEqual(milk);
  });

  it('REV-4 an AI match still needs confirming, and the receipt records it as AI', () => {
    const d = applyAiCleanup(blurry(), [
      {
        raw: 'ZZPN WHL 3.00',
        name: 'Whole milk',
        category: 'dairy_eggs',
        location: 'fridge',
        confidence: 0.92,
      },
    ]);
    const milk = d.items.find((i) => i.raw.startsWith('ZZPN'))!;
    expect(needsLook(milk)).toBe(true);
    const line = commitReview(confirmItem(d, milk.index), ctx).receipt.lines.find((l) =>
      l.rawText.startsWith('ZZPN'),
    )!;
    expect(line).toMatchObject({ matchSource: 'ai', confirmed: true });
  });
});
