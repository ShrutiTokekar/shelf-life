import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * This cooking session's changes to a recipe (SRS 8.10, RCP-4): chosen servings, kept while the
 * tab is open so the recipe page and cook-along agree. Not saved to the account.
 */
type CookSession = {
  servings: Record<string, number>;
  setServings: (recipeId: string, servings: number) => void;
};

const safeSessionStorage = createJSONStorage(() => {
  try {
    return window.sessionStorage;
  } catch {
    return { getItem: () => null, setItem: () => undefined, removeItem: () => undefined };
  }
});

export const useCookSession = create<CookSession>()(
  persist(
    (set, get) => ({
      servings: {},
      setServings: (recipeId, servings) =>
        set({ servings: { ...get().servings, [recipeId]: servings } }),
    }),
    { name: 'shelf-life:cook-session', storage: safeSessionStorage },
  ),
);
