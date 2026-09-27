import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'api',
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      BETTER_AUTH_SECRET: 'test-secret-at-least-32-characters-long!!',
      GOOGLE_CLIENT_ID: 'test-google-client-id',
      GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
      APP_URL: 'https://localhost:5173',
      API_URL: 'https://localhost:5173',
    },
  },
});
