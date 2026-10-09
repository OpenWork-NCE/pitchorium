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

/** The message a field shows for a value refused by its schema of the contracts. */
function messageFor(schema: z.ZodType, field: string, value: unknown): string | null {
  const result = z.object({ [field]: schema }).safeParse({ [field]: value });
  if (result.success) return null;
  const [issue] = result.error.issues;
  return issue ? issueMessage(t, issue, field, french) : null;
}

describe('the message says the reason the value was refused (A11)', () => {
  const onlineUrl = createEventRequestSchema.shape.onlineUrl;

  it('never answers about https to a link that already starts with https', () => {
    const malformed = messageFor(onlineUrl, 'onlineUrl', 'https://meet exemple org');
    expect(malformed).toBe(
      'Ce lien n’est pas une adresse web valide : copiez le lien complet de la visioconférence, par exemple https://meet.exemple.org/atelier.',
    );
    expect(malformed).not.toMatch(/http:\/\/ n’est pas accepté/);
    expect(messageFor(onlineUrl, 'onlineUrl', 'http://meet.exemple.org/atelier')).toBe(
      'Le lien de la visioconférence doit commencer par https:// (http:// n’est pas accepté).',
    );
    expect(messageFor(onlineUrl, 'onlineUrl', 'https://meet.exemple.org/atelier')).toBeNull();
  });

  it('gives the same message for the reason the api sends as for the browser', () => {
    for (const [code, reason, value] of [
      ['invalid_format', 'url', 'meet.exemple.org'],
      ['custom', 'https_required', 'http://meet.exemple.org'],
    ] as const) {
      expect(serverIssueMessage(t, code, 'onlineUrl', {}, french, reason)).toBe(
        messageFor(onlineUrl, 'onlineUrl', value),
      );
    }
    const linkedin = updateBaseProfileRequestSchema.shape.links.unwrap().shape.linkedin;
    expect(serverIssueMessage(t, 'custom', 'linkedin', {}, french, 'linkedin_host')).toBe(
      messageFor(linkedin, 'linkedin', 'https://exemple.org/in/awa'),
    );
  });

  it.each([
    ['required', {}, 'title', 'Renseignez ce champ.'],
    ['invalid_type', {}, 'title', 'Renseignez ce champ.'],
    [
      'too_small',
      { origin: 'string', minimum: 12 },
      'password',
      'Saisissez au moins 12 caractères.',
    ],
    [
      'too_small',
      { origin: 'array', minimum: 1 },
      'sectorCodes',
      'Choisissez au moins un élément.',
    ],
    [
      'too_big',
      { origin: 'string', maximum: 220 },
      'headline',
      'Raccourcissez ce texte à 220 caractères au plus.',
    ],
    ['too_big', { origin: 'array', maximum: 1 }, 'sectorCodes', 'Choisissez un seul élément.'],
    [
      'invalid_format',
      { reason: 'email' },
      'email',
      'Saisissez une adresse email complète, par exemple nom@exemple.org.',
    ],
    [
      'invalid_format',
      { reason: 'url' },
      'videoUrl',
      'Saisissez une adresse web complète, par exemple https://exemple.org.',
    ],
    [
      'invalid_format',
      { reason: 'url' },
      'website',
      'Cette adresse n’est pas valide : saisissez l’adresse complète du site, par exemple https://exemple.org.',
    ],
    [
      'custom',
      { reason: 'https_required' },
      'website',
      'L’adresse du site doit commencer par https:// (http:// n’est pas accepté).',
    ],
    [
      'custom',
      { reason: 'https_required' },
      'videoUrl',
      'L’adresse doit commencer par https:// (http:// n’est pas accepté).',
    ],
    [
      'custom',
      { reason: 'linkedin_host' },
      'linkedin',
      'Saisissez l’adresse d’un profil sur linkedin.com, par exemple https://www.linkedin.com/in/votre-nom.',
    ],
    [
      'invalid_format',
      { reason: 'regex' },
      'handle',
      'Utilisez de 3 à 30 caractères : lettres minuscules sans accent, chiffres et tirets, sans tiret au début, à la fin ni deux de suite.',
    ],
    ['invalid_format', { reason: 'regex' }, 'code', 'Saisissez les 6 chiffres du code.'],
    ['invalid_value', {}, 'terms', 'Cochez cette case pour continuer.'],
    ['invalid_format', { reason: 'datetime' }, 'startsAt', 'Indiquez la date et l’heure de début.'],
  ] as const)('%s (%j) on %s', (code, extra, field, expected) => {
    const { reason, ...rules } = extra as { reason?: string } & Record<string, unknown>;
    expect(serverIssueMessage(t, code, field, rules, french, reason)).toBe(expected);
  });
});

describe('issue messages', () => {
  it('says the rule a field expects rather than a generic message', () => {
    expect(issueMessage(t, { code: 'custom' }, 'linkedin')).toMatch(/linkedin\.com/);
    expect(
      issueMessage(t, { code: 'custom', params: { reason: 'https_required' } }, 'onlineUrl'),
    ).toMatch(/https:\/\/.*http:\/\/ n’est pas accepté/);
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
