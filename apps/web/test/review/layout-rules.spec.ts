import { describe, expect, it } from 'vitest';
import { overlappingTexts, repeatedTitles, type TextFragment } from '../../e2e/review/layout-rules';

const line = (owner: number, text: string, left: number, top: number, width = 40, layer = 0) =>
  ({
    owner,
    layer,
    text,
    box: { left, top, right: left + width, bottom: top + 16 },
  }) satisfies TextFragment;

describe('overlappingTexts', () => {
  it('finds the labels of an axis written over each other', () => {
    // « nov. » « déc. » « janv. » squeezed in 24 px columns of a phone.
    const labels = [
      line(1, 'nov.', 0, 100, 30),
      line(2, 'déc.', 24, 100, 30),
      line(3, 'janv.', 48, 100, 36),
    ];
    expect(overlappingTexts(labels)).toEqual([
      'overlap: « nov. » and « déc. »',
      'overlap: « déc. » and « janv. »',
    ]);
  });

  it('accepts texts side by side, lines that touch, and lines of one element', () => {
    expect(overlappingTexts([line(1, 'Versé', 0, 0), line(2, '120 €', 41, 0)])).toEqual([]);
    // Tight leading: 4 px of 16 shared by two lines.
    expect(overlappingTexts([line(1, 'Titre', 0, 0), line(2, 'Texte', 0, 12)])).toEqual([]);
    expect(overlappingTexts([line(1, 'une', 0, 0), line(1, 'ligne', 0, 0)])).toEqual([]);
  });

  it('leaves out an overlay drawn over the page', () => {
    expect(overlappingTexts([line(1, 'Page', 0, 0), line(2, 'Dialogue', 0, 0, 40, 1)])).toEqual([]);
  });
});

describe('repeatedTitles', () => {
  it('finds the same title twice in a block', () => {
    expect(
      repeatedTitles([
        { text: 'Euros versés sur douze mois', container: 4 },
        { text: 'Euros versés  sur douze mois ', container: 4 },
      ]),
    ).toEqual(['repeated title: « Euros versés  sur douze mois »']);
  });

  it('accepts the same words in two blocks, or two different titles', () => {
    expect(
      repeatedTitles([
        { text: 'Projets soutenus', container: 1 },
        { text: 'Projets soutenus', container: 2 },
        { text: 'Mes contributions', container: 2 },
      ]),
    ).toEqual([]);
  });
});
