import Fuse from 'fuse.js';
import { FOODS, foodById, foodByName } from '../food/dictionary';
import type { Food } from '../food/types';
import { WEAK_WORDS } from './normalize';

/**
 * SRS 8.2 step 4: match a cleaned receipt name to the food dictionary.
 * Exact name/alias first, then word-set matching, then Fuse.js fuzzy search. `score` is 0–1
 * (1 = certain).
 */
const entries = FOODS.flatMap((f) => f.names.map((name) => ({ name, foodId: f.foodId })));
const fuse = new Fuse(entries, {
  keys: ['name'],
  includeScore: true,
  threshold: 0.4,
  ignoreLocation: true,
  minMatchCharLength: 2,
});

export type FoodMatch = { food: Food; score: number; via: 'exact' | 'words' | 'fuzzy' };

/** alias word → aliases containing it, for word-set matching. */
const aliasesByWord = new Map<string, { words: string[]; foodId: string }[]>();
for (const { name, foodId } of entries) {
  const words = name.split(' ').filter(Boolean);
  for (const w of new Set(words)) {
    const list = aliasesByWord.get(w) ?? [];
    list.push({ words, foodId });
    aliasesByWord.set(w, list);
  }
}

/**
 * Word-set match: an alias whose words all appear on the line, in any order ("TORTILLAS FLOUR"
 * → "flour tortillas"). Score grows with how much of the line it explains; weak words ("whole",
 * "nonfat") don't count against it. If several different foods explain the same small part of a
 * line ("MANDARIN ORANGE CHICKEN"), the line is ambiguous and scores low.
 */
function matchWords(tokens: string[]): FoodMatch | null {
  const set = new Set(tokens);
  const candidates = new Map<string, { words: string[]; foodId: string }>();
  for (const t of set)
    for (const a of aliasesByWord.get(t) ?? []) candidates.set(a.words.join(' '), a);
  let best: { alias: { words: string[]; foodId: string }; coverage: number } | null = null;
  let tiedFoods = new Set<string>();
  for (const alias of candidates.values()) {
    if (!alias.words.every((w) => set.has(w))) continue;
    const strong = tokens.filter((t) => !WEAK_WORDS.has(t) || alias.words.includes(t));
    const coverage = alias.words.length / Math.max(alias.words.length, strong.length);
    if (
      !best ||
      coverage > best.coverage + 1e-9 ||
      (Math.abs(coverage - best.coverage) < 1e-9 && alias.words.length > best.alias.words.length)
    ) {
      if (!best || coverage > best.coverage + 1e-9) tiedFoods = new Set();
      best = { alias, coverage };
    }
    if (best && Math.abs(coverage - best.coverage) < 1e-9) tiedFoods.add(alias.foodId);
  }
  if (!best) return null;
  const food = foodById(best.alias.foodId)!;
  const ambiguous = tiedFoods.size > 1 && best.coverage < 0.5;
  const score = ambiguous ? 0.55 : 0.55 + 0.4 * best.coverage;
  return { food, score: Math.round(score * 100) / 100, via: 'words' };
}

export function matchFood(key: string): FoodMatch | null {
  const q = key.trim().toLowerCase();
  if (q.length < 2) return null;

  const exact = foodByName(q);
  if (exact) return { food: exact, score: 1, via: 'exact' };

  const words = matchWords(q.split(' ').filter(Boolean));
  if (words && words.score >= 0.8) return words;

  // Fuzzy (typos, OCR slips). Never "certain" on its own: capped below the matched band.
  const [best] = fuse.search(q, { limit: 1 });
  const fuzzy: FoodMatch | null =
    best && best.score !== undefined
      ? {
          food: foodById(best.item.foodId)!,
          score: Math.round(Math.max(0, 1 - best.score) * 0.85 * 100) / 100,
          via: 'fuzzy',
        }
      : null;
  if (words && (!fuzzy || words.score >= fuzzy.score)) return words;
  return fuzzy;
}

/** SRS 8.2 step 6: lines that are clearly not food (skipped, kept in the record as "not food"). */
const NON_FOOD =
  /\b(bag\s?fee|bags?\s?charge|paper\s?(bag|towels?)|plastic\s?bag|reusable\s?bag|toilet|tissue|napkins?|detergent|dish\s?soap|soap|shampoo|conditioner|toothpaste|toothbrush|deodorant|lotion|diapers?|wipes|trash\s?bags?|garbage\s?bags?|foil|plastic\s?wrap|cling\s?wrap|zip\s?loc|ziploc|batter(y|ies)|light\s?bulb|candle|charcoal|lighter|pet\s?food|dog\s?food|cat\s?food|cat\s?litter|vitamins?|supplements?|ibuprofen|tylenol|advil|bandage|gift\s?card|magazine|flowers?|bouquet|plant\s?pot|sponge|bleach|cleaner|lysol|clorox|incense|agarbatti|diya|matchbox|tupperware|container)\b/i;

export function isNonFood(text: string): boolean {
  return NON_FOOD.test(text);
}

/** SRS 8.2 step 5: combine OCR confidence (0–1) with the match score (0–1). */
export function combineConfidence(ocrConfidence: number, matchScore: number): number {
  const ocr = Math.min(1, Math.max(0, ocrConfidence));
  return Math.round(matchScore * (0.5 + 0.5 * ocr) * 100) / 100;
}

/** ≥ 0.8 matched; 0.5–0.8 needs a look; < 0.5 needs a look and is sent to AI cleanup when online. */
export function confidenceBand(confidence: number): 'matched' | 'needs_look' | 'needs_ai' {
  if (confidence >= 0.8) return 'matched';
  if (confidence >= 0.5) return 'needs_look';
  return 'needs_ai';
}
