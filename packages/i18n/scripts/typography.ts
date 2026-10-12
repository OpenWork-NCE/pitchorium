export type Tree = { [key: string]: string | Tree };

/**
 * ICU MessageFormat quoting, kept: a doubled apostrophe (a literal one) and a quoted segment
 * that starts with a brace, a hash or a pipe (`'{'`).
 */
const ICU_QUOTING = /''|'[{}#|][^']*'/g;

/**
 * Keys of the texts that hold a straight apostrophe (U+0027): French takes the typographic one
 * (U+2019, docs/design/voice.md), « l’adresse », never « l'adresse ». ICU quoting is not text.
 */
export function straightApostrophes(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    if (typeof value !== 'string') return straightApostrophes(value, `${prefix}${key}.`);
    return value.replace(ICU_QUOTING, '').includes("'") ? [`${prefix}${key}`] : [];
  });
}

/** A breakable space before « : ; ! ? » or inside guillemets (« », U+00AB and U+00BB). */
const BREAKABLE_SPACE = / [:;!?»]|« /;

/**
 * Keys of the texts with a breakable space where French typography wants a non-breaking one
 * (U+00A0, docs/design/voice.md): before « : ; ! ? » and inside guillemets, so that a line never
 * starts with a colon or a closing guillemet.
 */
export function breakableSpaces(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    if (typeof value !== 'string') return breakableSpaces(value, `${prefix}${key}.`);
    return BREAKABLE_SPACE.test(value) ? [`${prefix}${key}`] : [];
  });
}
