import type { Mention } from '@pitchorium/contracts';

/** A node of the document of the editor (Tiptap JSON), as far as the text needs it. */
export interface EditorNode {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: EditorNode[];
}

/** Attributes of a mention in the editor: its key (handle or slug), its name, its kind. */
export interface MentionAttrs {
  id: string;
  label: string;
  kind: 'member' | 'organization';
}

/** Characters the api refuses before a mention (a word, an email) and after its key. */
const BEFORE_FORBIDDEN = /[\p{L}\p{N}_@.-]$/u;
const AFTER_FORBIDDEN = /^[a-z0-9_-]/i;

/**
 * The text of a publication as the api reads it, from the document of the editor: a paragraph
 * per line, a line break inside one, a mention as `@key` (the api resolves the handle of a member
 * first, then the slug of an organization). A space is put around a mention only where the text
 * touches it, so that the api still reads its key: `(@kofi-mensah)` stays as it is.
 */
export function serializeMentions(document: EditorNode): string {
  const paragraphs = (document.content ?? []).map((paragraph) => {
    let line = '';
    let afterMention = false;
    for (const node of paragraph.content ?? []) {
      if (node.type === 'mention') {
        const key = String((node.attrs as Partial<MentionAttrs> | undefined)?.id ?? '');
        if (!key) continue;
        if (BEFORE_FORBIDDEN.test(line)) line += ' ';
        line += `@${key}`;
        afterMention = true;
        continue;
      }
      const text = node.type === 'hardBreak' ? '\n' : (node.text ?? '');
      if (afterMention && AFTER_FORBIDDEN.test(text)) line += ' ';
      line += text;
      afterMention = false;
    }
    return line;
  });
  return paragraphs.join('\n').trim();
}

/** Keys mentioned in the document, in order, each once. */
export function mentionedKeys(document: EditorNode): string[] {
  const keys: string[] = [];
  const visit = (node: EditorNode) => {
    if (node.type === 'mention') {
      const key = String((node.attrs as Partial<MentionAttrs> | undefined)?.id ?? '');
      if (key && !keys.includes(key)) keys.push(key);
    }
    node.content?.forEach(visit);
  };
  visit(document);
  return keys;
}

/**
 * The document of the editor for the text of a publication being edited: a paragraph per line,
 * its mentions (resolved by the api) as mention nodes with their current name.
 */
export function documentFromText(text: string, mentions: readonly Mention[]): EditorNode {
  const byToken = new Map(mentions.map((mention) => [mention.token.toLowerCase(), mention]));
  const pattern = mentions.length
    ? new RegExp(
        `(${mentions.map((mention) => mention.token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?![a-z0-9_-])`,
        'gi',
      )
    : null;
  return {
    type: 'doc',
    content: text.split('\n').map((line) => {
      const content: EditorNode[] = [];
      let last = 0;
      for (const match of pattern ? line.matchAll(pattern) : []) {
        const mention = byToken.get(match[0].toLowerCase());
        if (!mention || match.index === undefined) continue;
        if (match.index > last) content.push({ type: 'text', text: line.slice(last, match.index) });
        content.push({
          type: 'mention',
          attrs: { id: mention.key, label: mention.displayName, kind: mention.type },
        });
        last = match.index + match[0].length;
      }
      if (last < line.length) content.push({ type: 'text', text: line.slice(last) });
      return content.length ? { type: 'paragraph', content } : { type: 'paragraph' };
    }),
  };
}
