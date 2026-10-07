import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { errorCodes } from '@pitchorium/contracts';

type Tree = { [key: string]: string | Tree };

const localesDir = join(import.meta.dirname, '../src/locales');
const manifest = JSON.parse(readFileSync(join(localesDir, 'manifest.json'), 'utf8')) as {
  sourceLocale: string;
  locales: Record<string, { status: string }>;
};

function flatten(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === 'string' ? [`${prefix}${key}`] : flatten(value, `${prefix}${key}.`),
  );
}

function readKeys(locale: string): Map<string, Set<string>> {
  const dir = join(localesDir, locale);
  return new Map(
    readdirSync(dir)
      .filter((file) => file.endsWith('.json'))
      .map((file) => [
        file.replace(/\.json$/, ''),
        new Set(flatten(JSON.parse(readFileSync(join(dir, file), 'utf8')) as Tree)),
      ]),
  );
}

const source = readKeys(manifest.sourceLocale);
const failures: string[] = [];

const missingErrorCodes = Object.keys(errorCodes).filter(
  (code) => !source.get('errors')?.has(code),
);
if (missingErrorCodes.length > 0) {
  failures.push(
    `${manifest.sourceLocale}/errors: missing error codes ${missingErrorCodes.join(', ')}`,
  );
}

for (const [locale, { status }] of Object.entries(manifest.locales)) {
  if (locale === manifest.sourceLocale) continue;
  const target = readKeys(locale);
  // Locales still empty are allowed to lag behind; any started locale must be complete.
  const enforced = status !== 'empty';
  for (const [namespace, keys] of source) {
    const targetKeys = target.get(namespace) ?? new Set<string>();
    const missing = [...keys].filter((key) => !targetKeys.has(key));
    const extra = [...targetKeys].filter((key) => !keys.has(key));
    const line = `${locale}/${namespace}: ${missing.length} missing, ${extra.length} extra`;
    if (enforced && (missing.length > 0 || extra.length > 0)) {
      failures.push(
        `${line} (missing: ${missing.join(', ') || 'none'}; extra: ${extra.join(', ') || 'none'})`,
      );
    } else {
      process.stdout.write(`${line}${enforced ? '' : ' (not enforced, status empty)'}\n`);
    }
  }
}

if (failures.length > 0) {
  process.stderr.write(`i18n key check failed:\n${failures.map((f) => `- ${f}`).join('\n')}\n`);
  process.exit(1);
}
process.stdout.write('i18n key check passed.\n');
