import { describe, expect, it } from 'vitest';
import { draftLabel, idFromPhoto, splitFor } from './lib/draft';
import { redactLine } from './lib/redact';
import { gate, rate, report, scoreReceipts } from './lib/score';
import type { LabeledReceipt } from './lib/types';

const TODAY = '2026-09-28';

describe('redactLine (SRS 12.3: nothing personal in the public repo)', () => {
  it.each([
    ['VISA ****1234 48.88', 'VISA ****#### ##.##'],
    ['XXXXXXXXXXXX1234 CHIP READ', 'XXXXXXXXXXXX#### CHIP READ'],
    ['APPROVED # 123456', 'APPROVED # ######'],
    ['MEMBER 111222333444', 'MEMBER [name]'],
    ['Cashier: Priya S', 'Cashier: [name]'],
    ['Your cashier today was Mike', 'Your cashier today was [name]'],
    ['(773) 555-0142', '(###) ###-####'],
    ['1234 DEVON AVE', '#### DEVON AVE'],
    ['CHICAGO IL 60659', 'CHICAGO IL #####'],
    ['TRAN# 004512 REG 3', 'TRAN# ###### REG #'],
    ['09/27/26 14:32', '09/27/26 ##:##'],
    ['receipts to jo@mail.com', 'receipts to [email]'],
    ['TOTAL REWARDS 123456789012 0.00', 'TOTAL REWARDS ############ 0.00'],
  ])('%s → %s', (raw, expected) => {
    expect(redactLine(raw).text).toBe(expected);
  });

  it.each([
    'TOOR DAL 4LB 8.99',
    'E 1234567 KS ORG EGGS 24CT 9.99 E',
    'TOTAL 48.88',
    'TAX 1.23',
    '2.13 lb @ 1.49 /lb',
  ])('keeps grocery, price and total lines: %s', (raw) => {
    expect(redactLine(raw)).toEqual({ text: raw, changed: false });
  });
});

describe('draft labels', () => {
  it('names and splits receipts from the photo file', () => {
    expect(idFromPhoto('Patel Brothers 03.JPG')).toEqual({
      id: 'patel-brothers-03',
      store: 'patel-brothers',
    });
    expect(idFromPhoto('corner-store.png').store).toBe('other');
    const splits = Array.from({ length: 50 }, (_, i) => splitFor(`costco-${i}`));
    expect(splits.filter((s) => s === 'holdout').length).toBeGreaterThan(4);
    expect(splitFor('costco-7')).toBe(splitFor('costco-7'));
  });

  it('redacts, pre-fills the parser guess and starts unchecked', () => {
    const ocr = [
      'PATEL BROTHERS',
      '09/27/26 14:32',
      'TOOR DAL 4LB 8.99',
      'PARLE G BISCUIT 2.49',
      'TOTAL 11.48',
      'VISA ****1234 11.48',
    ].map((text) => ({ text, confidence: 0.91234 }));
    const { label, redacted } = draftLabel('patel-brothers-01.jpg', ocr, TODAY);
    expect(redacted).toBe(2);
    expect(label).toMatchObject({
      id: 'patel-brothers-01',
      store: 'patel-brothers',
      checked: false,
    });
    expect(label.lines.map((l) => l.expect)).toEqual([
      'skip',
      'skip',
      'toor-dal',
      expect.stringMatching(/^(missing:|[a-z-]+$)/),
      'skip',
      'skip',
    ]);
    expect(label.lines[5]!.text).toBe('VISA ****#### ##.##');
    expect(label.lines[0]!.confidence).toBe(0.912);
  });
});

describe('scoreReceipts (SRS 13)', () => {
  const receipt = (over: Partial<LabeledReceipt> = {}): LabeledReceipt => ({
    id: 'patel-brothers-01',
    store: 'patel-brothers',
    split: 'tune',
    checked: true,
    lines: [
      { text: 'PATEL BROTHERS', confidence: 0.9, expect: 'skip' },
      { text: 'TOOR DAL 4LB 8.99', confidence: 0.9, expect: 'toor-dal' },
      { text: 'PANEER 400G 5.49', confidence: 0.9, expect: 'paneer' },
      { text: 'PARLE G BISCUIT 2.49', confidence: 0.9, expect: 'missing:Parle-G biscuits' },
      { text: 'CILANTRO 0.99', confidence: 0.9, expect: 'spinach' }, // wrong on purpose
      { text: 'TOTAL 17.96', confidence: 0.9, expect: 'skip' },
    ],
    ...over,
  });

  it('counts grocery lines matched to the expected food', () => {
    const s = scoreReceipts([receipt()], TODAY);
    expect(s.overall).toEqual({ groceries: 4, correct: 2 });
    expect(rate(s.overall)).toBe(0.5);
    expect(s.byStore['patel-brothers']).toEqual({ groceries: 4, correct: 2 });
    expect(s.bySplit.holdout).toEqual({ groceries: 0, correct: 0 });
    expect(s.misses.map((m) => m.expected)).toEqual(['missing:Parle-G biscuits', 'spinach']);
    expect(s.misses[1]!.got).toBe('cilantro');
    expect(s.gaps).toEqual([{ name: 'parle-g biscuits', count: 1 }]);
  });

  it('flags non-grocery lines the parser made into items, and skips unchecked drafts', () => {
    const r = receipt({
      lines: [{ text: 'PANEER 400G 5.49', confidence: 0.9, expect: 'skip' }],
    });
    const s = scoreReceipts([r, receipt({ id: 'draft', checked: false })], TODAY);
    expect(s.falseItems).toHaveLength(1);
    expect(s.unchecked).toEqual(['draft']);
    expect(s.receipts).toBe(1);
    expect(rate(s.overall)).toBeNull();
  });

  it('reports a baseline until the full set exists, then gates at 85%', () => {
    const few = scoreReceipts([receipt()], TODAY);
    expect(gate(few)).toEqual({ enforced: false, pass: true });
    expect(report(few)).toContain('Baseline only');
    expect(report(few)).toContain('parle-g biscuits ×1');
    const many = scoreReceipts(
      Array.from({ length: 50 }, (_, i) => receipt({ id: `r${i}` })),
      TODAY,
    );
    expect(gate(many)).toEqual({ enforced: true, pass: false });
    expect(report(many)).toContain('Below the target');
    const good = scoreReceipts(
      Array.from({ length: 50 }, (_, i) =>
        receipt({ id: `r${i}`, lines: receipt().lines.slice(0, 3) }),
      ),
      TODAY,
    );
    expect(gate(good).pass).toBe(true);
  });

  it('says so when there is nothing to score', () => {
    expect(report(scoreReceipts([], TODAY))).toContain('No checked receipts');
  });
});
