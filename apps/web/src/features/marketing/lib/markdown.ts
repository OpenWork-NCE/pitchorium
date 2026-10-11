/**
 * The small Markdown of the legal pages (ADR 0157), versioned in `content/legal`: a front matter
 * of `key: value` lines, `##` and `###` headings, paragraphs, `-` lists, and inline `**strong**`,
 * `_emphasis_` and `code`. Parsed to a tree rendered by React: no HTML is ever injected.
 */
export type Inline =
  | { type: 'text'; text: string }
  | { type: 'strong'; text: string }
  | { type: 'em'; text: string }
  | { type: 'code'; text: string };

export type Block =
  | { type: 'heading'; level: 2 | 3; text: string; id: string }
  | { type: 'paragraph'; content: Inline[] }
  | { type: 'list'; items: Inline[][] };

export interface MarkdownDocument {
  meta: Record<string, string>;
  blocks: Block[];
}

const INLINE = /\*\*([^*]+)\*\*|_([^_]+)_|`([^`]+)`/g;

export function parseInline(text: string): Inline[] {
  const parts: Inline[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    if (match.index > last) parts.push({ type: 'text', text: text.slice(last, match.index) });
    if (match[1] !== undefined) parts.push({ type: 'strong', text: match[1] });
    else if (match[2] !== undefined) parts.push({ type: 'em', text: match[2] });
    else parts.push({ type: 'code', text: match[3] ?? '' });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ type: 'text', text: text.slice(last) });
  return parts;
}

/** Anchor of a heading: lower case letters and digits, accents dropped, words joined by `-`. */
export function slugOf(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function parseMarkdown(source: string): MarkdownDocument {
  const meta: Record<string, string> = {};
  let body = source.replace(/\r\n/g, '\n');
  const front = /^---\n([\s\S]*?)\n---\n/.exec(body);
  if (front) {
    for (const line of (front[1] ?? '').split('\n')) {
      const separator = line.indexOf(':');
      if (separator > 0) meta[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
    }
    body = body.slice(front[0].length);
  }
  const blocks: Block[] = [];
  for (const chunk of body.split(/\n{2,}/)) {
    const lines = chunk.split('\n').filter((line) => line.trim() !== '');
    if (lines.length === 0) continue;
    const heading = /^(#{2,3}) (.+)$/.exec(lines[0] ?? '');
    if (heading && lines.length === 1) {
      const text = (heading[2] ?? '').trim();
      blocks.push({ type: 'heading', level: heading[1] === '##' ? 2 : 3, text, id: slugOf(text) });
    } else if (lines.every((line) => line.startsWith('- '))) {
      blocks.push({ type: 'list', items: lines.map((line) => parseInline(line.slice(2).trim())) });
    } else {
      blocks.push({ type: 'paragraph', content: parseInline(lines.join(' ')) });
    }
  }
  return { meta, blocks };
}
