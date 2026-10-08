import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const MODULES = join(__dirname, '../../src/modules');
const IMPORT = /from '\.\.\/(?:\.\.\/)?([a-z-]+)'/g;

function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? sources(join(directory, entry.name))
      : // boundaries.spec.ts writes deliberate violations (arch-test*) while it runs.
        entry.name.endsWith('.ts') &&
          !entry.name.endsWith('.spec.ts') &&
          !entry.name.startsWith('arch-test')
        ? [readFileSync(join(directory, entry.name), 'utf8')]
        : [],
  );
}

/** Module to the modules whose index.ts it imports (synchronous dependencies). */
function graph(): Map<string, Set<string>> {
  const modules = readdirSync(MODULES, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  return new Map(
    modules.map((module) => {
      const dependencies = new Set<string>();
      for (const source of sources(join(MODULES, module))) {
        for (const match of source.matchAll(IMPORT)) {
          const target = match[1];
          if (target && target !== module && modules.includes(target)) dependencies.add(target);
        }
      }
      return [module, dependencies];
    }),
  );
}

describe('module dependencies', () => {
  it('form no cycle (docs/architecture/modules.md)', () => {
    const dependencies = graph();
    const cycles: string[] = [];
    const visit = (module: string, path: string[]): void => {
      if (path.includes(module)) {
        cycles.push([...path.slice(path.indexOf(module)), module].join(' -> '));
        return;
      }
      for (const next of dependencies.get(module) ?? []) visit(next, [...path, module]);
    };
    for (const module of dependencies.keys()) visit(module, []);
    expect([...new Set(cycles)]).toEqual([]);
  });

  it('keeps privacy and localization free of the modules that register with them', () => {
    const dependencies = graph();
    expect([...(dependencies.get('privacy') ?? [])]).toEqual([]);
    expect([...(dependencies.get('localization') ?? [])]).toEqual(['privacy']);
    expect([...dependencies.values()].some((set) => set.has('admin'))).toBe(false);
  });
});
