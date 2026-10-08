import { describe, expect, it } from 'vitest';
import { messagesFor, toIcu } from './messages';

describe('messages', () => {
  it('turns the parameters of the catalogues into ICU arguments', () => {
    expect(toIcu('Référence : {{reference}}')).toBe('Référence : {reference}');
  });

  it('quotes the ICU syntax characters of plain text', () => {
    expect(toIcu("l'api {ok} <b> #1")).toBe("l''api '{'ok'}' '<'b'>' '#'1");
  });

  it('falls back to French for a key a locale lacks', () => {
    const swahili = messagesFor('sw').web as { notFound: { title: string } };
    const french = messagesFor('fr').web as { notFound: { title: string } };
    expect(swahili.notFound.title).toBe(french.notFound.title);
  });
});
