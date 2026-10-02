import type { Recipe, RecipePrefs, SavedRecipe } from '@shelf-life/shared';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** The last AI answer for this pantry (ANA-5: reused for 6 hours or until the pantry changes). */
export type AiRecipeResult = {
  /** Hash-like key of the pantry and preferences it was made for. */
  key: string;
  pantryId: string;
  recipes: Recipe[];
  createdAt: string;
  /** "AI checked N items". */
  itemCount: number;
};

type RecipeState = {
  /** Whose data this is: cleared when someone else signs in on this device. */
  userId: string | null;
  /** Local copy of the recipe preferences; `prefsDirty` = not saved to the account yet. */
  prefs: RecipePrefs | null;
  prefsDirty: boolean;
  ai: AiRecipeResult | null;
  /** SAV-1: saved recipes, kept on this device so they open offline. */
  saved: Record<string, SavedRecipe>;
  /** Saves and unsaves made offline, sent when back online. */
  pending: Record<string, 'save' | 'unsave'>;
  /** AI recipes opened recently, so their pages work offline. */
  seen: Record<string, Recipe>;

  forUser: (userId: string) => void;
  /** Sign out: nothing about the account stays on the device. */
  clear: () => void;
  setPrefs: (prefs: RecipePrefs, dirty: boolean) => void;
  setAi: (ai: AiRecipeResult) => void;
  toggleSaved: (recipe: Recipe) => boolean;
  setSavedFromServer: (saved: SavedRecipe[]) => void;
  settle: (id: string) => void;
  remember: (recipes: Recipe[]) => void;
};

const safeLocalStorage = createJSONStorage(() => {
  try {
    return window.localStorage;
  } catch {
    return { getItem: () => null, setItem: () => undefined, removeItem: () => undefined };
  }
});

const SEEN_MAX = 40;

const empty = {
  prefs: null,
  prefsDirty: false,
  ai: null,
  saved: {},
  pending: {},
  seen: {},
};

/** Recipes on this device (SRS 6.9, 6.14): preferences, the last AI answer, saved recipes. */
export const useRecipeStore = create<RecipeState>()(
  persist(
    (set, get) => ({
      userId: null,
      ...empty,
      forUser: (userId) => {
        if (get().userId !== userId) set({ userId, ...empty });
      },
      clear: () => set({ userId: null, ...empty }),
      setPrefs: (prefs, dirty) => set({ prefs, prefsDirty: dirty }),
      setAi: (ai) => {
        set({ ai });
        get().remember(ai.recipes);
      },
      /** SAV-2: returns true when it's now saved. */
      toggleSaved: (recipe) => {
        const { saved, pending } = get();
        const isSaved = !!saved[recipe.id];
        const nextSaved = { ...saved };
        if (isSaved) delete nextSaved[recipe.id];
        else nextSaved[recipe.id] = { recipe, savedAt: new Date().toISOString() };
        set({
          saved: nextSaved,
          pending: { ...pending, [recipe.id]: isSaved ? 'unsave' : 'save' },
        });
        return !isSaved;
      },
      /** The server's list, with changes still waiting to be sent applied on top. */
      setSavedFromServer: (list) => {
        const { pending, saved } = get();
        const next: Record<string, SavedRecipe> = {};
        for (const s of list) if (pending[s.recipe.id] !== 'unsave') next[s.recipe.id] = s;
        for (const [id, op] of Object.entries(pending))
          if (op === 'save' && saved[id]) next[id] = saved[id];
        set({ saved: next });
      },
      settle: (id) => {
        const pending = { ...get().pending };
        delete pending[id];
        set({ pending });
      },
      remember: (recipes) => {
        const seen = { ...get().seen };
        for (const r of recipes) if (r.source === 'ai') seen[r.id] = r;
        const ids = Object.keys(seen);
        for (const id of ids.slice(0, Math.max(0, ids.length - SEEN_MAX))) delete seen[id];
        set({ seen });
      },
    }),
    {
      name: 'shelf-life:recipes',
      storage: safeLocalStorage,
      partialize: ({ userId, prefs, prefsDirty, ai, saved, pending, seen }) => ({
        userId,
        prefs,
        prefsDirty,
        ai,
        saved,
        pending,
        seen,
      }),
    },
  ),
);
