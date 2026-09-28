import { describe, expect, it } from 'vitest';
import {
  addDays,
  classifyLine,
  combineConfidence,
  confidenceBand,
  displayName,
  expandReceiptText,
  findStore,
  fixOcrDigits,
  isNonFood,
  matchFood,
  matchKey,
  parseDate,
  parsePrice,
  parseReceipt,
  type ParsedReceipt,
} from '../src';
import { asOcr, COSTCO, H_MART, PATEL_BROTHERS, TARGET, TRADER_JOES } from './fixtures/receipts';

const TODAY = '2026-09-28';
const byRaw = (r: ParsedReceipt, fragment: string) => r.items.find((i) => i.raw.includes(fragment));
const foods = (r: ParsedReceipt) => r.items.map((i) => i.foodId);

describe('SRS 8.2 step 3 normalize', () => {
  it('expands abbreviations and drops store brands', () => {
    expect(expandReceiptText('GV WHL MLK')).toBe('whole milk');
    expect(expandReceiptText('GRK YOGURT')).toBe('greek yogurt');
    expect(expandReceiptText('KS ORG BNNA')).toBe('organic banana');
    expect(expandReceiptText("TRADER JOE'S BABY SPINACH")).toBe('baby spinach');
    expect(expandReceiptText('365 BNLS CHKN BRST')).toBe('boneless chicken breast');
  });

  it('fixes OCR digit slips inside words but not sizes', () => {
    expect(fixOcrDigits('cilantr0')).toBe('cilantro');
    expect(fixOcrDigits('400g')).toBe('400g');
    expect(fixOcrDigits('2%')).toBe('2%');
    expect(expandReceiptText('SP1NACH')).toBe('splnach');
  });

  it('match key drops sizes and modifiers; display name is title case', () => {
    expect(matchKey('toor dal 4lb')).toBe('toor dal');
    expect(matchKey('organic baby spinach 5oz bag')).toBe('baby spinach');
    expect(displayName('mandarin orange chicken')).toBe('Mandarin Orange Chicken');
  });
});

describe('SRS 8.2 steps 1–2 lines', () => {
  const store = (s: string) => findStore(s) !== null;

  it('reads prices, including discounts and trailing tax flags', () => {
    expect(parsePrice('TOOR DAL 4LB      8.99')).toBe(8.99);
    expect(parsePrice('BANANAS   1.99 E')).toBe(1.99);
    expect(parsePrice('1234 /512345  3.00-')).toBe(-3);
    expect(parsePrice('THANK YOU')).toBeNull();
  });

  it('reads US dates in several formats', () => {
    expect(parseDate('09/27/26 14:32')).toBe('2026-09-27');
    expect(parseDate('09-25-2026 12:44PM')).toBe('2026-09-25');
    expect(parseDate('2026-09-20')).toBe('2026-09-20');
    expect(parseDate('13/45/2026')).toBeNull();
  });

  it.each([
    ['PANEER 400G       5.49', 'item'],
    ['SUBTOTAL         47.65', 'total'],
    ['TAX               1.23', 'tax'],
    ['VISA ****1234    48.88', 'payment'],
    ['  2.37 lb @ 1.49 /lb', 'weight'],
    ['  3 @ 0.29', 'weight'],
    ['INSTANT SAVINGS  2.00', 'discount'],
    ['1234 DEVON AVE', 'other'],
    ['THANK YOU', 'other'],
    ['(312) 555-0199', 'other'],
  ])('classifies "%s" as %s', (line, kind) => {
    expect(classifyLine(line, 0, false, store).kind).toBe(kind);
  });

  it('extracts size and strips item codes and tax flags', () => {
    const c = classifyLine('E 1234567 KS ORG EGGS 24CT      9.99 E', 0, false, store);
    expect(c).toMatchObject({
      kind: 'item',
      text: 'KS ORG EGGS 24CT',
      quantity: 24,
      unit: 'ct',
      price: 9.99,
    });
    expect(classifyLine('212040123 GG LARGE EGGS 12CT  NF  2.99', 0, false, store).text).toBe(
      'GG LARGE EGGS 12CT',
    );
  });

  it('recognizes store names in the header', () => {
    expect(findStore("TRADER JOE'S")).toBe("Trader Joe's");
    expect(findStore('COSTCO WHOLESALE')).toBe('Costco');
    expect(findStore('H MART')).toBe('H Mart');
    expect(findStore('PATEL BROS')).toBe('Patel Brothers');
    expect(findStore('CORNER DELI')).toBeNull();
  });
});

