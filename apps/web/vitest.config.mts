import { fileURLToPath } from 'node:url';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

const alias = {
  '@': fileURLToPath(new URL('./src', import.meta.url)),
  // Next.js resolves it to an empty module on the server; tests run outside Next.js.
  'server-only': fileURLToPath(new URL('./test/support/empty.ts', import.meta.url)),
};

/**
 * Stories of the design system run as tests in Chromium (addon-vitest): their `play` function
 * (keyboard, focus, states) and the accessibility addon, which fails on any violation. Once per
 * theme; with reduced motion, so that every element is checked in its final state (contrast at
 * rest, docs/design/motion.md).
 */
function storiesProject(theme: 'light' | 'dark') {
  return {
    extends: true as const,
    plugins: [storybookTest({ configDir: '.storybook', initialGlobals: { theme } })],
    test: {
      name: `stories-${theme}`,
      browser: {
        enabled: true,
        headless: true,
        provider: playwright({ contextOptions: { reducedMotion: 'reduce', locale: 'fr-FR' } }),
        instances: [{ browser: 'chromium' as const }],
      },
    },
  };
}

/**
 * Unit and architecture tests of the web app (`pnpm test`, project `unit`): components declare
 * the jsdom environment in their first line; everything else runs in Node. The stories
 * (`pnpm test:stories`) and Playwright (e2e/) have their own runners.
 */
export default defineConfig({
  plugins: [react()],
  resolve: { alias },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
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
      },
      storiesProject('light'),
      storiesProject('dark'),
    ],
  },
});
