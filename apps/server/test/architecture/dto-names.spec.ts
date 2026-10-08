import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The OpenAPI document names a schema after its DTO class: two classes of the same name with
 * different schemas collapse into one, and one of their routes is then described with the other's
 * schema (the generated client with it). A DTO name is shared only by identical schemas.
 */
const MODULES = join(__dirname, '../../src/modules');
const DTO = /^class (\w+Dto) extends createZodDto\((.+?)\) \{\}$/gm;

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(join(dir, entry.name))
      : entry.name.endsWith('.ts')
        ? [join(dir, entry.name)]
        : [],
  );
}

describe('DTO names of the OpenAPI document', () => {
  it('give one schema per name', () => {
    const schemas = new Map<string, Set<string>>();
    for (const file of files(MODULES)) {
      for (const [, name, schema] of readFileSync(file, 'utf8').matchAll(DTO)) {
        schemas.set(name!, (schemas.get(name!) ?? new Set()).add(schema!.trim()));
      }
    }
    expect(schemas.size).toBeGreaterThan(50);
    const clashes = [...schemas]
      .filter(([, set]) => set.size > 1)
      .map(([name, set]) => `${name}: ${[...set].join(' | ')}`);
    expect(clashes).toEqual([]);
  });
});
