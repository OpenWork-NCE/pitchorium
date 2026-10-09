import { describe, expect, it } from 'vitest';
import {
  documentFromText,
  type EditorNode,
  mentionedKeys,
  serializeMentions,
} from './mention-text';

const mention = (id: string, kind: 'member' | 'organization' = 'member'): EditorNode => ({
  type: 'mention',
  attrs: { id, label: id, kind },
});
const text = (value: string): EditorNode => ({ type: 'text', text: value });
const doc = (...paragraphs: EditorNode[][]): EditorNode => ({
  type: 'doc',
  content: paragraphs.map((content) => ({ type: 'paragraph', content })),
});

/** The pattern of the api (content/domain/mentions.ts), to check what it will read. */
const API_MENTION =
  /(?<![\p{L}\p{N}_@.-])@([a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){2,59})(?![a-z0-9_-])/giu;
const readByApi = (value: string) => [...value.matchAll(API_MENTION)].map((match) => match[1]);

describe('mentions of the composer', () => {
  it('writes a mention as the key the api reads, a paragraph per line', () => {
    const value = serializeMentions(
      doc(
        [
          text('Merci '),
          mention('kofi-mensah'),
          text(' et '),
          mention('fondation-teranga', 'organization'),
          text(' !'),
        ],
        [text('À bientôt')],
      ),
    );
    expect(value).toBe('Merci @kofi-mensah et @fondation-teranga !\nÀ bientôt');
    expect(readByApi(value)).toEqual(['kofi-mensah', 'fondation-teranga']);
  });

  it('keeps a mention readable where the text touches it', () => {
    const value = serializeMentions(doc([text('Bravo'), mention('ama-owusu'), text('pour tout')]));
    expect(value).toBe('Bravo @ama-owusu pour tout');
    expect(readByApi(value)).toEqual(['ama-owusu']);
    // Punctuation needs no space: (@ama-owusu), @ama-owusu.
    expect(serializeMentions(doc([text('('), mention('ama-owusu'), text(').')]))).toBe(
      '(@ama-owusu).',
    );
  });

  it('turns a line break into a new line and trims the ends', () => {
    expect(serializeMentions(doc([text('  Un'), { type: 'hardBreak' }, text('deux  ')], []))).toBe(
      'Un\ndeux',
    );
  });

  it('lists the mentioned keys once each', () => {
    expect(mentionedKeys(doc([mention('a-b-c'), mention('d-e-f'), mention('a-b-c')]))).toEqual([
      'a-b-c',
      'd-e-f',
    ]);
  });

  it('gives back the document of a publication being edited, with its mentions', () => {
    const document = documentFromText('Merci @kofi-mensah\net @kofi-mensahx', [
      { token: '@kofi-mensah', type: 'member', key: 'kofi-mensah', displayName: 'Kofi Mensah' },
    ]);
    expect(document.content?.[0]?.content).toEqual([
      text('Merci '),
      { type: 'mention', attrs: { id: 'kofi-mensah', label: 'Kofi Mensah', kind: 'member' } },
    ]);
    // `@kofi-mensahx` is another key: it stays text.
    expect(document.content?.[1]?.content).toEqual([text('et @kofi-mensahx')]);
    expect(serializeMentions(document)).toBe('Merci @kofi-mensah\net @kofi-mensahx');
  });
});
