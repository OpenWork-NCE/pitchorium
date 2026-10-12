import { describe, expect, it } from 'vitest';
import { PSEUDO_CLOSE, PSEUDO_OPEN, pseudoLocalize, pseudoLocalizeTree } from './pseudo.js';

const visible = (text: string) => text.replace(/\{\{\w+\}\}|<\/?\w+>/g, '');

describe('pseudoLocalize', () => {
  it('accents the letters and frames the text', () => {
    const result = pseudoLocalize('Se connecter');
    expect(result.startsWith(`${PSEUDO_OPEN}Šé çöññéçţéŕ`)).toBe(true);
    expect(result.endsWith(PSEUDO_CLOSE)).toBe(true);
    expect(result).not.toMatch(/[a-z]{3}/);
  });

  it('makes a text 40 % longer, its frame aside', () => {
    for (const text of ['OK', 'Contribuer', 'Votre profil est visible des membres connectés.']) {
      const body = pseudoLocalize(text).slice(1, -1);
      expect(body.length).toBe(text.length + Math.ceil(text.length * 0.4));
    }
  });

  it('keeps the parameters and the rich tags as they are', () => {
    const result = pseudoLocalize('Bonjour {{name}}, <link>vos préférences</link>.');
    expect(result).toContain('{{name}}');
    expect(result).toContain('<link>');
    expect(result).toContain('</link>');
    expect(result).toContain('Ɓöñĵöûŕ');
    // The parameter and the tags do not count in the length.
    const source = visible('Bonjour {{name}}, <link>vos préférences</link>.');
    expect(visible(result).length).toBe(2 + source.length + Math.ceil(source.length * 0.4));
  });

  it('leaves an empty text empty', () => {
    expect(pseudoLocalize('')).toBe('');
  });

  it('transforms every text of a tree', () => {
    expect(pseudoLocalizeTree({ a: 'Oui', b: { c: 'Non' } })).toEqual({
      a: pseudoLocalize('Oui'),
      b: { c: pseudoLocalize('Non') },
    });
  });
});