describe('SRS 8.2 step 4 matching', () => {
  it('exact aliases, Hindi names and receipt spellings', () => {
    expect(matchFood('whole milk')?.food.foodId).toBe('milk');
    expect(matchFood('palak')?.food.foodId).toBe('spinach');
    expect(matchFood('toor dal')).toMatchObject({ score: 1, food: { foodId: 'toor-dal' } });
    expect(matchFood('dhania')?.food.foodId).toBe('cilantro');
  });

  it('matches words in any order and ignores weak words', () => {
    expect(matchFood('tortillas flour')).toMatchObject({
      via: 'words',
      food: { foodId: 'tortillas' },
    });
    expect(matchFood('greek nonfat yogurt')?.food.foodId).toBe('greek-yogurt');
    expect(matchFood('carrots whole')?.food.foodId).toBe('carrot');
    expect(matchFood('greek nonfat yogurt')!.score).toBeGreaterThanOrEqual(0.8);
  });

  it('is unsure (not "matched") when several foods explain a small part of the line', () => {
    const m = matchFood('mandarin orange chicken')!;
    expect(m.score).toBeLessThan(0.8);
  });

  it('fuzzy matches typos but never counts them as certain', () => {
    const m = matchFood('spinnach')!;
    expect(m.food.foodId).toBe('spinach');
    expect(m.via).toBe('fuzzy');
    expect(m.score).toBeLessThan(0.86);
    expect(matchFood('x')).toBeNull();
  });

  it('SRS 8.2 step 6 knows common non-food lines', () => {
    expect(isNonFood('toilet paper 30rl')).toBe(true);
    expect(isNonFood('paper towel 6pk')).toBe(true);
    expect(isNonFood('bag fee')).toBe(true);
    expect(isNonFood('baby spinach')).toBe(false);
  });

  it('SRS 8.2 step 5 combines OCR and match confidence into bands', () => {
    expect(combineConfidence(0.95, 1)).toBe(0.98);
    expect(combineConfidence(0.4, 0.9)).toBe(0.63);
    expect(confidenceBand(0.8)).toBe('matched');
    expect(confidenceBand(0.79)).toBe('needs_look');
    expect(confidenceBand(0.49)).toBe('needs_ai');
  });
});

