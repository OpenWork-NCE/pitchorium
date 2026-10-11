import { describe, expect, it } from 'vitest';
import { fold, highlightParts } from './highlight';

describe('highlightParts', () => {
  it('marks the start of each word that a term of the query begins, accents ignored', () => {
    expect(highlightParts('Énergie solaire au Sahel', 'energ sah')).toEqual([
      { text: 'Énerg', match: true },
      { text: 'ie solaire au ', match: false },
      { text: 'Sah', match: true },
      { text: 'el', match: false },
    ]);
  });

  it('never marks the middle of a word, nor a title found despite a typo', () => {
    expect(highlightParts('Coopérative', 'pera')).toEqual([{ text: 'Coopérative', match: false }]);
    expect(highlightParts('Aïssatou Ba', 'aisatou')).toEqual([
      { text: 'Aïssatou Ba', match: false },
    ]);
  });

  it('keeps the title whole without a query', () => {
    expect(highlightParts('Kofi Mensah', '  ')).toEqual([{ text: 'Kofi Mensah', match: false }]);
  });

  it('folds case and diacritics', () => {
    expect(fold('Ségou ÉCOLE')).toBe('segou ecole');
  });
});
