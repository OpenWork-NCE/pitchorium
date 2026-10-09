import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
import { afterEach, describe, expect, it, vi } from 'vitest';

const example = { ...parseEnv(readFileSync(join(__dirname, '../../.env.example'), 'utf8')) };
const source = readFileSync(join(__dirname, '../../src/lib/env.ts'), 'utf8');
/** Variables of the schema: keys of the server and client objects of env.ts. */
const VARIABLES = [...source.matchAll(/^ {4}([A-Z][A-Z0-9_]+): z/gm)].map((match) => match[1]!);

describe('environment of the web app', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('lists every variable of the schema in .env.example', () => {
    expect(VARIABLES.length).toBeGreaterThan(10);
    expect(VARIABLES.filter((name) => !(name in example))).toEqual([]);
  });

  it('accepts .env.example as it is, nothing added (`cp .env.example .env`, then `pnpm dev`)', async () => {
    for (const name of VARIABLES) delete process.env[name];
    Object.assign(process.env, example);
    const { env } = await import('@/lib/env');
    expect(env.NEXT_PUBLIC_API_URL).toBe(example['NEXT_PUBLIC_API_URL']);
    expect(env.NEXT_PUBLIC_UPLOAD_URL).toBe(example['NEXT_PUBLIC_UPLOAD_URL']);
  });

  it('refuses an invalid value, as `next build` does', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    Object.assign(process.env, example, { NEXT_PUBLIC_API_URL: 'not a url' });
    await expect(import('@/lib/env')).rejects.toThrow();
  });
});
