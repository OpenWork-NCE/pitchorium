import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * Unit and architecture tests of the web app. Components declare the jsdom environment in
 * their first line; everything else runs in Node. Playwright (e2e/) and Storybook have their
 * own runners.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Next.js resolves it to an empty module on the server; tests run outside Next.js.
      'server-only': fileURLToPath(new URL('./test/support/empty.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.spec.{ts,tsx}', 'test/**/*.spec.ts'],
    setupFiles: ['./test/support/setup.ts'],
    restoreMocks: true,
    // next-intl imports `next/server` without extension: Vite resolves it, Node's ESM loader not.
    server: { deps: { inline: ['next-intl'] } },
    env: {
      NEXT_PUBLIC_SITE_URL: 'http://localhost:3200',
      NEXT_PUBLIC_API_URL: 'http://api.test',
      NEXT_PUBLIC_CDN_URL: 'http://cdn.test/public',
    },
  },
});
