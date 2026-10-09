import { fixupPluginRules } from '@eslint/compat';
import nextPlugin from '@next/eslint-plugin-next';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import storybook from 'eslint-plugin-storybook';
import { join } from 'node:path';
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
 * eslint-plugin-react and eslint-plugin-jsx-a11y do not declare ESLint 10 yet: @eslint/compat
 * restores the context methods ESLint 10 removed (ADR 0093). Both are proved on deliberate
 * violations by apps/web/test/architecture/eslint.spec.ts.
 */
const reactPlugin = fixupPluginRules(react);
const jsxA11yPlugin = fixupPluginRules(jsxA11y);

/**
 * ESLint of the web app (apps/web): the shared TypeScript rules, Next.js, React, React hooks and
 * accessibility (jsx-a11y) rules, the architecture boundaries and the rules of the design system.
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
        '.next-live/**',
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
      // The rules resolve the app from its own folder, also when ESLint runs from the root.
      settings: { next: { rootDir: tsconfigRootDir }, react: { version: '19.3' } },
      plugins: {
        '@next/next': nextPlugin,
        react: reactPlugin,
        'react-hooks': reactHooks,
        'jsx-a11y': jsxA11yPlugin,
        pitchorium,
      },
      rules: {
        ...nextPlugin.configs.recommended.rules,
        ...nextPlugin.configs['core-web-vitals'].rules,
        ...react.configs.flat.recommended.rules,
        ...react.configs.flat['jsx-runtime'].rules,
        // TypeScript types the props; the compiler of React names the components.
        'react/prop-types': 'off',
        'react/display-name': 'off',
        ...reactHooks.configs.recommended.rules,
        ...jsxA11y.flatConfigs.strict.rules,
        'pitchorium/no-client-route-file': 'error',
        'no-restricted-imports': ['error', GSAP_IMPORTS],
        // Under the React Compiler, `watch` of react-hook-form renders nothing again: a value
        // read while typing goes through `useWatch` (its subscription).
        'no-restricted-syntax': [
          'error',
          {
            selector: "CallExpression[callee.object.name='form'][callee.property.name='watch']",
            message:
              'Read a value of the form with useWatch: watch does not re-render a compiled component.',
          },
        ],
      },
    },
    {
      files: ['src/**/*.tsx'],
      // Stories and their reference compositions (src/stories) hold mock-up texts.
      ignores: ['**/*.stories.tsx', '**/*.spec.tsx', 'src/stories/**'],
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
    {
      files: ['.storybook/main.ts'],
      rules: {
        'storybook/no-uninstalled-addons': [
          'error',
          { packageJsonLocation: join(tsconfigRootDir, 'package.json') },
        ],
      },
    },
  ];
}
