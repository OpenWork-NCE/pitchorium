import { vitestPreset } from '@pitchorium/config/vitest';
import swc from 'unplugin-swc';
import { defineConfig, mergeConfig } from 'vitest/config';

export default mergeConfig(
  vitestPreset,
  defineConfig({
    // SWC emits decorator metadata, which esbuild does not.
    plugins: [swc.vite({ module: { type: 'es6' } })],
    test: {
      testTimeout: 60_000,
      coverage: {
        include: ['src/platform/kernel/**/*.ts'],
        reporter: ['text'],
        exclude: ['**/*.spec.ts', '**/index.ts'],
        thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 },
      },
    },
  }),
);
