/** Characters of the opening of a publication shown in a notification. */
export const EXCERPT_MAX_LENGTH = 140;

/**
 * Opening of a text for a notification: its first line breaks folded into spaces, cut at the last
 * word before the limit with an ellipsis; null for an empty text.
 */
export function excerptOf(text: string | null, max = EXCERPT_MAX_LENGTH): string | null {
  const flat = text?.replace(/\s+/gu, ' ').trim() ?? '';
  if (!flat) return null;
  if ([...flat].length <= max) return flat;
  const cut = [...flat].slice(0, max).join('');
  const space = cut.lastIndexOf(' ');
  return `${(space > max / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
}
