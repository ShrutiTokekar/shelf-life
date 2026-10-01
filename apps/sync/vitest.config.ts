import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'sync',
    // PGlite boots Postgres in WebAssembly and runs migrations per test; slow when every project
    // runs at once.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    environment: 'node',
  },
});
