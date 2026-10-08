import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

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
});
