import type { Mention } from '@pitchorium/contracts';

/** A piece of the text of a publication as it is shown. */
export type TextSegment =
  | { kind: 'text'; text: string }
  | { kind: 'mention'; text: string; mention: Mention }
  | { kind: 'link'; text: string; href: string };

/** An address of the text: http or https, without the punctuation that closes a sentence. */
const URL = /https?:\/\/[^\s<>"]+[^\s<>".,;:!?)\]'»]/gi;

/**
 * The text of a publication cut in segments: plain text, the mentions the api resolved (a link
 * to their page; an unresolved `@word` stays text) and the addresses (links to outside).
 */
export function textSegments(text: string, mentions: readonly Mention[]): TextSegment[] {
  const tokens = new Map(mentions.map((mention) => [mention.token.toLowerCase(), mention]));
  const mentionPattern = mentions.length
    ? mentions.map((mention) => mention.token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
    : null;
  const pattern = new RegExp(
    mentionPattern
      ? `${URL.source}|(?<![\\p{L}\\p{N}_@.-])(?:${mentionPattern})(?![a-z0-9_-])`
      : URL.source,
    'giu',
  );
  const segments: TextSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > last) segments.push({ kind: 'text', text: text.slice(last, start) });
    const value = match[0];
    const mention = tokens.get(value.toLowerCase());
    segments.push(
      mention
        ? { kind: 'mention', text: value, mention }
        : { kind: 'link', text: value, href: value },
    );
    last = start + value.length;
  }
  if (last < text.length) segments.push({ kind: 'text', text: text.slice(last) });
  return segments;
}

/** The first address of a text, for the preview of a link (composer). */
export function firstUrl(text: string): string | null {
  const match = new RegExp(URL.source, 'i').exec(text);
  return match ? match[0] : null;
}
