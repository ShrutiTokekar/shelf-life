import { useCookSession } from '../stores/cookSession';
import { usePlace } from '../stores/place';
import { useRecipeStore } from '../stores/recipes';
import { useReviewDraft } from '../stores/reviewDraft';
import { useTimers } from '../stores/timers';
import { safeStorage } from './storage';
import { closeAllDocs } from './sync/docs';

/**
 * Sign out and Delete account (PRO-6): remove this account's data from the device: open docs,
 * their IndexedDB copies (pantry, lists, receipts), and stored recipe, chat and timer state.
 * Display settings stay (they belong to the device, not the account).
 */
export async function wipeDeviceData(): Promise<void> {
  closeAllDocs();
  useRecipeStore.getState().clear();
  useCookSession.setState(useCookSession.getInitialState());
  useTimers.setState({ timers: {} });
  useReviewDraft.getState().clear();
  usePlace.setState(usePlace.getInitialState());
  for (const key of [
    'shelf-life:me',
    'shelf-life:place',
    'shelf-life:recipes',
    'shelf-life:timers',
  ])
    safeStorage.remove(key);
  try {
    window.sessionStorage.removeItem('shelf-life:cook-session');
  } catch {
    // ignore
  }
  try {
    const dbs = (await indexedDB.databases?.()) ?? [];
    await Promise.all(
      dbs
        .map((d) => d.name)
        .filter((n): n is string => !!n?.startsWith('shelf-life:'))
        .map(
          (n) =>
            new Promise<void>((resolve) => {
              const req = indexedDB.deleteDatabase(n);
              req.onsuccess = req.onerror = req.onblocked = () => resolve();
            }),
        ),
    );
  } catch {
    // Storage blocked or unavailable: nothing stored to remove.
  }
}
