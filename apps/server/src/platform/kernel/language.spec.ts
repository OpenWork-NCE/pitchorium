import { describe, expect, it } from 'vitest';
import { detectLanguage } from './language';

describe('detectLanguage', () => {
  it('names the language of a text in ISO 639-1', () => {
    expect(
      detectLanguage(
        'Nous installons des pompes solaires pour les maraîchères de Thiès cette saison.',
      ),
    ).toBe('fr');
    expect(
      detectLanguage(
        'We are installing solar pumps for the market gardeners of Thiès this season.',
      ),
    ).toBe('en');
  });

  it('leaves another language, or a misread identifier, undetermined', () => {
    expect(
      detectLanguage('Estamos a instalar bombas solares para as hortelãs de Thiès nesta estação.'),
    ).toBeNull();
    expect(detectLanguage('Parcours manuel bf6026b3-df93-4607-8687-4102b4559c4f')).toBeNull();
  });

  it('leaves a short or empty text undetermined', () => {
    expect(detectLanguage('Merci')).toBeNull();
    expect(detectLanguage(null)).toBeNull();
    expect(detectLanguage('')).toBeNull();
  });
});
