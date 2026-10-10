import { createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';
import { CLIENT_MESSAGES, clientMessages, messagesFor, pickMessages, toIcu } from './messages';

describe('messages', () => {
  it('turns the parameters of the catalogues into ICU arguments', () => {
    expect(toIcu('Référence : {{reference}}')).toBe('Référence : {reference}');
  });

  it('quotes the ICU syntax characters of plain text', () => {
    expect(toIcu("l'api {ok} <b> #1")).toBe("l''api '{'ok'}' '<'b'>' '#'1");
    // A run of them is quoted at once, never as `'#''#'` (an escaped quote in the middle).
    expect(toIcu('## pour un titre')).toBe("'##' pour un titre");
    // A pair of tags is a rich tag of next-intl (t.rich), its parameters converted inside.
    expect(toIcu('J’accepte les <link>conditions</link> (version {{version}}).')).toBe(
      'J’accepte les <link>conditions</link> (version {version}).',
    );
    expect(toIcu('<nowrap>Afrique–{{x}}</nowrap> < 5 %')).toBe(
      "<nowrap>Afrique–{x}</nowrap> '<' 5 %",
    );
  });

  it('sends a route group the subtrees it reads only', () => {
    const marketing = clientMessages('fr', 'marketing') as {
      web: Record<string, unknown>;
      errors?: unknown;
    };
    expect(Object.keys(marketing)).toEqual(['web']);
    expect(Object.keys(marketing.web).sort()).toEqual(
      ['a11y', 'error', 'home', 'locale', 'theme'].sort(),
    );
  });

  it('knows every path of every scope', () => {
    for (const scope of Object.keys(CLIENT_MESSAGES) as (keyof typeof CLIENT_MESSAGES)[]) {
      expect(() => clientMessages('fr', scope)).not.toThrow();
    }
    expect(() => pickMessages(messagesFor('fr'), ['web.missing'])).toThrow('web.missing');
  });

  it('falls back to French for a key a locale lacks', () => {
    const swahili = messagesFor('sw').web as { notFound: { title: string } };
    const french = messagesFor('fr').web as { notFound: { title: string } };
    expect(swahili.notFound.title).toBe(french.notFound.title);
  });

  it('compiles the messages ahead of time, formatted by the formatter of compiled messages', () => {
    const feed = (messagesFor('fr').web as { feed: { newPosts: { other: unknown } } }).feed;
    expect(feed.newPosts.other).toEqual([['count'], ' nouvelles publications']);
    const t = createTranslator({ locale: 'fr', messages: messagesFor('fr') }) as unknown as {
      (key: string, values: Record<string, unknown>): string;
      rich: (key: string, values: Record<string, unknown>) => unknown;
    };
    expect(t('web.feed.newPosts.other', { count: 3 })).toBe('3 nouvelles publications');
    expect(
      t.rich('web.onboarding.terms.acceptTerms', {
        version: '2',
        link: (text: unknown) => `[${String(text)}]`,
      }),
    ).toContain('[');
  });
});
