import { DomainError } from '../../../platform/kernel';

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
 * The description of a project is restricted Markdown, a subset of CommonMark: paragraphs and
 * line breaks, emphasis and strong emphasis, headings of level 2 and 3, bullet and ordered
 * lists, block quotes, inline code, horizontal rules, and links to https URLs (inline or
 * autolinks). Raw HTML, images, code blocks, link reference definitions and tables are
 * refused, so that the rendering never runs markup or loads third-party content.
 */
export function assertRestrictedMarkdown(text: string): void {
  const withoutAutolinks = text.replace(AUTOLINK, '');
  const forbidden = FORBIDDEN.find(({ pattern }) => pattern.test(withoutAutolinks));
  if (forbidden) throw invalid(forbidden.reason);
  for (const match of withoutAutolinks.matchAll(INLINE_LINK)) {
    const target = match[1] ?? '';
    if (!HTTPS_URL.test(target)) throw invalid('link to a non-https target');
  }
}

function invalid(reason: string): DomainError {
  return new DomainError('PROJECTS_DESCRIPTION_INVALID', `Markdown not allowed: ${reason}`);
}
