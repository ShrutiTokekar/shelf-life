import { parseReceipt } from '@shelf-life/shared';
import { redactLine } from './redact';
import { MISSING, SKIP, type LabeledReceipt } from './types';

/** The five stores SRS 13 names; anything else is "other". */
export const STORES = ['patel-brothers', 'costco', 'trader-joes', 'target', 'h-mart'] as const;

/** "patel-brothers-03.jpg" → { id: "patel-brothers-03", store: "patel-brothers" }. */
export function idFromPhoto(fileName: string): { id: string; store: string } {
  const id = fileName
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const store = STORES.find((s) => id.startsWith(s)) ?? 'other';
  return { id, store };
}

/**
 * Every fifth receipt (by a stable hash of its id) is held out: its misses are never used to grow
 * the dictionary, so its score is an honest measure (Milestone 4 plan).
 */
export function splitFor(id: string): 'tune' | 'holdout' {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % 5 === 0 ? 'holdout' : 'tune';
}

/**
 * A draft label from OCR lines: redacted, then pre-filled with what the parser found so a person
 * only corrects it. `checked` stays false until they have.
 */
export function draftLabel(
  fileName: string,
  ocr: readonly { text: string; confidence: number }[],
  today: string,
): { label: LabeledReceipt; redacted: number } {
  const { id, store } = idFromPhoto(fileName);
  let redacted = 0;
  const lines = ocr
    .filter((l) => l.text.trim() !== '')
    .map((l, i) => {
      const r = redactLine(l.text.trim(), i);
      if (r.changed) redacted++;
      return { text: r.text, confidence: Math.round(l.confidence * 1000) / 1000 };
    });
  const parsed = parseReceipt(lines, today);
  const items = new Map(parsed.items.map((i) => [i.index, i]));
  return {
    redacted,
    label: {
      id,
      store,
      split: splitFor(id),
      checked: false,
      lines: lines.map((l, i) => {
        const item = items.get(i);
        return {
          ...l,
          expect: !item ? SKIP : (item.foodId ?? `${MISSING}${item.name}`),
        };
      }),
    },
  };
}
