import type { CatalogTree } from './catalogs.js';

/**
 * Pseudo-localization of the catalogues, for the tests of the web app only (never an active
 * locale): every text is 40 % longer, its letters accented, and it is framed by brackets. A text
 * of the interface that is not framed was written outside the catalogues; a frame cut short shows
 * a text cut by its container; the longer text shows what overflows.
 */
const ACCENTED: Record<string, string> = {
  a: 'á',
  b: 'ƀ',
  c: 'ç',
  d: 'ď',
  e: 'é',
  f: 'ƒ',
  g: 'ĝ',
  h: 'ĥ',
  i: 'î',
  j: 'ĵ',
  k: 'ķ',
  l: 'ļ',
  m: 'ḿ',
  n: 'ñ',
  o: 'ö',
  p: 'þ',
  q: 'ǫ',
  r: 'ŕ',
  s: 'š',
  t: 'ţ',
  u: 'û',
  v: 'ṽ',
  w: 'ŵ',
  x: 'ẋ',
  y: 'ý',
  z: 'ž',
  A: 'Å',
  B: 'Ɓ',
  C: 'Ç',
  D: 'Ď',
  E: 'É',
  F: 'Ƒ',
  G: 'Ĝ',
  H: 'Ĥ',
  I: 'Î',
  J: 'Ĵ',
  K: 'Ķ',
  L: 'Ļ',
  M: 'Ḿ',
  N: 'Ñ',
  O: 'Ö',
  P: 'Þ',
  Q: 'Ǫ',
  R: 'Ŕ',
  S: 'Š',
  T: 'Ţ',
  U: 'Û',
  V: 'Ṽ',
  W: 'Ŵ',
  X: 'Ẋ',
  Y: 'Ý',
  Z: 'Ž',
};

/** Opening and closing marks of a pseudo-localized text. */
export const PSEUDO_OPEN = '[';
export const PSEUDO_CLOSE = ']';

/** Share of length added to every text. */
export const PSEUDO_EXPANSION = 0.4;

/** Words of the padding: short, so that the longer text still wraps where a sentence would. */
const PADDING = ['ļöŕéḿ', 'îþšûḿ', 'ďöļöŕ', 'šîţ', 'áḿéţ', 'çöñšé'];

/** Parameters (`{{name}}`) and rich tags (`<link>`, `</link>`) stay as they are. */
const SYNTAX = /(\{\{\w+\}\}|<\/?[a-zA-Z][a-zA-Z0-9]*>)/;

function accent(text: string): string {
  return [...text].map((character) => ACCENTED[character] ?? character).join('');
}

function padding(length: number): string {
  let result = '';
  for (let index = 0; result.length < length; index += 1) {
    result += ` ${PADDING[index % PADDING.length]}`;
  }
  return result.slice(0, Math.max(length, 0));
}

/** One text: accented, 40 % longer (its parameters and tags not counted), framed. */
export function pseudoLocalize(text: string): string {
  if (text.trim() === '') return text;
  const parts = text.split(SYNTAX);
  const visible = parts.filter((_, index) => index % 2 === 0).join('').length;
  const body = parts.map((part, index) => (index % 2 === 0 ? accent(part) : part)).join('');
  return `${PSEUDO_OPEN}${body}${padding(Math.ceil(visible * PSEUDO_EXPANSION))}${PSEUDO_CLOSE}`;
}

/** Every text of a catalogue tree, pseudo-localized. */
export function pseudoLocalizeTree(tree: CatalogTree): CatalogTree {
  return Object.fromEntries(
    Object.entries(tree).map(([key, value]) => [
      key,
      typeof value === 'string' ? pseudoLocalize(value) : pseudoLocalizeTree(value),
    ]),
  );
}
