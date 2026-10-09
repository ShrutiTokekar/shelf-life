import { createHash } from 'node:crypto';

/** Is this password in a known data breach? */
export type PwnedCheck = (password: string) => Promise<boolean>;

/**
 * Have I Been Pwned "range" API: only the first 5 characters of the password's SHA-1 hash leave
 * the server (k-anonymity), never the password. If the service is down, sign-up still works
 * (the 12-character minimum still applies); the failure is logged without the hash.
 */
export function hibpCheck(fetchImpl: typeof fetch = fetch): PwnedCheck {
  return async (password) => {
    const hash = createHash('sha1').update(password).digest('hex').toUpperCase();
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);
    try {
      const res = await fetchImpl(`https://api.pwnedpasswords.com/range/${prefix}`, {
        headers: { 'Add-Padding': 'true', 'User-Agent': 'Shelf Life password check' },
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.text();
      return body.split(/\r?\n/).some((line) => {
        const [s, count] = line.split(':');
        return s === suffix && Number(count) > 0;
      });
    } catch (err) {
      console.error(`[api] password breach check unavailable: ${(err as Error).message}`);
      return false;
    }
  };
}

/** Tests and E2E: no network; a few well-known breached passwords are refused. */
export const offlinePwnedCheck: PwnedCheck = async (password) =>
  ['password1234', 'qwertyuiop123', '123456789012'].includes(password.toLowerCase());
