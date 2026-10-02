import {
  acceptInviteResponseSchema,
  recipeSchema,
  recipesResponseSchema,
  savedRecipeSchema,
  type Recipe,
  type RecipesInput,
  type RecipesResponse,
  type SavedRecipe,
  type SettingsPatch,
  type UserSettings,
  cleanupLinesResultSchema,
  shelfLivesResultSchema,
  type CleanedLine,
  type ShelfLifeItem,
  type ShelfLifeResult,
  apiErrorSchema,
  inviteSchema,
  invitePreviewSchema,
  listDetailSchema,
  meResponseSchema,
  syncTokenResponseSchema,
  type CreateInviteInput,
  type CreateListInput,
  type Invite,
  type InvitePreview,
  type InviteRole,
  type ListDetail,
  type ListWithRole,
  type MeResponse,
  type SyncTokenResponse,
  type UpdateListInput,
} from '@shelf-life/shared';

const BASE = '/api/v1';

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Thrown when the request never reached the server (offline, DNS, CORS…). */
export class NetworkError extends Error {}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      credentials: 'include',
      headers: { 'content-type': 'application/json', ...init.headers },
    });
  } catch {
    throw new NetworkError('Network request failed');
  }
  if (res.status === 204) return undefined as T;
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const parsed = apiErrorSchema.safeParse(body);
    throw new ApiRequestError(
      res.status,
      parsed.success ? parsed.data.error.code : 'unknown',
      parsed.success ? parsed.data.error.message : res.statusText,
    );
  }
  return body as T;
}

export async function fetchMe(): Promise<MeResponse> {
  return meResponseSchema.parse(await request<unknown>('/me'));
}

export function createList(input: CreateListInput): Promise<ListWithRole> {
  return request<ListWithRole>('/lists', { method: 'POST', body: JSON.stringify(input) });
}

/**
 * WEL-2: start Google OAuth. Better Auth returns the Google URL; we navigate to it.
 * After Google, the user lands on `/`, and the auth guard sends new users to home list setup.
 */
export async function startGoogleSignIn(): Promise<void> {
  const origin = window.location.origin;
  const { url } = await request<{ url: string }>('/auth/sign-in/social', {
    method: 'POST',
    body: JSON.stringify({
      provider: 'google',
      callbackURL: `${origin}/`,
      errorCallbackURL: `${origin}/welcome?error=signin`,
    }),
  });
  window.location.assign(url);
}

export function signOut(): Promise<void> {
  return request<void>('/auth/sign-out', { method: 'POST', body: '{}' });
}

// ---- Lists and sharing (SRS 11.1, 6.13) ----

export async function fetchList(listId: string): Promise<ListDetail> {
  return listDetailSchema.parse(await request<unknown>(`/lists/${listId}`));
}

export function updateList(listId: string, input: UpdateListInput): Promise<void> {
  return request<void>(`/lists/${listId}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export function deleteList(listId: string): Promise<void> {
  return request<void>(`/lists/${listId}`, { method: 'DELETE' });
}

export async function createInvite(listId: string, input: CreateInviteInput): Promise<Invite> {
  return inviteSchema.parse(
    await request<unknown>(`/lists/${listId}/invites`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  );
}

export function revokeInvite(listId: string, token: string): Promise<void> {
  return request<void>(`/lists/${listId}/invites/${token}`, { method: 'DELETE' });
}

export function stopSharing(listId: string): Promise<void> {
  return request<void>(`/lists/${listId}/stop-sharing`, { method: 'POST', body: '{}' });
}

export function changeRole(listId: string, userId: string, role: InviteRole): Promise<void> {
  return request<void>(`/lists/${listId}/members/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}

export function removeMember(listId: string, userId: string): Promise<void> {
  return request<void>(`/lists/${listId}/members/${userId}`, { method: 'DELETE' });
}

export async function previewInvite(token: string): Promise<InvitePreview> {
  return invitePreviewSchema.parse(await request<unknown>(`/invites/${token}`));
}

export async function acceptInvite(token: string): Promise<{ listId: string }> {
  return acceptInviteResponseSchema.parse(
    await request<unknown>(`/invites/${token}/accept`, { method: 'POST', body: '{}' }),
  );
}

export async function fetchSyncToken(doc: string): Promise<SyncTokenResponse> {
  return syncTokenResponseSchema.parse(
    await request<unknown>(`/sync-token?doc=${encodeURIComponent(doc)}`),
  );
}

// ---- AI (SRS 9). Every caller has a non-AI fallback, so failures return null (rule 2). ----

export async function aiCleanupLines(
  pantryId: string,
  lines: string[],
  store: string | null,
): Promise<CleanedLine[] | null> {
  if (!navigator.onLine) return null;
  try {
    const body = await request<unknown>('/ai/cleanup-lines', {
      method: 'POST',
      body: JSON.stringify({ pantryId, lines, store }),
    });
    return cleanupLinesResultSchema.parse(body).lines;
  } catch {
    return null;
  }
}

/** Shelf-life estimates for several items in one AI call; answers in the same order. */
export async function aiShelfLives(
  pantryId: string,
  items: ShelfLifeItem[],
): Promise<ShelfLifeResult[] | null> {
  if (!navigator.onLine || items.length === 0) return null;
  try {
    return shelfLivesResultSchema.parse(
      await request<unknown>('/ai/shelf-life', {
        method: 'POST',
        body: JSON.stringify({ pantryId, items }),
      }),
    ).items;
  } catch {
    return null;
  }
}

/** SRS 9.2 recipe suggestions; null = use the local recipe set (rule 2). */
export async function aiRecipes(input: RecipesInput): Promise<RecipesResponse | null> {
  if (!navigator.onLine) return null;
  try {
    return recipesResponseSchema.parse(
      await request<unknown>('/ai/recipes', { method: 'POST', body: JSON.stringify(input) }),
    );
  } catch {
    return null;
  }
}

// ---- Recipes, saved recipes and settings (SRS 11.1) ----

export async function fetchRecipe(id: string): Promise<Recipe> {
  return recipeSchema.parse(await request<unknown>(`/recipes/${encodeURIComponent(id)}`));
}

export async function fetchSavedRecipes(): Promise<SavedRecipe[]> {
  const body = await request<{ saved: unknown[] }>('/me/saved-recipes');
  return body.saved.map((s) => savedRecipeSchema.parse(s));
}

export function putSavedRecipe(id: string): Promise<void> {
  return request<void>(`/me/saved-recipes/${encodeURIComponent(id)}`, { method: 'PUT' });
}

export function deleteSavedRecipe(id: string): Promise<void> {
  return request<void>(`/me/saved-recipes/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function patchSettings(patch: SettingsPatch): Promise<UserSettings> {
  return request<UserSettings>('/me/settings', { method: 'PATCH', body: JSON.stringify(patch) });
}
