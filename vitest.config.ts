import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['packages/*', 'apps/api', 'apps/web'],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**'],
      thresholds: { lines: 90 },
    },
  },
});
