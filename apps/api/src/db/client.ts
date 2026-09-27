import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export function createDb(url: string) {
  const sql = postgres(url, { max: 10 });
  return { db: drizzle(sql, { schema }), close: () => sql.end() };
}

/** Any Drizzle Postgres database with our schema (postgres-js in prod, PGlite in tests). */
export type Db = ReturnType<typeof createDb>['db'];
export { schema };
