/**
 * Parser of the restricted Markdown of the api (apps/server/src/platform/kernel/markdown.ts):
 * paragraphs and line breaks, emphasis and strong emphasis, headings of level 2 and 3, bullet
 * and ordered lists (nested by indentation), block quotes, inline code, horizontal rules, and
 * links to https URLs. Anything else stays text: no HTML is ever produced, so nothing a member
 * writes can run or load in the page.
 */

export type Inline =
  | { type: 'text'; value: string }
  | { type: 'strong'; children: Inline[] }
  | { type: 'emphasis'; children: Inline[] }
  | { type: 'code'; value: string }
  | { type: 'link'; href: string; children: Inline[] }
  | { type: 'break' };

export type Block =
  | { type: 'paragraph'; children: Inline[] }
  | { type: 'heading'; level: 2 | 3; children: Inline[] }
  | { type: 'list'; ordered: boolean; start: number; items: Block[][] }
  | { type: 'quote'; children: Block[] }
  | { type: 'rule' };

const HTTPS = /^https:\/\/[^\s<>]+$/;
const RULE = /^ {0,3}([-*_])( *\1){2,} *$/;
const HEADING = /^ {0,3}(#{2,3}) +(.*?)(?: +#+)? *$/;
const BULLET = /^( *)([-*+]) +(.*)$/;
const ORDERED = /^( *)(\d{1,9})[.)] +(.*)$/;
const QUOTE = /^ {0,3}> ?(.*)$/;

/** Only https links are kept as links; any other target is text (the api refuses them too). */
export function safeHref(href: string): string | null {
  return HTTPS.test(href) ? href : null;
}

function findClosing(text: string, from: number, marker: string): number {
  let index = text.indexOf(marker, from);
  while (index !== -1 && text[index - 1] === '\\') index = text.indexOf(marker, index + 1);
  return index;
}

/** Inline content of a block: emphasis, code, links, escapes and hard breaks. */
export function parseInline(text: string): Inline[] {
  const result: Inline[] = [];
  let buffer = '';
  const flush = () => {
    if (buffer) result.push({ type: 'text', value: buffer });
    buffer = '';
  };

  let index = 0;
  while (index < text.length) {
    const char = text.charAt(index);
    const rest = text.slice(index);

    if (char === '\\' && index + 1 < text.length) {
      const next = text.charAt(index + 1);
      if (next === '\n') {
        flush();
        result.push({ type: 'break' });
      } else {
        buffer += next;
      }
      index += 2;
      continue;
    }
    if (char === '\n') {
      // Two spaces before a line end make a hard break; otherwise a soft break is a space.
      if (buffer.endsWith('  ')) {
        buffer = buffer.trimEnd();
        flush();
        result.push({ type: 'break' });
      } else {
        buffer = `${buffer.trimEnd()} `;
      }
      index += 1;
      continue;
    }
    if (char === '`') {
      const close = text.indexOf('`', index + 1);
      if (close > index) {
        flush();
        result.push({ type: 'code', value: text.slice(index + 1, close) });
        index = close + 1;
        continue;
      }
    }
    if (rest.startsWith('**') || rest.startsWith('__')) {
      const marker = rest.slice(0, 2);
      const close = findClosing(text, index + 2, marker);
      if (close > index + 2) {
        flush();
        result.push({ type: 'strong', children: parseInline(text.slice(index + 2, close)) });
        index = close + 2;
        continue;
      }
    }
    if (char === '*' || char === '_') {
      const close = findClosing(text, index + 1, char);
      const inner = close > index + 1 ? text.slice(index + 1, close) : '';
      const wordInside = char === '_' && /\w/.test(text.charAt(index - 1));
      if (inner && !inner.startsWith(' ') && !inner.endsWith(' ') && !wordInside) {
        flush();
        result.push({ type: 'emphasis', children: parseInline(inner) });
        index = close + 1;
        continue;
      }
    }
    if (char === '<') {
      const close = text.indexOf('>', index);
      const href = close > index ? safeHref(text.slice(index + 1, close)) : null;
      if (href) {
        flush();
        result.push({ type: 'link', href, children: [{ type: 'text', value: href }] });
        index = close + 1;
        continue;
      }
    }
    if (char === '[') {
      const label = /^\[([^\]]*)\]\(\s*([^)\s]*)(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)/.exec(rest);
      if (label) {
        const href = safeHref(label[2] ?? '');
        flush();
        const children = parseInline(label[1] ?? '');
        if (href) result.push({ type: 'link', href, children });
        else result.push(...children);
        index += label[0].length;
        continue;
      }
    }
    buffer += char;
    index += 1;
  }
  flush();
  return result;
}

