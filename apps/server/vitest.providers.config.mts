import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

/** Provider sandboxes (pnpm test:providers): real test APIs of Stripe and Flutterwave. */
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    environment: 'node',
    include: ['test/providers/**/*.spec.ts'],
    fileParallelism: false,
    testTimeout: 90_000,
  },
});
