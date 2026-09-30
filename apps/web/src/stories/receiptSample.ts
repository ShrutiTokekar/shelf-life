import { commitReview, draftFromParsed, parseReceipt, todayIso } from '@shelf-life/shared';

/** Demo data for the receipt stories: typed text run through the real parser. */
const TEXT = `PATEL BROTHERS
TOOR DAL 4LB 8.99
GV WHL MLK 4.29
PANEER 400G 5.49
CILANTRO 0.99
SPINACH BAG 2.99
GRK YOGURT 4.79
ATTA 20LB 16.99
TAX 1.23
TOTAL 48.88`;

export const sampleDraft = (confidence = 0.95) =>
  draftFromParsed(
    parseReceipt(
      TEXT.split('\n').map((text) => ({ text, confidence })),
      todayIso(),
    ),
    'home',
  );

export const sampleReceipt = (confidence = 0.95) =>
  commitReview(sampleDraft(confidence), {
    pantryId: 'p',
    userId: 'u',
    now: new Date().toISOString(),
  }).receipt;
