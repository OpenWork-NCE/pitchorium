import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { ESLint } from 'eslint';
import { afterEach, describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '../..');
const created: string[] = [];

function write(relativePath: string, content: string): string {
  const path = join(ROOT, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  created.push(path);
  return path;
}

async function violations(file: string): Promise<string[]> {
  const eslint = new ESLint({ cwd: ROOT });
  const [result] = await eslint.lintFiles([file]);
  return (result?.messages ?? []).map((message) => `${message.line}:${message.ruleId ?? 'fatal'}`);
}

// The violations are written as real files because type-aware linting needs them on disk;
// afterEach removes them.
afterEach(() => {
  for (const path of created.splice(0)) rmSync(path, { force: true });
});

describe('architecture boundaries', () => {
  it('only lets a module import the public index.ts of another module', async () => {
    write('src/modules/profiles/infrastructure/arch-test-target.ts', 'export const target = 1;\n');
    const file = write(
      'src/modules/identity/application/arch-test.ts',
      [
        "import { target } from '../../profiles/infrastructure/arch-test-target';",
        "import { ProfilesModule as Internal } from '../../profiles/profiles.module';",
        "import { ProfilesModule } from '../../profiles';",
        'export const all = [target, Internal, ProfilesModule];',
        '',
      ].join('\n'),
    );

    expect(await violations(file)).toEqual([
      '1:boundaries/dependencies',
      '2:boundaries/dependencies',
    ]);
  });

  it('keeps domain/ free of NestJS, Drizzle and infrastructure', async () => {
    write(
      'src/modules/identity/infrastructure/arch-test-adapter.ts',
      'export const adapter = 1;\n',
    );
    const file = write(
      'src/modules/identity/domain/arch-test.ts',
      [
        "import { Injectable } from '@nestjs/common';",
        "import { eq } from '@pitchorium/db/orm';",
        "import { adapter } from '../infrastructure/arch-test-adapter';",
        "import { errorCodes } from '@pitchorium/contracts';",
        "import { Money } from '../../../platform/kernel';",
        'export const all = [Injectable, eq, adapter, errorCodes, Money];',
        '',
      ].join('\n'),
    );

    expect(await violations(file)).toEqual([
      '1:boundaries/dependencies',
      '2:no-restricted-imports',
      '3:boundaries/dependencies',
    ]);
  });

  it('forbids platform/ from importing business modules', async () => {
    const file = write(
      'src/platform/core/arch-test.ts',
      "import { IdentityModule } from '../../modules/identity';\nexport const all = [IdentityModule];\n",
    );

    expect(await violations(file)).toEqual(['1:boundaries/dependencies']);
  });

  it('restricts a module to its own database schema', async () => {
    const file = write(
      'src/modules/identity/infrastructure/arch-test.ts',
      [
        "import { identitySchema } from '@pitchorium/db/schemas/identity';",
        "import { projectsSchema } from '@pitchorium/db/schemas/projects';",
        'export const all = [identitySchema, projectsSchema];',
        '',
      ].join('\n'),
    );

    expect(await violations(file)).toEqual(['2:no-restricted-imports']);
  });
});
