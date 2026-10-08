import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RETENTION_REGISTER } from '../../src/modules/privacy/domain/retention-register';

const SCHEMAS = join(__dirname, '../../../../packages/db/src/schemas');
const MODULES = join(__dirname, '../../src/modules');
const RETENTION_DOCUMENT = join(__dirname, '../../../../docs/compliance/retention.md');

/**
 * Columns that hold a member or their contact (GDPR). A module whose schema declares one must
 * register its exporter and its eraser with the privacy module (ADR 0074).
 */
const PERSONAL_COLUMN =
  /'(?:user|author|owner|sender|contributor|holder|recipient|follower|requester|addressee|blocker|blocked|viewer|viewed|peer|participant|organizer|expert|beneficiary|subject|reporter|appellant|introducer|declarer|first|second)_id'|'(?:submitted|created|requested|granted|invited)_by'|'[a-z_]*email[a-z_]*'/;

function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(join(directory, entry.name))
      : entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')
        ? [join(directory, entry.name)]
        : [],
  );
}

/** Modules whose schema has columns of personal data (platform is no business module). */
function modulesWithPersonalData(): string[] {
  return readdirSync(SCHEMAS)
    .filter((file) => file.endsWith('.ts') && file !== 'platform.ts')
    .filter((file) => PERSONAL_COLUMN.test(readFileSync(join(SCHEMAS, file), 'utf8')))
    .map((file) => file.replace(/\.ts$/, ''));
}

function registers(module: string): boolean {
  const sources = files(join(MODULES, module)).map((file) => readFileSync(file, 'utf8'));
  return sources.some(
    (source) =>
      /\.register(?:PersonalData)?\(\{/.test(source) &&
      source.includes(`module: '${module}'`) &&
      /exporter:/.test(source) &&
      /eraser:/.test(source),
  );
}

describe('personal data', () => {
  it('finds the modules holding personal data', () => {
    expect(modulesWithPersonalData()).toEqual(
      expect.arrayContaining(['identity', 'profiles', 'payments', 'messaging', 'trust', 'privacy']),
    );
  });

  it('has every module holding personal data register its exporter and its eraser', () => {
    const missing = modulesWithPersonalData().filter((module) => !registers(module));
    expect(missing, 'modules without PersonalDataExporter and PersonalDataEraser').toEqual([]);
  });

  it('gives every module holding personal data its retention rules', () => {
    const registered = new Set(RETENTION_REGISTER.map((entry) => entry.module));
    expect(modulesWithPersonalData().filter((module) => !registered.has(module))).toEqual([]);
  });

  it('consolidates every line of the retention register in docs/compliance/retention.md', () => {
    // Rows of the table: module, data, retention, end, open question.
    const rows = readFileSync(RETENTION_DOCUMENT, 'utf8')
      .split('\n')
      .filter((line) => /^\| [a-z]+ +\|/.test(line))
      .map((line) => line.split('|').map((cell) => cell.trim()))
      .map((cells) => `${cells[1]} ${cells[5] ?? ''}`.trim());
    const register = RETENTION_REGISTER.map((entry) =>
      `${entry.module} ${entry.openQuestion ?? ''}`.trim(),
    );
    expect(rows).toEqual(register);
  });
});
