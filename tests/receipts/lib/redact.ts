import { classifyLine } from '@shelf-life/shared';

/**
 * Remove personal details from OCR'd receipt text before it's committed (SRS 12.3, rule 1). The
 * repo is public, so a receipt must not reveal card or account numbers, loyalty/member IDs,
 * cashier names, the exact time, or phone numbers. Grocery lines, prices, totals, tax and the
 * date stay: they're what the parser is scored on.
 *
 * Deliberately heavy-handed: any line that isn't a grocery, price or date line loses all its
 * digits, and a line naming a person loses the name. A person still reviews the result before committing (README).
 */

const CARD = /[x*#•]{2,}[\s-]*\d{2,}/gi;
/** Loyalty and account numbers: 7+ digits, or grouped like a card (1234 5678 9012). */
const LONG_NUMBER = /\b\d{7,}\b|\b\d{4}(?:[\s-]\d{4}){2,3}\b/g;
const PERSON =
  /\b(cashier|operator|served by|your cashier(?:\s+(?:today|was))*|associate|member(?: name)?|customer|name|card ?holder|host)\b(\s*[:#]?\s*)(.+)$/i;
const TIME = /\b\d{1,2}:\d{2}(:\d{2})?\s*(am|pm)?\b/gi;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/g;

const maskDigits = (s: string) => s.replace(/\d/g, '#');

export type Redaction = { text: string; changed: boolean };

export function redactLine(raw: string, index = 0): Redaction {
  let text = raw.replace(EMAIL, '[email]').replace(CARD, (m) => maskDigits(m));
  const person = PERSON.exec(text);
  if (person) text = text.slice(0, person.index) + person[1] + person[2] + '[name]';

  const kind = classifyLine(text, index, false, () => false).kind;
  if (kind === 'date') {
    text = text.replace(TIME, '##:##');
  } else if (kind === 'payment' || kind === 'other' || kind === 'store') {
    // Account numbers, approval codes, register/transaction numbers, phone numbers, addresses.
    text = maskDigits(text);
  } else if (kind !== 'item') {
    // Total, tax, discount and weight lines keep prices but lose long numbers (member IDs).
    text = text.replace(LONG_NUMBER, maskDigits);
  }
  // Item lines stay as read: product codes and sizes aren't personal, and the parser needs them.
  return { text, changed: text !== raw };
}
