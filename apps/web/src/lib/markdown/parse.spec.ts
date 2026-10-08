import { describe, expect, it } from 'vitest';
import { parseInline, parseMarkdown } from './parse';

describe('restricted Markdown', () => {
  it('reads paragraphs, headings of level 2 and 3, rules and quotes', () => {
    expect(
      parseMarkdown('## Le projet\n\nUn texte\nsur deux lignes.\n\n---\n\n> Une citation'),
    ).toEqual([
      { type: 'heading', level: 2, children: [{ type: 'text', value: 'Le projet' }] },
      { type: 'paragraph', children: [{ type: 'text', value: 'Un texte sur deux lignes.' }] },
      { type: 'rule' },
      {
        type: 'quote',
        children: [{ type: 'paragraph', children: [{ type: 'text', value: 'Une citation' }] }],
      },
    ]);
    expect(parseMarkdown('### Équipe')[0]).toMatchObject({ type: 'heading', level: 3 });
  });

  it('keeps a heading of another level as text', () => {
    expect(parseMarkdown('# Titre')).toEqual([
      { type: 'paragraph', children: [{ type: 'text', value: '# Titre' }] },
    ]);
  });

  it('reads emphasis, strong emphasis, inline code and hard breaks', () => {
    expect(parseInline('**fort** et *léger* et `code`')).toEqual([
      { type: 'strong', children: [{ type: 'text', value: 'fort' }] },
      { type: 'text', value: ' et ' },
      { type: 'emphasis', children: [{ type: 'text', value: 'léger' }] },
      { type: 'text', value: ' et ' },
      { type: 'code', value: 'code' },
    ]);
    expect(parseInline('ligne  \nsuivante')).toEqual([
      { type: 'text', value: 'ligne' },
      { type: 'break' },
      { type: 'text', value: 'suivante' },
    ]);
    expect(parseInline('snake_case_name')).toEqual([{ type: 'text', value: 'snake_case_name' }]);
  });

  it('keeps https links only, as links; any other target is text', () => {
    expect(parseInline('[site](https://example.org) et <https://a.example>')).toEqual([
      { type: 'link', href: 'https://example.org', children: [{ type: 'text', value: 'site' }] },
      { type: 'text', value: ' et ' },
      {
        type: 'link',
        href: 'https://a.example',
        children: [{ type: 'text', value: 'https://a.example' }],
      },
    ]);
    expect(parseInline('[piège](javascript:alert(1))')).toEqual([
      { type: 'text', value: 'piège' },
      { type: 'text', value: ')' },
    ]);
    expect(parseInline('[http](http://example.org)')).toEqual([{ type: 'text', value: 'http' }]);
  });

  it('never produces HTML: tags stay text', () => {
    expect(parseMarkdown('<img src=x onerror=alert(1)>')).toEqual([
      { type: 'paragraph', children: [{ type: 'text', value: '<img src=x onerror=alert(1)>' }] },
    ]);
  });

  it('reads bullet and ordered lists, nested by indentation', () => {
    expect(parseMarkdown('- un\n- deux\n  - deux a\n3. trois')).toEqual([
      {
        type: 'list',
        ordered: false,
        start: 1,
        items: [
          [{ type: 'paragraph', children: [{ type: 'text', value: 'un' }] }],
          [
            { type: 'paragraph', children: [{ type: 'text', value: 'deux' }] },
            {
              type: 'list',
              ordered: false,
              start: 1,
              items: [[{ type: 'paragraph', children: [{ type: 'text', value: 'deux a' }] }]],
            },
          ],
        ],
      },
      {
        type: 'list',
        ordered: true,
        start: 3,
        items: [[{ type: 'paragraph', children: [{ type: 'text', value: 'trois' }] }]],
      },
    ]);
  });
});
