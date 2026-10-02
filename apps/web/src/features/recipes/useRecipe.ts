import type { Recipe } from '@shelf-life/shared';
import { useEffect, useState } from 'react';
import { fetchRecipe } from '../../lib/api';
import { useRecipeStore } from '../../stores/recipes';
import { loadLocalRecipes } from './useRecipes';

export type RecipeLoad =
  { state: 'loading' } | { state: 'ready'; recipe: Recipe } | { state: 'missing' };

/** A recipe from this device first (local set, saved, recently seen), then the API. */
export function useRecipe(id: string): RecipeLoad {
  const [loaded, setLoaded] = useState<{ id: string; load: RecipeLoad } | null>(null);
  useEffect(() => {
    let live = true;
    const setLoad = (load: RecipeLoad) => live && setLoaded({ id, load });
    void (async () => {
      const local = (await loadLocalRecipes()).find((r) => r.id === id);
      const { saved, seen } = useRecipeStore.getState();
      const onDevice = local ?? saved[id]?.recipe ?? seen[id];
      if (onDevice) return setLoad({ state: 'ready', recipe: onDevice });
      try {
        const recipe = await fetchRecipe(id);
        useRecipeStore.getState().remember([recipe]);
        setLoad({ state: 'ready', recipe });
      } catch {
        setLoad({ state: 'missing' });
      }
    })();
    return () => {
      live = false;
    };
  }, [id]);
  return loaded && loaded.id === id ? loaded.load : { state: 'loading' };
}
