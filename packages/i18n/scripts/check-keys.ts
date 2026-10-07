import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as contracts from '@pitchorium/contracts';

const { AUTH_ERROR_CODES, errorCodes, LABELLED_ENUMS, TECHNICAL_ENUMS } = contracts;

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

const missingAuthCodes = AUTH_ERROR_CODES.filter(
  (code) => !source.get('errors')?.has(`auth.${code}`),
);
if (missingAuthCodes.length > 0) {
  failures.push(
    `${manifest.sourceLocale}/errors: missing /v1/auth codes ${missingAuthCodes.map((code) => `auth.${code}`).join(', ')}`,
  );
}

// Every enum exported by the contracts is labelled in `reference`, or declared technical.
const labelled = new Set<unknown>(Object.values(LABELLED_ENUMS).flat());
const isEnum = (value: unknown): value is { options: readonly string[] } =>
  typeof value === 'object' &&
  value !== null &&
  '_zod' in value &&
  (value as { _zod: { def: { type: string } } })._zod.def.type === 'enum';
const unclassified = Object.entries(contracts)
  .filter(
    ([name, value]) => isEnum(value) && !labelled.has(value) && !TECHNICAL_ENUMS.includes(name),
  )
  .map(([name]) => name);
if (unclassified.length > 0) {
  failures.push(
    `contracts: enums neither in LABELLED_ENUMS nor in TECHNICAL_ENUMS: ${unclassified.join(', ')}`,
  );
}
const reference = source.get('reference') ?? new Set<string>();
const missingLabels = Object.entries(LABELLED_ENUMS).flatMap(([group, schemas]) =>
  [...new Set(schemas.flatMap((schema) => schema.options))]
    .map((value) => `${group}.${value}`)
    .filter((key) => !reference.has(key)),
);
if (missingLabels.length > 0) {
  failures.push(`${manifest.sourceLocale}/reference: missing labels ${missingLabels.join(', ')}`);
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
