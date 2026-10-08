import localFont from 'next/font/local';

/*
 * Fonts of the brand guide (docs/design/typography.md), WOFF2 subsets written by
 * `pnpm brand:sync`. Only the body text (Poppins 400) and the headings (Bricolage Grotesque 800)
 * are preloaded; the fallback metrics of Arial are adjusted to each font to avoid layout shifts.
 */

/** Body text, preloaded. */
export const poppins = localFont({
  src: [{ path: '../../public/fonts/poppins-400.woff2', weight: '400', style: 'normal' }],
  variable: '--font-poppins',
  display: 'swap',
  adjustFontFallback: 'Arial',
  declarations: [{ prop: 'font-family', value: 'Poppins' }],
});

/** Medium and semibold weights of the same family, downloaded when a page uses them. */
export const poppinsStrong = localFont({
  src: [
    { path: '../../public/fonts/poppins-500.woff2', weight: '500', style: 'normal' },
    { path: '../../public/fonts/poppins-600.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-poppins-strong',
  display: 'swap',
  preload: false,
  adjustFontFallback: false,
  declarations: [{ prop: 'font-family', value: 'Poppins' }],
});

export const bricolage = localFont({
  src: [
    { path: '../../public/fonts/bricolage-grotesque-800.woff2', weight: '800', style: 'normal' },
  ],
  variable: '--font-bricolage',
  display: 'swap',
  adjustFontFallback: 'Arial',
});

/** Handwritten accents, rare: never preloaded, downloaded by the pages that use it. */
export const edu = localFont({
  src: [
    { path: '../../public/fonts/edu-au-vic-wa-nt-hand-500.woff2', weight: '500', style: 'normal' },
  ],
  variable: '--font-edu',
  display: 'swap',
  preload: false,
  adjustFontFallback: false,
});

/**
 * Noto Sans for the characters Poppins and Bricolage Grotesque lack (ŋ, ɛ, ɔ, ɓ, ɗ, ƙ, ẹ, ọ…).
 * The unicode-range equals FALLBACK_RANGES of scripts/brand-sync.mjs (checked by a test): the
 * file is downloaded only by a page that contains one of these characters.
 */
export const fallback = localFont({
  src: [
    { path: '../../public/fonts/noto-sans-fallback.woff2', weight: '400 800', style: 'normal' },
  ],
  variable: '--font-fallback',
  display: 'swap',
  preload: false,
  adjustFontFallback: false,
  declarations: [
    {
      prop: 'unicode-range',
      value:
        'U+014A-014B, U+0181, U+0186, U+0189-018A, U+018E-0192, U+0194, U+0198-0199, U+019D, U+01B2-01B4, U+01CD-01DC, U+01F8-01F9, U+0253-0254, U+0256-0257, U+025B, U+0263, U+0272, U+028B, U+0300-036F, U+1E00-1EFF, U+20A3, U+20A6, U+20B5',
    },
  ],
});

export const fontVariables = [
  poppins.variable,
  poppinsStrong.variable,
  bricolage.variable,
  edu.variable,
  fallback.variable,
].join(' ');
