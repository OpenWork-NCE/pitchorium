import { defineConfig } from 'vitest/config';

/**
 * End-to-end suite (pnpm test:e2e): the built api and worker run as real processes against
 * Postgres, Valkey, Mailpit and MinIO containers seeded with the demonstration data; the tests
 * only use the public HTTP API, Socket.IO, Mailpit and, to shorten a delay, SQL.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/e2e/**/*.spec.ts'],
    globalSetup: ['test/e2e/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 90_000,
    hookTimeout: 300_000,
  },
});
