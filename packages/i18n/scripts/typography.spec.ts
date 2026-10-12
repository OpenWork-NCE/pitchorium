import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { straightApostrophes } from './typography.js';

describe('straightApostrophes', () => {
  it('names the texts with a straight apostrophe, at any depth', () => {
    expect(
      straightApostrophes({
        ok: 'L’adresse est vérifiée.',
        bad: "L'adresse est vérifiée.",
        group: { nested: "Aujourd'hui", fine: 'Aujourd’hui' },
      }),
    ).toEqual(['bad', 'group.nested']);
  });

  it('keeps the quoting of ICU, which is not text', () => {
    expect(
      straightApostrophes({
        literal: "Le caractère '{' ouvre un argument, et '' écrit une apostrophe.",
        plural: '{count, plural, one {# contribution} other {# contributions}}',
      }),
    ).toEqual([]);
  });

  it('finds none in the French catalogs', () => {
    const dir = join(import.meta.dirname, '../src/locales/fr');
    const found = readdirSync(dir)
      .filter((file) => file.endsWith('.json'))
      .flatMap((file) =>
        straightApostrophes(
          JSON.parse(readFileSync(join(dir, file), 'utf8')) as Parameters<
            typeof straightApostrophes
          >[0],
          `${file}:`,
        ),
      );
    expect(found).toEqual([]);
  });
});
