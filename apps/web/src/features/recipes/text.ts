import type { MissingIngredient, RankedRecipe, WhyPart } from '@shelf-life/ranking';
import type { TFunction } from 'i18next';

/** "Mexican", or an AI cuisine as written. */
export function cuisineName(t: TFunction, cuisine: string): string {
  return t(`recipes.cuisines.${cuisine}`, { defaultValue: cuisine });
}

function whenText(t: TFunction, days: number) {
  if (days <= 0) return t('recipes.whyParts.whenToday');
  if (days === 1) return t('recipes.whyParts.whenTomorrow');
  return t('recipes.whyParts.whenDays', { count: days });
}

function partText(t: TFunction, p: WhyPart): string {
  switch (p.kind) {
    case 'saves':
      return p.count === 1
        ? t('recipes.whyParts.saves', {
            count: 1,
            names: p.names[0]!.toLowerCase(),
            when: whenText(t, p.daysLeft),
          })
        : t('recipes.whyParts.saves', {
            count: p.count,
            first: p.names[0]!.toLowerCase(),
            when: whenText(t, p.daysLeft),
          });
    case 'everything':
      return t('recipes.whyParts.everything');
    case 'fastest':
      return t('recipes.whyParts.fastest');
    case 'cuisine':
      return t('recipes.whyParts.cuisine');
    case 'few_missing':
      return t('recipes.whyParts.fewMissing', { count: p.count });
  }
}

/** SRS 8.5: the #1 recipe's "why" sentence from its top two contributors. */
export function whySentence(t: TFunction, why: readonly WhyPart[]): string {
  const [a, b] = why.map((p) => partText(t, p));
  const reason = a && b ? t('recipes.whyJoin', { a, b }) : (a ?? t('recipes.whyParts.fallback'));
  return t('recipes.why', { reason });
}

export type RecipeNote = { tone: 'ok' | 'claimed' | 'out' | 'missing'; text: string };

/** REC-4 one-line note about the first missing thing, e.g. "Onions: Arjun is buying them". */
export function recipeNote(
  t: TFunction,
  r: RankedRecipe,
  personName: (userId: string) => string,
): RecipeNote {
  const m: MissingIngredient | undefined =
    r.missing.find((x) => x.state === 'ran_out') ?? r.missing[0];
  if (!m) return { tone: 'ok', text: t('recipes.note.everything') };
  const name = m.ingredient.name;
  switch (m.state) {
    case 'claimed':
      return {
        tone: 'claimed',
        text: t('recipes.note.claimed', { name, person: personName(m.listItem!.claimedBy!) }),
      };
    case 'on_list':
      return { tone: 'claimed', text: t('recipes.note.onList', { name }) };
    case 'ran_out':
      return { tone: 'out', text: t('recipes.note.ranOut', { name: name.toLowerCase() }) };
    case 'missing':
      return { tone: 'missing', text: t('recipes.note.missing', { name: name.toLowerCase() }) };
  }
}

/** "AI checked 42 items · 5 min ago". */
export function agoText(t: TFunction, iso: string, now = Date.now()): string {
  const mins = Math.floor((now - Date.parse(iso)) / 60_000);
  if (mins < 2) return t('recipes.pill.justNow');
  if (mins < 60) return t('recipes.pill.minutesAgo', { count: mins });
  return t('recipes.pill.hoursAgo', { count: Math.floor(mins / 60) });
}
