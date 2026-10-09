import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
import { describe, expect, it } from 'vitest';
import { parseApiConfig, parseWorkerConfig } from '../../src/platform/config';

const read = (path: string) => readFileSync(join(__dirname, '../..', path), 'utf8');

/** Every variable of the configuration schema (keys of the Zod object in env.ts). */
const VARIABLES = [
  ...read('src/platform/config/env.ts').matchAll(/^ {2}([A-Z][A-Z0-9_]+): z/gm),
].map((match) => match[1]!);

describe('environment variables', () => {
  it('reads the schema', () => {
    expect(VARIABLES.length).toBeGreaterThan(100);
  });

  it('documents every variable in the environment matrix', () => {
    const matrix = read('../../docs/operations/environments.md');
    expect(VARIABLES.filter((name) => !matrix.includes(`\`${name}\``))).toEqual([]);
  });

  it('lists every variable in .env.example, set or commented', () => {
    const example = read('.env.example');
    const listed = (name: string) => new RegExp(`^#? ?${name}=`, 'm').test(example);
    expect(VARIABLES.filter((name) => !listed(name))).toEqual([]);
  });

  it('starts the api and the worker with .env.example as it is, nothing added', () => {
    // `cp .env.example .env` then `pnpm dev` (README): both schemas accept the copy.
    const example = { ...parseEnv(read('.env.example')) };
    expect(() => parseApiConfig(example)).not.toThrow();
    expect(() => parseWorkerConfig(example)).not.toThrow();
  });
});
