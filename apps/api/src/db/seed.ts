import { createDb } from './client';
import { SeedError, seedDemoData } from './seedData';

// Usage: pnpm db:seed --email you@gmail.com   (development only)
if (process.env.NODE_ENV === 'production') {
  console.error('db:seed is for local development only.');
  process.exit(1);
}
const i = process.argv.indexOf('--email');
const email = i >= 0 ? process.argv[i + 1] : undefined;
if (!email) {
  console.error('Usage: pnpm db:seed --email you@gmail.com');
  process.exit(1);
}

const { db, close } = createDb(
  process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/shelflife',
);
try {
  const result = await seedDemoData(db, email);
  console.log(
    `Seeded. Your lists: ${result.lists.join(', ')}. Demo members: ${result.members.join(', ')}.`,
  );
  console.log('Next: open the Pantry page and click "Load sample pantry".');
} catch (err) {
  console.error(err instanceof SeedError ? err.message : err);
  process.exitCode = 1;
} finally {
  await close();
}
