import { describe, expect, it } from 'vitest';
import { currencyOptions, languageName, languageOptions } from './options';

describe('options of the profile forms', () => {
  it('offers the languages Intl can name, wolof and swahili included, in the page language', () => {
    const options = languageOptions('fr');
    const codes = options.map((option) => option.value);
    expect(codes).toEqual(expect.arrayContaining(['fr', 'en', 'wo', 'sw', 'ln', 'ha', 'yo']));
    expect(codes).not.toContain('zz');
    expect(languageName('wo', 'fr')).toBe('wolof');
  });

  it('offers the currencies of the api, CFA francs included', () => {
    expect(currencyOptions('fr')).toEqual(
      expect.arrayContaining([{ value: 'XOF', label: 'franc CFA (BCEAO) (XOF)' }]),
    );
  });
});
