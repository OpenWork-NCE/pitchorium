import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { ESLint } from 'eslint';
import { afterEach, describe, expect, it } from 'vitest';

/**
 * Each architecture rule of the web app (ADR 0089) is proved here on a deliberate violation,
 * linted with the real configuration. The files are written to disk because type-aware linting
 * needs them there; afterEach removes them.
 */
const root = join(import.meta.dirname, '../..');
const eslint = new ESLint({ cwd: root });
const created: string[] = [];

afterEach(() => {
  for (const path of created.splice(0).reverse()) rmSync(path, { force: true, recursive: true });
});

async function rulesFor(relativePath: string, code: string): Promise<string[]> {
  const path = join(root, relativePath.replace(/(violation|allowed)/, 'arch-test-$1'));
  // The first missing folder is removed with the file.
  let missing = dirname(path);
  while (!existsSync(dirname(missing))) missing = dirname(missing);
  if (!existsSync(missing)) created.push(missing);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, code);
  created.push(path);
  const [result] = await eslint.lintFiles([path]);
  return (result?.messages ?? []).map((message) => message.ruleId ?? message.message);
}

// The first lint starts the TypeScript project service: several seconds on a CI runner.
describe('architecture rules of the web app', { timeout: 60_000 }, () => {
  it('keeps features out of the design system', async () => {
    expect(
      await rulesFor(
        'src/components/ui/violation.tsx',
        "import { LocaleSwitcher } from '@/features/localization';\nexport const X = LocaleSwitcher;\n",
      ),
    ).toContain('boundaries/dependencies');
  });

  it('lets a feature reach another one through its index.ts only', async () => {
    const internal = await rulesFor(
      'src/features/marketing/violation.ts',
      "import { useActiveLocales } from '@/features/localization/components/active-locales';\nexport const x = useActiveLocales;\n",
    );
    expect(internal).toContain('boundaries/dependencies');
    const facade = await rulesFor(
      'src/features/marketing/allowed.ts',
      "import { useActiveLocales } from '@/features/localization';\nexport const x = useActiveLocales;\n",
    );
    expect(facade).not.toContain('boundaries/dependencies');
  });

  it('lets routes compose features through their index.ts only', async () => {
    expect(
      await rulesFor(
        'src/app/[locale]/(marketing)/violation.tsx',
        "import { Foundations } from '@/features/marketing/components/foundations';\nexport const X = Foundations;\n",
      ),
    ).toContain('boundaries/dependencies');
  });

  it('keeps lib/ free of components and features', async () => {
    expect(
      await rulesFor(
        'src/lib/violation.ts',
        "import { Button } from '@/components/ui';\nexport const x = Button;\n",
      ),
    ).toContain('boundaries/dependencies');
  });

  it('keeps GSAP out of the member space', async () => {
    expect(
      await rulesFor(
        'src/app/[locale]/(app)/violation.tsx',
        "import gsap from 'gsap';\nexport const x = gsap;\n",
      ),
    ).toContain('no-restricted-imports');
    expect(
      await rulesFor(
        'src/features/identity/violation.tsx',
        "import { SplitHeading } from '@/components/motion/split-heading';\nexport const X = SplitHeading;\n",
      ),
    ).toContain('no-restricted-imports');
  });

  it('refuses interface text written in the JSX', async () => {
    const text = await rulesFor(
      'src/components/ui/violation.tsx',
      'export function X() {\n  return <p>Bonjour</p>;\n}\n',
    );
    expect(text).toContain('pitchorium/no-literal-ui-text');
    const label = await rulesFor(
      'src/components/ui/violation.tsx',
      'export function X() {\n  return <button aria-label="Fermer" />;\n}\n',
    );
    expect(label).toContain('pitchorium/no-literal-ui-text');
    const punctuation = await rulesFor(
      'src/components/ui/allowed.tsx',
      'export function X({ n }: { n: number }) {\n  return <p className="text-sm">{n} · {\'–\'}</p>;\n}\n',
    );
    expect(punctuation).not.toContain('pitchorium/no-literal-ui-text');
  });

  it('refuses "use client" on a whole page or layout', async () => {
    expect(
      await rulesFor(
        'src/app/[locale]/(app)/arch-test/page.tsx',
        "'use client';\n\nexport default function Page() {\n  return null;\n}\n",
      ),
    ).toContain('pitchorium/no-client-route-file');
  });
});
