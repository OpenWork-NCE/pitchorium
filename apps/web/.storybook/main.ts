import type { StorybookConfig } from '@storybook/nextjs-vite';

/**
 * Workspace packages, prebundled by Vite: left to the React Compiler's Babel pass like the app's
 * own files, their JSON imports would come out with the old `assert` keyword, which browsers no
 * longer read (the stories run in Chromium, vitest.config.mts).
 */
const WORKSPACE_PACKAGES = ['@pitchorium/i18n', '@pitchorium/contracts', '@pitchorium/api-client'];

/**
 * Libraries of the components, prebundled before the first story runs: discovered during a test
 * run, they would make Vite reload the page in the middle of it.
 */
const LIBRARIES = [
  '@hookform/resolvers/zod',
  '@internationalized/date',
  '@tanstack/react-query',
  'class-variance-authority',
  'clsx',
  'cmdk',
  'lucide-react',
  'motion/react',
  'motion/react-m',
  'next-intl',
  'next-themes',
  'radix-ui',
  'react-day-picker',
  'react-hook-form',
  'sonner',
  'storybook/test',
  'tailwind-merge',
  'vaul',
  'zod',
];

/** Design system of the web app (ADR 0082): primitives, motion, tokens and compositions. */
const config: StorybookConfig = {
  framework: { name: '@storybook/nextjs-vite', options: {} },
  stories: ['../src/**/*.stories.tsx'],
  addons: ['@storybook/addon-a11y', '@storybook/addon-docs', '@storybook/addon-vitest'],
  staticDirs: ['../public'],
  core: { disableTelemetry: true },
  viteFinal: (vite) => ({
    ...vite,
    optimizeDeps: {
      ...vite.optimizeDeps,
      include: [...(vite.optimizeDeps?.include ?? []), ...WORKSPACE_PACKAGES, ...LIBRARIES],
    },
  }),
};

export default config;
