/**
 * What the sync service (apps/sync) shares with the API: the same database schema, access rules
 * and token checks, so both sides agree on who may open which doc (SEC-3).
 */
export { createDb, schema, type Db } from './db/client';
export { docAccess, type DocAccess } from './services/access';
export { verifySyncToken, signSyncToken, type SyncClaims } from './services/syncToken';
