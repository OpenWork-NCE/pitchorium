// Previews of the product for the public site (docs/design/marketing-captures.md, ADR 0162): the
// sections of the application captured by `pnpm marketing:captures`, and how each capture becomes
// the images of public/marketing. Pure: read by the capture (e2e/marketing), by the encoder
// (scripts/marketing-encode.mjs) and by its test (test/marketing/previews.spec.ts).

/** The sections captured, by id, in both themes. */
export const PREVIEW_IDS = [
  'funding',
  'project-page',
  'suggestion',
  'conversation',
  'notification',
  'dashboard',
];
export const THEMES = ['light', 'dark'];
/** Widths written for each capture (CSS pixels of a 2x capture: at most its own width). */
export const WIDTHS = [480, 800, 1200];
export const FORMATS = ['avif', 'webp'];
/** Scale of the captures: sharp on the screens of high density. */
export const SCALE = 2;

/** The widths of a capture `rawWidth` pixels wide: those of WIDTHS it holds, and its own. */
export function widthsOf(rawWidth) {
  const widths = WIDTHS.filter((width) => width < rawWidth);
  return widths.length === WIDTHS.length ? widths : [...widths, rawWidth];
}

/** The file of one image: public/marketing/<id>-<theme>-<width>.<format>. */
export const fileName = (id, theme, width, format) => `${id}-${theme}-${width}.${format}`;

/** The height of an image of `width` pixels, from the size of its capture (ratio kept). */
export const heightOf = (raw, width) => Math.round((raw.height * width) / raw.width);
