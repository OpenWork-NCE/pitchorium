import { vitestPreset } from '@pitchorium/config/vitest';
import { defineConfig, mergeConfig } from 'vitest/config';

export default mergeConfig(
  vitestPreset,
  defineConfig({ test: { include: ['src/**/*.spec.{ts,tsx}'] } }),
);
