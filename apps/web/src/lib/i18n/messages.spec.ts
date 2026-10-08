import { describe, expect, it } from 'vitest';
import { CLIENT_MESSAGES, clientMessages, messagesFor, pickMessages, toIcu } from './messages';

describe('messages', () => {
  it('turns the parameters of the catalogues into ICU arguments', () => {
    expect(toIcu('Référence : {{reference}}')).toBe('Référence : {reference}');
  });

  it('quotes the ICU syntax characters of plain text', () => {
    expect(toIcu("l'api {ok} <b> #1")).toBe("l''api '{'ok'}' '<'b'>' '#'1");
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
});
