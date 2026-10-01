import { jwtVerify, SignJWT } from 'jose';
import type { DocAccess } from './access';

/** SRS 11.1: sync tokens last 5 minutes and cover one doc. */
export const SYNC_TOKEN_TTL_S = 5 * 60;

export type SyncClaims = { userId: string; doc: string; access: DocAccess };

const key = (secret: string) => new TextEncoder().encode(secret);

export async function signSyncToken(
  secret: string,
  claims: SyncClaims,
  now = Date.now(),
): Promise<{ token: string; expiresAt: Date }> {
  const iat = Math.floor(now / 1000);
  const expiresAt = new Date((iat + SYNC_TOKEN_TTL_S) * 1000);
  const token = await new SignJWT({ doc: claims.doc, access: claims.access })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.userId)
    .setIssuedAt(iat)
    .setExpirationTime(iat + SYNC_TOKEN_TTL_S)
    .setAudience('shelf-life-sync')
    .sign(key(secret));
  return { token, expiresAt };
}

/** Returns the claims, or null for a bad, expired or wrong-doc token. */
export async function verifySyncToken(
  secret: string,
  token: string,
  now = Date.now(),
): Promise<SyncClaims | null> {
  try {
    const { payload } = await jwtVerify(token, key(secret), {
      algorithms: ['HS256'],
      audience: 'shelf-life-sync',
      currentDate: new Date(now),
    });
    if (typeof payload.sub !== 'string' || typeof payload.doc !== 'string') return null;
    if (payload.access !== 'write' && payload.access !== 'read') return null;
    return { userId: payload.sub, doc: payload.doc, access: payload.access };
  } catch {
    return null;
  }
}
