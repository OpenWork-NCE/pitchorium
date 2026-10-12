import { vitestPreset } from '@pitchorium/config/vitest';
import { defineConfig, mergeConfig } from 'vitest/config';

export default mergeConfig(
  vitestPreset,
  defineConfig({ test: { include: ['scripts/**/*.spec.ts', 'src/**/*.spec.ts'] } }),
);
