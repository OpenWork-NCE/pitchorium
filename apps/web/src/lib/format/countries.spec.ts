import { describe, expect, it } from 'vitest';
import { countryName, countryOptions } from './countries';

describe('countryOptions', () => {
  it('names the countries in the language of the page, sorted by name', () => {
    expect(countryOptions(['SN', 'CI', 'BJ'], 'fr')).toEqual([
      { value: 'BJ', label: 'Bénin' },
      { value: 'CI', label: 'Côte d’Ivoire' },
      { value: 'SN', label: 'Sénégal' },
    ]);
    expect(countryName('CM', 'en')).toBe('Cameroon');
  });
});
