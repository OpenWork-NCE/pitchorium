import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ADMIN_SEGMENTS, MEMBER_SEGMENTS } from '@/config/routes';

const root = join(import.meta.dirname, '../..');

/** Source files under a folder of src/, recursively. */
function sourceFiles(dir: string): string[] {
  return readdirSync(join(root, 'src', dir), { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && /\.(ts|tsx|css)$/.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name));
}

function segmentsOf(group: string): string[] {
  return readdirSync(join(root, 'src/app/[locale]', group), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
    .map((entry) => entry.name);
}

/** Variables of the configuration schema (keys of the server and client objects of env.ts). */
const VARIABLES = [
  ...readFileSync(join(root, 'src/lib/env.ts'), 'utf8').matchAll(/^ {4}([A-Z][A-Z0-9_]+): /gm),
].map((match) => match[1]!);

describe('project rules of the web app', () => {
  it('documents every configuration variable in the matrix and in .env.example', () => {
    const matrix = readFileSync(join(root, '../../docs/operations/environments.md'), 'utf8');
    const example = readFileSync(join(root, '.env.example'), 'utf8');
    expect(VARIABLES.length).toBeGreaterThan(5);
    expect(VARIABLES.filter((name) => !matrix.includes(`\`${name}\``))).toEqual([]);
    expect(VARIABLES.filter((name) => !new RegExp(`^${name}=`, 'm').test(example))).toEqual([]);
  });

  it('lets the proxy know every top-level folder of the member space and the administration', () => {
    for (const segment of segmentsOf('(app)')) expect(MEMBER_SEGMENTS).toContain(segment);
    for (const segment of segmentsOf('(admin)')) expect(ADMIN_SEGMENTS).toContain(segment);
  });

  it('keeps the handwritten font to the editorial pages (docs/design/direction.md)', () => {
    const allowed = [
      join('src', 'features', 'marketing'),
      join('src', 'app', '[locale]', '(marketing)'),
    ];
    const offenders = sourceFiles('')
      .filter((path) => !allowed.some((folder) => path.includes(folder)))
      .filter((path) => !path.endsWith('.stories.tsx') && !path.endsWith('globals.css'))
      .filter((path) => /\bfont-hand\b/.test(readFileSync(path, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('declares the fallback font for exactly the ranges the brand sync subsets', () => {
    const script = readFileSync(join(root, 'scripts/brand-sync.mjs'), 'utf8');
    const block = /const FALLBACK_RANGES = \[([\s\S]*?)\];/.exec(script)?.[1] ?? '';
    const ranges = [...block.matchAll(/\[0x([0-9a-f]+), 0x([0-9a-f]+)\]/g)].map(
      ([, start, end]) => {
        const from = start!.toUpperCase().padStart(4, '0');
        const to = end!.toUpperCase().padStart(4, '0');
        return from === to ? `U+${from}` : `U+${from}-${to}`;
      },
    );
    const fonts = readFileSync(join(root, 'src/styles/fonts.ts'), 'utf8');
    const declared = /'(U\+[^']+)'/.exec(fonts)?.[1]?.split(', ');
    expect(ranges.length).toBeGreaterThan(10);
    expect(declared).toEqual(ranges);
  });
});
