/** @type {import('vitest/config').ViteUserConfig} */
export const vitestPreset = {
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts', 'test/**/*.spec.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', 'test/integration/**'],
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
    },
  },
};
