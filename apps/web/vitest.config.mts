import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

const alias = [
  { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
  // Next.js resolves it to an empty module on the server; tests run outside Next.js.
  {
    find: 'server-only',
    replacement: fileURLToPath(new URL('./test/support/empty.ts', import.meta.url)),
  },
  // Messages compiled ahead of time (src/lib/i18n/messages.ts): the formatter next.config.ts uses.
  {
    find: /^use-intl\/format-message$/,
    replacement: createRequire(createRequire(import.meta.url).resolve('next-intl')).resolve(
      'use-intl/format-message/format-only',
    ),
  },
];

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
        // The reference screen of the product is a computer (§4).
        viewport: { width: 1280, height: 800 },
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
          // next-intl imports `next/server` without extension: Vite resolves it, Node's ESM loader
          // not. use-intl, inlined too, gets the formatter of compiled messages (alias above).
          server: { deps: { inline: ['next-intl', 'use-intl'] } },
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
