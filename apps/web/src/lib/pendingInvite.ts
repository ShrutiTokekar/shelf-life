import { safeStorage } from './storage';

const KEY = 'shelf-life:pending-invite';

/**
 * WEL-3: opening /join/:token before sign-in stores the token so the user joins the list after
 * signing in. Accepting it (POST /invites/:token/accept) arrives with list sharing in Milestone 5.
 */
export const pendingInvite = {
  save(token: string) {
    safeStorage.set(KEY, token);
  },
  get(): string | null {
    return safeStorage.get(KEY);
  },
  clear() {
    safeStorage.remove(KEY);
  },
};
