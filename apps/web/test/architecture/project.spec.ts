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

const contractsDir = join(root, '../../packages/contracts/src');
const contractSources = readdirSync(contractsDir)
  .filter((name) => name.endsWith('.ts'))
  .map((name) => readFileSync(join(contractsDir, name), 'utf8'));

describe('reasons of the refinements of the contracts (A11)', () => {
  it('name a reason and never an English message, which would reach the forms', () => {
    // Each refinement up to the next one, the next declaration or a blank line.
    const refinements = contractSources.flatMap((source) =>
      source
        .split('.refine(')
        .slice(1)
        .map((rest) => rest.split(/\.refine\(|\n\n|\nexport /)[0]!),
    );
    expect(refinements.length).toBeGreaterThan(5);
    expect(refinements.filter((body) => /\bmessage:/.test(body))).toEqual([]);
    expect(refinements.filter((body) => !/reason: '[a-z_]+'/.test(body))).toEqual([]);
  });

  it('give every reason a French message of the forms', () => {
    const forms = JSON.parse(
      readFileSync(join(root, '../../packages/i18n/src/locales/fr/web.json'), 'utf8'),
    ).forms as { reasons: Record<string, string>; fields: Record<string, Record<string, string>> };
    const reasons = new Set(
      contractSources.flatMap((source) =>
        [...source.matchAll(/reason: '([a-z_]+)'/g)].map((match) => match[1]!),
      ),
    );
    const said = (reason: string) =>
      reason in forms.reasons || Object.values(forms.fields).some((messages) => reason in messages);
    expect([...reasons].filter((reason) => !said(reason))).toEqual([]);
  });
});

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

  /** The ranges a list of the brand sync subsets, written as a CSS unicode-range. */
  function syncedRanges(list: string): string[] {
    const script = readFileSync(join(root, 'scripts/brand-sync.mjs'), 'utf8');
    const block = new RegExp(`const ${list} = \\[([\\s\\S]*?)\\];`).exec(script)?.[1] ?? '';
    return [...block.matchAll(/\[0x([0-9a-f]+), 0x([0-9a-f]+)\]/g)].map(([, start, end]) => {
      const from = start!.toUpperCase().padStart(4, '0');
      const to = end!.toUpperCase().padStart(4, '0');
      return from === to ? `U+${from}` : `U+${from}-${to}`;
    });
  }

  /** The unicode-range declared by a font of fonts.ts. */
  function declaredRanges(font: string): string[] | undefined {
    const fonts = readFileSync(join(root, 'src/styles/fonts.ts'), 'utf8');
    const declaration = fonts.slice(fonts.indexOf(`export const ${font} = localFont(`));
    return /'(U\+[^']+)'/.exec(declaration)?.[1]?.split(', ');
  }

  it('declares the fallback font for exactly the ranges the brand sync subsets', () => {
    const ranges = syncedRanges('FALLBACK_RANGES');
    expect(ranges.length).toBeGreaterThan(10);
    expect(declaredRanges('fallback')).toEqual(ranges);
  });

  it('declares the figures for exactly the characters of a number the brand sync keeps', () => {
    const ranges = syncedRanges('FIGURE_RANGES');
    expect(ranges).toContain('U+0030-0039');
    expect(declaredRanges('figures')).toEqual(ranges);
  });
});
