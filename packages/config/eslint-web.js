import nextPlugin from '@next/eslint-plugin-next';
import reactHooks from 'eslint-plugin-react-hooks';
import storybook from 'eslint-plugin-storybook';
import globals from 'globals';
import { createConfig } from './eslint.js';
import { webBoundaries } from './eslint-boundaries.js';
import pitchorium from './eslint-plugin-pitchorium.js';

/** GSAP and its editorial heading: public editorial pages only (ADR 0086). */
const GSAP_IMPORTS = {
  patterns: [
    {
      group: ['gsap', 'gsap/*', '@gsap/*', '**/motion/split-heading', '**/motion/split-animator'],
      message:
        'GSAP is reserved to the public editorial pages ((marketing), features/marketing): use Motion or CSS elsewhere.',
    },
  ],
};

/**
 * ESLint of the web app (apps/web): the shared TypeScript rules, Next.js and React hooks rules,
 * the architecture boundaries and the rules of the design system.
 *
 * @param {{ tsconfigRootDir: string, ignores?: string[] }} options
 */
export function createWebConfig({ tsconfigRootDir, ignores = [] }) {
  return [
    ...createConfig({
      tsconfigRootDir,
      ignores: [
        '.next/**',
        '.next-e2e/**',
        '.next-analyze/**',
        'storybook-static/**',
        '.lighthouseci/**',
        'test-results/**',
        'playwright-report/**',
        ...ignores,
      ],
    }),
    {
      files: ['**/*.{ts,tsx}'],
      languageOptions: { globals: { ...globals.browser, ...globals.node } },
      plugins: {
        '@next/next': nextPlugin,
        'react-hooks': reactHooks,
        pitchorium,
      },
      rules: {
        ...nextPlugin.configs.recommended.rules,
        ...nextPlugin.configs['core-web-vitals'].rules,
        ...reactHooks.configs.recommended.rules,
        'pitchorium/no-client-route-file': 'error',
        'no-restricted-imports': ['error', GSAP_IMPORTS],
      },
    },
    {
      files: ['src/**/*.tsx'],
      ignores: ['**/*.stories.tsx', '**/*.spec.tsx'],
      rules: { 'pitchorium/no-literal-ui-text': 'error' },
    },
    {
      files: [
        'src/components/motion/split-heading.tsx',
        'src/components/motion/split-animator.tsx',
        'src/app/*/(marketing)/**',
        'src/features/marketing/**',
        '**/*.stories.tsx',
      ],
      rules: { 'no-restricted-imports': 'off' },
    },
    ...webBoundaries({ rootDir: tsconfigRootDir }),
    ...storybook.configs['flat/recommended'],
  ];
}
