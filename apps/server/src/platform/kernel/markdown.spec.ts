import { describe, expect, it } from 'vitest';
import { restrictedMarkdownViolation } from './markdown';

describe('restricted Markdown', () => {
  it('accepts the documented subset', () => {
    const text = [
      '## Notre histoire',
      '',
      'Un **projet** _agricole_ avec `irrigation`, voir [le site](https://example.org/a?b=c).',
      '',
      '- premier point',
      '- second point',
      '',
      '1. étape',
      '2. étape',
      '',
      '> citation',
      '',
      '### Équipe',
      '',
      '---',
      '',
      '<https://example.org>',
    ].join('\n');
    expect(restrictedMarkdownViolation(text)).toBeNull();
  });

  it('refuses HTML, images, unsafe links, code blocks, other headings and tables', () => {
    for (const [text, reason] of [
      ['Bonjour <script>alert(1)</script>', 'raw HTML'],
      ['<img src=x onerror=alert(1)>', 'raw HTML'],
      ['![photo](https://example.org/a.png)', 'image'],
      ['[lien](javascript:alert(1))', 'link to a non-https target'],
      ['[lien](http://example.org)', 'link to a non-https target'],
      ['[vide]()', 'link to a non-https target'],
      ['[ref]: https://example.org', 'link reference definition'],
      ['```\ncode\n```', 'fenced code block'],
      ['Texte\n\n    code indenté', 'indented code block'],
      ['# Titre de niveau 1', 'heading level other than 2 or 3'],
      ['#### Titre de niveau 4', 'heading level other than 2 or 3'],
      ['Titre\n===', 'level 1 setext heading'],
      ['| a | b |\n| - | - |', 'table'],
    ] as const) {
      expect(restrictedMarkdownViolation(text), text).toBe(reason);
    }
  });
});
