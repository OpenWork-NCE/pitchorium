import { describe, expect, it } from 'vitest';
import { parseInline, parseMarkdown, slugOf } from './markdown';

describe('Markdown of the legal pages', () => {
  it('reads the front matter, headings, paragraphs and lists', () => {
    const { meta, blocks } = parseMarkdown(
      '---\ntitle: Mentions légales\nstatus: pending\n---\n\n## Éditeur du site\n\nUn texte\nsur deux lignes.\n\n- un\n- **deux**\n\n### Détail',
    );
    expect(meta).toEqual({ title: 'Mentions légales', status: 'pending' });
    expect(blocks).toEqual([
      { type: 'heading', level: 2, text: 'Éditeur du site', id: 'editeur-du-site' },
      { type: 'paragraph', content: [{ type: 'text', text: 'Un texte sur deux lignes.' }] },
      {
        type: 'list',
        items: [[{ type: 'text', text: 'un' }], [{ type: 'strong', text: 'deux' }]],
      },
      { type: 'heading', level: 3, text: 'Détail', id: 'detail' },
    ]);
  });

  it('keeps any markup as text: nothing is injected', () => {
    expect(parseInline('<script>x</script> _a_ `b`')).toEqual([
      { type: 'text', text: '<script>x</script> ' },
      { type: 'em', text: 'a' },
      { type: 'text', text: ' ' },
      { type: 'code', text: 'b' },
    ]);
    expect(slugOf("Transferts hors de l'Union européenne")).toBe(
      'transferts-hors-de-l-union-europeenne',
    );
  });
});
