/** A `@` being typed before the caret: where it starts and what follows it. */
export interface MentionQuery {
  /** Position of the `@`. */
  start: number;
  /** Characters typed after it, lowercase. */
  query: string;
}

/**
 * The mention being typed at the caret, as the api will read it: `@` not preceded by a word, an
 * email or another mention, then letters, digits and hyphens (handles and slugs); null when the
 * caret is elsewhere. The search starts with the first character.
 */
export function mentionQueryAt(text: string, caret: number): MentionQuery | null {
  const before = text.slice(0, caret);
  const match = /(?<![\p{L}\p{N}_@.-])@([\p{L}\p{N}-]{1,60})$/u.exec(before);
  if (!match || match.index === undefined) return null;
  return { start: match.index, query: match[1]!.toLowerCase() };
}

/** The text once the mention is chosen: `@key` and a space in place of what was typed. */
export function insertMention(
  text: string,
  mention: MentionQuery,
  caret: number,
  key: string,
): { text: string; caret: number } {
  const inserted = `@${key} `;
  const after = text.slice(caret).replace(/^\s/, '');
  return {
    text: `${text.slice(0, mention.start)}${inserted}${after}`,
    caret: mention.start + inserted.length,
  };
}