describe('parseReceipt: five store formats', () => {
  it('Patel Brothers (Figma 04): 8 groceries, all matched, sizes read, totals skipped', () => {
    const r = parseReceipt(asOcr(PATEL_BROTHERS), TODAY);
    expect(r.store).toBe('Patel Brothers');
    expect(r.receiptDate).toBe('2026-09-27');
    expect(r.purchasedOn).toBe('2026-09-27');
    expect(foods(r)).toEqual([
      'toor-dal',
      'milk',
      'paneer',
      'cilantro',
      'spinach',
      'greek-yogurt',
      'atta',
      'tomato',
    ]);
    expect(r.items.every((i) => i.status === 'matched')).toBe(true);
    expect(byRaw(r, 'TOOR DAL')).toMatchObject({
      quantity: 4,
      unit: 'lb',
      price: 8.99,
      category: 'grains_dals',
      location: 'cupboard',
    });
    expect(byRaw(r, 'PANEER')).toMatchObject({
      quantity: 400,
      unit: 'g',
      name: 'Paneer',
      location: 'fridge',
    });
    expect(r.skipped.map((s) => s.reason)).toEqual(
      expect.arrayContaining(['store_info', 'total', 'tax', 'payment', 'other']),
    );
    expect(r.lineCount).toBe(17);
  });

  it('SRS 8.3 expiry = purchase date + dictionary shelf life for the location', () => {
    const r = parseReceipt(asOcr(PATEL_BROTHERS), TODAY);
    expect(byRaw(r, 'PANEER')).toMatchObject({
      expiresOn: addDays('2026-09-27', 7),
      expirySource: 'dictionary',
    });
    expect(byRaw(r, 'GV WHL MLK')).toMatchObject({ expiresOn: addDays('2026-09-27', 7) });
    expect(byRaw(r, 'SPINACH')).toMatchObject({ expiresOn: addDays('2026-09-27', 5) });
    expect(byRaw(r, 'GRK YOGURT')).toMatchObject({ expiresOn: addDays('2026-09-27', 14) });
    expect(byRaw(r, 'TOOR DAL')).toMatchObject({ expiresOn: addDays('2026-09-27', 365) });
  });

  it('Costco: item codes, KS brand, toilet paper skipped as not food, discount skipped', () => {
    const r = parseReceipt(asOcr(COSTCO), TODAY);
    expect(r.store).toBe('Costco');
    expect(foods(r)).toEqual(['eggs', 'milk', 'banana', 'rotisserie-chicken', 'avocado']);
    expect(byRaw(r, 'EGGS')).toMatchObject({ quantity: 24, unit: 'ct' });
    expect(r.skipped.find((s) => s.raw.includes('TP 30RL'))?.reason).toBe('not_food');
    expect(r.skipped.find((s) => s.raw.includes('3.00-'))?.reason).toBe('discount');
  });

  it("Trader Joe's: word order, weak words, multi-buy line, and an honest 'needs a look'", () => {
    const r = parseReceipt(asOcr(TRADER_JOES), TODAY);
    expect(r.store).toBe("Trader Joe's");
    expect(byRaw(r, 'BANANAS')).toMatchObject({ foodId: 'banana', quantity: 3 });
    expect(byRaw(r, 'BABY SPINACH')?.foodId).toBe('spinach');
    expect(byRaw(r, 'GREEK NONFAT')?.foodId).toBe('greek-yogurt');
    expect(byRaw(r, 'TORTILLAS FLOUR')?.foodId).toBe('tortillas');
    expect(byRaw(r, 'CARROTS')).toMatchObject({ foodId: 'carrot', quantity: 2, unit: 'lb' });
    expect(byRaw(r, 'MANDARIN ORANGE CHICKEN')?.status).toBe('needs_look');
  });

  it('Target: department headers ignored, NF flags stripped, paper towels skipped', () => {
    const r = parseReceipt(asOcr(TARGET), TODAY);
    expect(r.store).toBe('Target');
    expect(foods(r)).toEqual(['milk', 'eggs', 'avocado', 'shredded-cheese']);
    expect(byRaw(r, 'PAPER TOWEL')).toBeUndefined();
    expect(r.skipped.find((s) => s.raw.includes('PAPER TOWEL'))?.reason).toBe('not_food');
    expect(r.skipped.find((s) => s.raw.includes('CA TAX'))?.reason).toBe('tax');
  });

  it('H Mart: weight line attaches to the item above; brands dropped', () => {
    const r = parseReceipt(asOcr(H_MART), TODAY);
    expect(r.store).toBe('H Mart');
    expect(byRaw(r, 'NAPA CABBAGE')).toMatchObject({
      foodId: 'cabbage',
      quantity: 2.37,
      unit: 'lb',
    });
    expect(byRaw(r, 'BIBIGO MANDU')?.foodId).toBe('frozen-dumplings');
    expect(byRaw(r, 'SHIN RAMYUN')?.foodId).toBe('noodles');
    expect(byRaw(r, 'TOFU')?.foodId).toBe('tofu');
    expect(byRaw(r, 'ENOKI')?.foodId).toBe('mushroom');
    expect(byRaw(r, 'KIMCHI')).toMatchObject({ foodId: 'kimchi', quantity: 1.5, unit: 'lb' });
  });

  it('low OCR confidence lowers the band even when the name matches', () => {
    const r = parseReceipt(asOcr(PATEL_BROTHERS, 0.3), TODAY);
    expect(byRaw(r, 'PANEER')?.status).toBe('needs_look');
  });

  it('unknown foods are kept (needs a look, AI cleanup later) with a category default date', () => {
    const r = parseReceipt(asOcr('ZQXW BLORP     3.99'), TODAY);
    expect(r.items[0]).toMatchObject({
      foodId: null,
      name: 'Zqxw Blorp',
      status: 'needs_look',
      wantsAi: true,
      expirySource: 'category_default',
    });
  });

  it('a receipt date far in the past or in the future falls back to today', () => {
    expect(parseReceipt(asOcr('01/02/2025\nMILK  3.99'), TODAY).purchasedOn).toBe(TODAY);
    expect(parseReceipt(asOcr('12/30/2026\nMILK  3.99'), TODAY).purchasedOn).toBe(TODAY);
  });

  it('SCN-7 input: blank and unreadable lines produce no items', () => {
    const r = parseReceipt(asOcr('\n  \n~~~\n'), TODAY);
    expect(r.items).toEqual([]);
    expect(r.lineCount).toBe(1);
  });
});
