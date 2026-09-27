import {
  apiErrorSchema,
  type CreateListInput,
  type ListWithRole,
  meResponseSchema,
  type MeResponse,
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
