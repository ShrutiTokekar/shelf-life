import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { createDb } from './client';

const url = process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/shelflife';

/** Local convenience: create the database (e.g. shelflife_test for E2E) if it doesn't exist yet. */
async function ensureDatabase(databaseUrl: string) {
  const target = new URL(databaseUrl);
  const name = target.pathname.slice(1);
  const admin = new URL(databaseUrl);
  admin.pathname = '/postgres';
  const sql = postgres(admin.toString(), { max: 1, onnotice: () => undefined });
  try {
    const rows = await sql`select 1 from pg_database where datname = ${name}`;
    if (rows.length === 0) await sql.unsafe(`create database "${name.replace(/"/g, '""')}"`);
  } finally {
    await sql.end();
  }
}

if (process.env.NODE_ENV !== 'production') await ensureDatabase(url);
const { db, close } = createDb(url);
await migrate(db, { migrationsFolder: fileURLToPath(new URL('../../drizzle', import.meta.url)) });
await close();
console.log('Migrations applied.');
