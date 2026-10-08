import { createEventRequestSchema, updateBaseProfileRequestSchema } from '@pitchorium/contracts';
import { translate } from '@pitchorium/i18n';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { fieldOf, type IssueTranslator, issueMessage, serverIssueMessage } from './issues';
import { endsAfterStart } from './rules';
import { boundsOf } from './schema-bounds';

/** The French messages of `web.forms`, as the forms read them. */
const t: IssueTranslator = Object.assign(
  (key: string, values?: Record<string, string | number>) =>
    translate('fr', 'web', `forms.${key}`, values as Record<string, string> | undefined),
  { has: (key: string) => translate('fr', 'web', `forms.${key}`) !== `forms.${key}` },
);
const french = (value: number) => new Intl.NumberFormat('fr').format(value);

describe('issue messages', () => {
  it('says the rule a field expects rather than a generic message', () => {
    expect(issueMessage(t, { code: 'custom' }, 'linkedin')).toMatch(/linkedin\.com/);
    expect(issueMessage(t, { code: 'invalid_format', format: 'url' }, 'onlineUrl')).toMatch(
      /https:\/\/.*http:\/\/ n’est pas accepté/,
    );
    expect(issueMessage(t, { code: 'invalid_format', format: 'regex' }, 'handle')).toMatch(
      /de 3 à 30 caractères/,
    );
    // The same field in an array of a form.
    expect(fieldOf('members.0.linkedin')).toBe('linkedin');
  });

  it('gives the bounds in the language of the page, and the singular when it is one', () => {
    expect(
      issueMessage(
        t,
        { code: 'too_big', origin: 'string', maximum: 10_000 },
        'description',
        french,
      ),
    ).toBe('Raccourcissez ce texte à 10 000 caractères au plus.');
    expect(issueMessage(t, { code: 'too_small', origin: 'array', minimum: 1 }, 'sectorCodes')).toBe(
      'Choisissez au moins un élément.',
    );
    expect(issueMessage(t, { code: 'too_small', origin: 'string', minimum: 1, input: '' })).toBe(
      'Renseignez ce champ.',
    );
  });

  it('names the rule of a refinement of the web', () => {
    const schema = endsAfterStart(createEventRequestSchema);
    const result = schema.safeParse({
      title: 'Atelier',
      format: 'online',
      onlineUrl: 'https://meet.example.org/a',
      timeZone: 'Africa/Dakar',
      language: 'fr',
      startsAt: '2026-11-20T18:00:00.000Z',
      endsAt: '2026-11-20T17:00:00.000Z',
    });
    const issue = result.error?.issues.find((item) => item.path.join('.') === 'endsAt');
    expect(issue && issueMessage(t, issue, 'endsAt')).toBe('La fin doit être après le début.');
  });

  it('gives an issue of the api the bounds and format of the schema of the form', () => {
    const rules = boundsOf(updateBaseProfileRequestSchema, 'headline');
    expect(rules).toMatchObject({ origin: 'string', maximum: 220 });
    expect(serverIssueMessage(t, 'too_big', 'headline', rules, french)).toBe(
      'Raccourcissez ce texte à 220 caractères au plus.',
    );
    expect(boundsOf(z.object({ site: z.url().nullable() }), 'site')).toMatchObject({
      format: 'url',
    });
    expect(serverIssueMessage(t, 'invalid_type', 'title')).toBe('Renseignez ce champ.');
  });
});
