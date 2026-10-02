import { rankRecipes, type RankedRecipe } from '@shelf-life/ranking';
import {
  daysLeft,
  DEFAULT_RECIPE_PREFS,
  todayIso,
  type ListItem,
  type PantryItem,
  type Recipe,
  type RecipePrefs,
  type RecipesInput,
} from '@shelf-life/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { aiRecipes, patchSettings } from '../../lib/api';
import { useCurrentPantry } from '../../lib/pantries';
import { useMe } from '../../lib/session';
import { useListsItems, useReceipts, type DocStatus } from '../../lib/sync/useDocs';
import { useOnlineStatus } from '../../lib/useOnlineStatus';
import { useRecipeStore, type AiRecipeResult } from '../../stores/recipes';

/** ANA-5: AI results are reused for 6 hours, or until the pantry or preferences change. */
export const AI_FRESH_MS = 6 * 3600_000;
/** "Rescue first": items with up to this many days left (REC-2). */
export const RESCUE_DAYS = 3;

let localSet: Promise<readonly Recipe[]> | null = null;
/** The local recipe set is loaded only when recipes are needed (PERF-2). */
export function loadLocalRecipes(): Promise<readonly Recipe[]> {
  localSet ??= import('@shelf-life/shared/recipes').then((m) => m.LOCAL_RECIPES);
  return localSet;
}

export function useLocalRecipes(): readonly Recipe[] | null {
  const [recipes, setRecipes] = useState<readonly Recipe[] | null>(null);
  useEffect(() => {
    let live = true;
    void loadLocalRecipes().then((r) => live && setRecipes(r));
    return () => {
      live = false;
    };
  }, []);
  return recipes;
}

/** PRO-3 / REC-2 recipe preferences: from this device first, then the account. */
export function useRecipePrefs() {
  const me = useMe();
  const local = useRecipeStore((s) => s.prefs);
  const setPrefs = useRecipeStore((s) => s.setPrefs);
  const prefs: RecipePrefs = useMemo(
    () =>
      local ?? {
        diet: me.settings.diet ?? DEFAULT_RECIPE_PREFS.diet,
        cuisines: me.settings.cuisines ?? [],
        maxMinutes: me.settings.maxMinutes ?? null,
        avoid: me.settings.avoid ?? [],
      },
    [local, me.settings],
  );
  const update = useCallback(
    (patch: Partial<RecipePrefs>) => {
      const next = { ...prefs, ...patch };
      setPrefs(next, true);
      // Saved to the account now if online; otherwise when the connection is back.
      void patchSettings(next)
        .then(() => {
          if (useRecipeStore.getState().prefs === next) setPrefs(next, false);
        })
        .catch(() => undefined);
    },
    [prefs, setPrefs],
  );
  return { prefs, update };
}

const active = (items: readonly PantryItem[], today: string) =>
  items.filter((i) => i.status === 'active' && daysLeft(i, today) >= 0);

/** Items to rescue first (REC-2, ANA-2): soonest first. */
export function rescueItems(items: readonly PantryItem[], today: string): PantryItem[] {
  return active(items, today)
    .filter((i) => daysLeft(i, today) <= RESCUE_DAYS)
    .sort((a, b) => a.expiresOn.localeCompare(b.expiresOn) || a.name.localeCompare(b.name));
}

/** What AI is sent (SRS 9.1): item names, days left and preferences. Never people or lists. */
export function aiInput(
  pantryId: string,
  items: readonly PantryItem[],
  prefs: RecipePrefs,
  today: string,
): RecipesInput {
  const rescue = rescueItems(items, today).slice(0, 20);
  const rescueIds = new Set(rescue.map((i) => i.id));
  const names = (xs: PantryItem[]) => [...new Set(xs.map((i) => i.name))];
  return {
    pantryId,
    expiring: rescue.map((i) => ({ name: i.name, daysLeft: daysLeft(i, today) })),
    available: names(active(items, today).filter((i) => !rescueIds.has(i.id))).slice(0, 80),
    preferences: prefs,
  };
}

