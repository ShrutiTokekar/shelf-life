import { useEffect } from 'react';
import { deleteSavedRecipe, fetchSavedRecipes, patchSettings, putSavedRecipe } from '../../lib/api';
import { useMe } from '../../lib/session';
import { useOnlineStatus } from '../../lib/useOnlineStatus';
import { useRecipeStore } from '../../stores/recipes';

/**
 * Keeps recipe data on this device in step with the account (offline-first): sends saves,
 * unsaves and preference changes made offline once back online, then refreshes the saved list.
 */
export function useRecipeSync() {
  const me = useMe();
  const online = useOnlineStatus();
  const forUser = useRecipeStore((s) => s.forUser);

  useEffect(() => forUser(me.user.id), [forUser, me.user.id]);

  useEffect(() => {
    if (!online) return;
    let cancelled = false;
    void (async () => {
      const store = useRecipeStore.getState();
      if (store.prefsDirty && store.prefs) {
        const sent = store.prefs;
        await patchSettings(sent)
          .then(() => {
            if (useRecipeStore.getState().prefs === sent) store.setPrefs(sent, false);
          })
          .catch(() => undefined);
      }
      for (const [id, op] of Object.entries(store.pending)) {
        try {
          if (op === 'save') await putSavedRecipe(id);
          else await deleteSavedRecipe(id);
          // Only settle if nothing changed meanwhile.
          if (useRecipeStore.getState().pending[id] === op) useRecipeStore.getState().settle(id);
        } catch {
          // Leave it pending; try again next time.
        }
      }
      try {
        const saved = await fetchSavedRecipes();
        if (!cancelled) useRecipeStore.getState().setSavedFromServer(saved);
      } catch {
        // Keep this device's copy.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [online, me.user.id]);
}

/** SAV-2: save or unsave now (sent right away when online, else later by useRecipeSync). */
export async function sendSaved(id: string) {
  const op = useRecipeStore.getState().pending[id];
  if (!op || !navigator.onLine) return;
  try {
    if (op === 'save') await putSavedRecipe(id);
    else await deleteSavedRecipe(id);
    if (useRecipeStore.getState().pending[id] === op) useRecipeStore.getState().settle(id);
  } catch {
    // Stays pending.
  }
}
