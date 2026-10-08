const AUTOLINK = /<https:\/\/[^\s<>]+>/g;
const INLINE_LINK = /\[[^\]]*\]\(\s*([^)\s]*)(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)/g;
const HTTPS_URL = /^https:\/\/[^\s]+$/;

/** One reason per forbidden construct; the first one found is reported. */
const FORBIDDEN: readonly { pattern: RegExp; reason: string }[] = [
  { pattern: /<[A-Za-z!/?]/, reason: 'raw HTML' },
  { pattern: /!\[/, reason: 'image' },
  { pattern: /^ {0,3}\[[^\]]+\]:/m, reason: 'link reference definition' },
  { pattern: /^ {0,3}(```|~~~)/m, reason: 'fenced code block' },
  { pattern: /^ {0,3}(#|#{4,6})(\s|$)/m, reason: 'heading level other than 2 or 3' },
  { pattern: /^ {0,3}=+\s*$/m, reason: 'level 1 setext heading' },
  { pattern: /(^|\n)[ \t]*\n( {4}|\t)\S/, reason: 'indented code block' },
  { pattern: /^ {0,3}\|.*\|\s*$/m, reason: 'table' },
];

/**
 * Restricted Markdown of the long texts (descriptions of projects and events), a subset of
 * CommonMark: paragraphs and line breaks, emphasis and strong emphasis, headings of level 2
 * and 3, bullet and ordered lists, block quotes, inline code, horizontal rules, and links to
 * https URLs (inline or autolinks). Raw HTML, images, code blocks, link reference definitions
 * and tables are refused, so that the rendering never runs markup or loads third-party
 * content. Returns the reason of the first forbidden construct, null when the text is allowed.
 */
export function restrictedMarkdownViolation(text: string): string | null {
  const withoutAutolinks = text.replace(AUTOLINK, '');
  const forbidden = FORBIDDEN.find(({ pattern }) => pattern.test(withoutAutolinks));
  if (forbidden) return forbidden.reason;
  for (const match of withoutAutolinks.matchAll(INLINE_LINK)) {
    // The group always matches, possibly empty.
    if (!HTTPS_URL.test(String(match[1]))) return 'link to a non-https target';
  }
  return null;
}