/** Changes whenever the pantry's contents or the preferences change (ANA-5). */
export function aiKey(input: RecipesInput): string {
  return JSON.stringify([
    input.pantryId,
    input.expiring.map((e) => `${e.name}:${e.daysLeft}`).sort(),
    [...input.available].sort(),
    input.preferences,
  ]);
}

export const isFresh = (ai: AiRecipeResult | null, key: string, now = Date.now()) =>
  !!ai && ai.key === key && now - Date.parse(ai.createdAt) < AI_FRESH_MS;

export type AiPhase = 'idle' | 'checking' | 'done' | 'fallback';

/**
 * SRS 6.8/6.9: everything the recipe pages need, ranked with SRS 8.5 on this device. Candidates
 * are the local set plus the last AI answer for this pantry; without AI (offline, off, over the
 * limit) the local set alone is ranked (rule 2, ANA-6).
 */
export function usePantryRecipes() {
  const current = useCurrentPantry();
  const pantryId = current.pantry.id;
  const { items, status, retry } = useReceipts(pantryId);
  const listIds = useMemo(() => current.lists.map((l) => l.id), [current.lists]);
  const byList = useListsItems(listIds);
  const listItems: ListItem[] = useMemo(() => Object.values(byList).flat(), [byList]);
  const { prefs, update } = useRecipePrefs();
  const local = useLocalRecipes();
  const ai = useRecipeStore((s) => s.ai);
  const setAi = useRecipeStore((s) => s.setAi);
  const online = useOnlineStatus();
  const today = todayIso();
  const [phase, setPhase] = useState<AiPhase>('idle');
  const busy = useRef(false);

  const input = useMemo(
    () => aiInput(pantryId, items, prefs, today),
    [pantryId, items, prefs, today],
  );
  const key = useMemo(() => aiKey(input), [input]);
  const aiForPantry = ai && ai.pantryId === pantryId ? ai : null;
  const fresh = isFresh(aiForPantry, key);

  /** Ask AI (ANA-1). `force` skips the "still fresh" check (Re-check). */
  const check = useCallback(
    async (force = false) => {
      if (busy.current) return;
      if (!force && isFresh(useRecipeStore.getState().ai, key)) {
        setPhase('done');
        return;
      }
      if (!online || !current.pantry.canEdit || items.length === 0) {
        setPhase('fallback');
        return;
      }
      busy.current = true;
      setPhase('checking');
      const res = await aiRecipes(input);
      busy.current = false;
      if (!res) {
        setPhase('fallback');
        return;
      }
      setAi({
        key,
        pantryId,
        recipes: res.recipes,
        createdAt: res.createdAt,
        itemCount: input.expiring.length + input.available.length,
      });
      setPhase('done');
    },
    [key, online, current.pantry.canEdit, items.length, input, pantryId, setAi],
  );

  const ranked: RankedRecipe[] = useMemo(() => {
    if (!local) return [];
    const aiRecipes = fresh || (!online && aiForPantry) ? aiForPantry!.recipes : [];
    // Only recipes that use something from this pantry: an empty kitchen shows the empty state.
    return rankRecipes({
      recipes: [...aiRecipes, ...local],
      pantry: items,
      listItems,
      today,
      prefs,
    }).filter((r) => r.used.some((u) => !u.ingredient.basic));
  }, [local, fresh, online, aiForPantry, items, listItems, today, prefs]);

  const loading: DocStatus | 'loading' = status === 'ready' && !local ? 'loading' : status;
  return {
    status: loading,
    retry,
    pantry: current.pantry,
    lists: current.lists,
    items,
    listItems,
    today,
    prefs,
    updatePrefs: update,
    rescue: rescueItems(items, today),
    ranked,
    ai: fresh ? aiForPantry : null,
    phase,
    check,
    online,
  };
}
