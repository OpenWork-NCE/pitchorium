import { describe, expect, it } from 'vitest';
import { formatList, inSentence } from './list';

describe('lists in a sentence', () => {
  it('joins with the conjunction of the language, the labels in lower case', () => {
    expect(formatList(['Photo', 'Photo de couverture'], 'fr')).toBe('photo et photo de couverture');
    expect(formatList(['Photo', 'Titre', 'Liens'], 'fr')).toBe('photo, titre et liens');
    expect(formatList(['Photo', 'Headline', 'Links'], 'en')).toBe('photo, headline, and links');
    expect(formatList(['Acceptation des conditions', 'Email vérifié'], 'fr')).toBe(
      'acceptation des conditions et email vérifié',
    );
  });

  it('keeps acronyms and names with an inner capital', () => {
    expect(inSentence('KYC', 'fr')).toBe('KYC');
    expect(inSentence('LinkedIn', 'fr')).toBe('LinkedIn');
    expect(inSentence('Identité vérifiée (KYC)', 'fr')).toBe('identité vérifiée (KYC)');
    expect(inSentence('Énergie', 'fr')).toBe('énergie');
  });
});
