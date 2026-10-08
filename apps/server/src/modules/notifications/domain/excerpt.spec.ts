import { describe, expect, it } from 'vitest';
import { excerptOf } from './excerpt';

describe('excerpt of a publication', () => {
  it('keeps a short text whole, its line breaks folded', () => {
    expect(excerptOf('Notre coopérative\n\nrecrute.')).toBe('Notre coopérative recrute.');
  });

  it('cuts a long text at the last word before the limit', () => {
    expect(excerptOf('Atelier gratuit jeudi à Accra pour les coopératives', 30)).toBe(
      'Atelier gratuit jeudi à Accra…',
    );
  });

  it('has nothing to show for an empty text', () => {
    expect(excerptOf(null)).toBeNull();
    expect(excerptOf('   ')).toBeNull();
  });
});