interface ListLine {
  indent: number;
  ordered: boolean;
  start: number;
  text: string;
}

function listLine(line: string): ListLine | null {
  const bullet = BULLET.exec(line);
  if (bullet && !RULE.test(line)) {
    return { indent: bullet[1]?.length ?? 0, ordered: false, start: 1, text: bullet[3] ?? '' };
  }
  const ordered = ORDERED.exec(line);
  if (ordered) {
    return {
      indent: ordered[1]?.length ?? 0,
      ordered: true,
      start: Number(ordered[2]),
      text: ordered[3] ?? '',
    };
  }
  return null;
}

/** A list starting at `lines[from]`, its items holding nested lists; returns the next line. */
function parseList(lines: string[], from: number): [Block, number] {
  const first = listLine(lines[from] ?? '');
  if (!first) throw new Error('parseList called on a line that is not an item');
  const items: Block[][] = [];
  let index = from;
  while (index < lines.length) {
    const item = listLine(lines[index] ?? '');
    if (!item || item.indent !== first.indent || item.ordered !== first.ordered) break;
    const text: string[] = [item.text];
    index += 1;
    const children: Block[] = [];
    while (index < lines.length) {
      const line = lines[index] ?? '';
      if (line.trim() === '') break;
      const nested = listLine(line);
      if (nested && nested.indent > first.indent) {
        const [list, next] = parseList(lines, index);
        children.push(list);
        index = next;
        continue;
      }
      if (nested || !/^ {2,}/.test(line)) {
        // A new item of this list, or a lazy continuation of the paragraph of the item.
        if (nested) break;
        if (HEADING.test(line) || QUOTE.test(line) || RULE.test(line)) break;
      }
      text.push(line.trim());
      index += 1;
    }
    items.push([{ type: 'paragraph', children: parseInline(text.join('\n')) }, ...children]);
  }
  return [{ type: 'list', ordered: first.ordered, start: first.start, items }, index];
}

/** Blocks of a restricted Markdown text. */
export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index] ?? '';
    if (line.trim() === '') {
      index += 1;
      continue;
    }
    if (RULE.test(line)) {
      blocks.push({ type: 'rule' });
      index += 1;
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      blocks.push({
        type: 'heading',
        level: heading[1] === '##' ? 2 : 3,
        children: parseInline(heading[2] ?? ''),
      });
      index += 1;
      continue;
    }
    if (QUOTE.test(line)) {
      const quoted: string[] = [];
      while (index < lines.length && QUOTE.test(lines[index] ?? '')) {
        quoted.push(QUOTE.exec(lines[index] ?? '')?.[1] ?? '');
        index += 1;
      }
      blocks.push({ type: 'quote', children: parseMarkdown(quoted.join('\n')) });
      continue;
    }
    if (listLine(line)) {
      const [list, next] = parseList(lines, index);
      blocks.push(list);
      index = next;
      continue;
    }
    const paragraph: string[] = [];
    while (index < lines.length) {
      const current = lines[index] ?? '';
      if (
        current.trim() === '' ||
        RULE.test(current) ||
        HEADING.test(current) ||
        QUOTE.test(current) ||
        listLine(current)
      )
        break;
      paragraph.push(current);
      index += 1;
    }
    blocks.push({ type: 'paragraph', children: parseInline(paragraph.join('\n')) });
  }
  return blocks;
}
