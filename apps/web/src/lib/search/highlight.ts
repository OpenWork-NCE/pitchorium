/** Lower case without diacritics: « Énergie » and « energie » compare equal. */
export function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

export interface TextPart {
  text: string;
  match: boolean;
}

/**
 * The parts of a title that match the words of a query, accents and case ignored, for the
 * highlight of a search result: a word of the query matches the start of a word of the title (the
 * api searches by prefix, ADR 0066). A result found despite a typo has no part to highlight.
 */
export function highlightParts(text: string, query: string): TextPart[] {
  const terms = fold(query)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((term) => term.length > 0);
  if (terms.length === 0) return [{ text, match: false }];
  // Folding keeps one character per character of a letter in Latin scripts once marks are
  // removed; map positions on the folded text back through the original characters.
  const chars = [...text];
  const folded = chars.map((char) => fold(char));
  const marks = new Array<boolean>(chars.length).fill(false);
  for (let start = 0; start < chars.length; start++) {
    const atWordStart = start === 0 || !/[\p{L}\p{N}]/u.test(chars[start - 1] ?? '');
    if (!atWordStart) continue;
    for (const term of terms) {
      let index = start;
      let consumed = '';
      while (index < chars.length && consumed.length < term.length) {
        consumed += folded[index];
        index++;
      }
      if (consumed.startsWith(term)) {
        for (let at = start; at < index; at++) marks[at] = true;
      }
    }
  }
  const parts: TextPart[] = [];
  chars.forEach((char, index) => {
    const match = marks[index] ?? false;
    const last = parts.at(-1);
    if (last && last.match === match) last.text += char;
    else parts.push({ text: char, match });
  });
  return parts;
}
