import { readFileSync } from 'node:fs';
import { REPORT_REASONS } from '@pitchorium/contracts';
import { describe, expect, it } from 'vitest';
import { defaultGround, REPORT_REASON_KEYS, statementTemplateKey } from './statement-templates';

const catalog = (locale: string) =>
  (
    JSON.parse(
      readFileSync(
        new URL(`../../../../../../packages/i18n/src/locales/${locale}/web.json`, import.meta.url),
        'utf8',
      ),
    ) as { admin: { moderation: { templates: Record<string, string> } } }
  ).admin.moderation.templates;

describe('templates of the statement of reasons (ADR 0174)', () => {
  it('copies the reasons of the contracts', () => {
    expect(REPORT_REASON_KEYS).toEqual(REPORT_REASONS);
  });

  it('starts a dismissal from its own template, any other decision from its reason', () => {
    expect(statementTemplateKey('dismiss', 'spam')).toBe('dismiss');
    expect(statementTemplateKey('hide', 'spam')).toBe('spam');
    expect(statementTemplateKey('suspend', 'fraud')).toBe('fraud');
    expect(statementTemplateKey('warn', null)).toBe('other');
  });

  it('grounds illegal content on the law, the rest on the terms', () => {
    expect(defaultGround('illegal_content')).toBe('law');
    expect(defaultGround('harassment')).toBe('terms');
    expect(defaultGround(null)).toBe('terms');
  });

  it('has a template for every reason and the dismissal, in French and English, naming the target', () => {
    for (const locale of ['fr', 'en']) {
      const templates = catalog(locale);
      for (const key of [...REPORT_REASON_KEYS, 'dismiss']) {
        expect(templates[key], `${locale} ${key}`).toContain('{{target}}');
        // Long enough for the minimum of the api (MODERATION_STATEMENT_MIN_LENGTH, 20).
        expect(templates[key]!.length).toBeGreaterThan(40);
      }
    }
  });
});
