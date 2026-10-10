import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type ZodGlobal = typeof globalThis & { __zod_globalConfig?: object };

describe('the configuration of Zod without importing it', () => {
  beforeEach(() => {
    vi.resetModules();
    delete (globalThis as ZodGlobal).__zod_globalConfig;
  });
  afterEach(() => {
    vi.resetModules();
  });

  it('turns the probe of eval off when it runs before Zod', async () => {
    await import('./zod');
    const { config } = await import('zod/v4/core');
    expect(config().jitless).toBe(true);
  });

  it('turns it off in the object Zod already holds when Zod came first', async () => {
    const { config } = await import('zod/v4/core');
    await import('./zod');
    expect(config().jitless).toBe(true);
  });
});
