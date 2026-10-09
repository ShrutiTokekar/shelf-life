/**
 * Email + password accounts (Milestone 9b) through Better Auth's endpoints. Better Auth answers
 * errors as `{ code, message }`; the API's own guards as `{ error: { code, message } }`.
 */
const AUTH = '/api/v1/auth';

export type AuthErrorCode =
  | 'invalid_credentials'
  | 'not_verified'
  | 'weak_password'
  | 'breached_password'
  | 'too_many'
  | 'invalid_token'
  | 'network'
  | 'unknown';

export class AuthError extends Error {
  constructor(readonly code: AuthErrorCode) {
    super(code);
  }
}

function codeOf(status: number, body: unknown): AuthErrorCode {
  const b = (body ?? {}) as { code?: string; error?: { code?: string } };
  const code = (b.error?.code ?? b.code ?? '').toUpperCase();
  if (status === 429) return 'too_many';
  if (code === 'PASSWORD_BREACHED') return 'breached_password';
  if (code === 'EMAIL_NOT_VERIFIED') return 'not_verified';
  if (code.includes('PASSWORD_TOO_SHORT') || code.includes('PASSWORD_TOO_LONG'))
    return 'weak_password';
  if (code.includes('INVALID_TOKEN') || code.includes('TOKEN_EXPIRED')) return 'invalid_token';
  if (code.includes('INVALID_EMAIL_OR_PASSWORD') || status === 401) return 'invalid_credentials';
  return 'unknown';
}

async function post(path: string, body: unknown): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${AUTH}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AuthError('network');
  }
  if (!res.ok) throw new AuthError(codeOf(res.status, await res.json().catch(() => null)));
}

const here = () => window.location.origin;

/** Is email sign-in set up on this server? (Without an email service it's off.) */
export async function fetchAuthConfig(): Promise<{ emailSignIn: boolean }> {
  try {
    const res = await fetch('/api/v1/config', { credentials: 'include' });
    if (!res.ok) return { emailSignIn: false };
    const body = (await res.json()) as { emailSignIn?: unknown };
    return { emailSignIn: body.emailSignIn === true };
  } catch {
    return { emailSignIn: false };
  }
}

export const signUpWithEmail = (input: { name: string; email: string; password: string }) =>
  post('/sign-up/email', { ...input, callbackURL: `${here()}/email-verified` });

/** Signing in before confirming sends a fresh link (the server does that). */
export const signInWithEmail = (input: { email: string; password: string }) =>
  post('/sign-in/email', { ...input, callbackURL: `${here()}/email-verified` });

export const resendVerification = (email: string) =>
  post('/send-verification-email', { email, callbackURL: `${here()}/email-verified` });

export const requestPasswordReset = (email: string) =>
  post('/request-password-reset', { email, redirectTo: `${here()}/reset-password` });

export const resetPassword = (token: string, newPassword: string) =>
  post('/reset-password', { token, newPassword });
