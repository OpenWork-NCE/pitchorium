import type { StorybookConfig } from '@storybook/nextjs-vite';

/** Design system of the web app (ADR 0082): primitives, motion and tokens. */
const config: StorybookConfig = {
  framework: { name: '@storybook/nextjs-vite', options: {} },
  stories: ['../src/**/*.stories.tsx'],
  addons: ['@storybook/addon-a11y', '@storybook/addon-docs'],
  staticDirs: ['../public'],
  core: { disableTelemetry: true },
};

export default config;
