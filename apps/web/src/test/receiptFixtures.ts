import {
  commitReview,
  draftFromParsed,
  parseReceipt,
  type Receipt,
  type ReviewCommit,
  type ReviewDraft,
} from '@shelf-life/shared';
import { returningUserMe } from './fixtures';

export const PANTRY = returningUserMe.pantry!.id;
export const HOME = returningUserMe.pantry!.homeListId;

export const PATEL_TEXT = `PATEL BROTHERS
09/27/26 14:32
TOOR DAL 4LB 8.99
GV WHL MLK 4.29
PANEER 400G 5.49
PAPER TOWELS 5.99
SUBTOTAL 24.76
TAX 1.23
TOTAL 25.99`;

/** A review draft as the scanner would leave it (text → parser → draft). */
export function scanDraft(text = PATEL_TEXT, confidence = 0.95, today = '2026-09-28'): ReviewDraft {
  const lines = text.split('\n').map((t) => ({ text: t, confidence }));
  return draftFromParsed(parseReceipt(lines, today), HOME);
}

/** A saved receipt plus the pantry items it created. */
export function savedReceipt(
  over: Partial<Receipt> = {},
  draft: ReviewDraft = scanDraft(),
  userId = 'u1',
): ReviewCommit {
  const commit = commitReview(draft, {
    pantryId: PANTRY,
    userId,
    now: '2026-09-28T18:41:00.000Z',
  });
  return { ...commit, receipt: { ...commit.receipt, ...over } };
}
