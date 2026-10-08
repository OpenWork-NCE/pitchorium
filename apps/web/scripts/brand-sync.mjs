#!/usr/bin/env node
// Rebuilds the brand selection of the web app from the client's kit (docs/design/brand-usage.md).
// The kit (Pitchorium-Identite-Marque/ at the repository root) stays local; every file read from
// it is checked against the SHA-256 of its inventaire.json. Remote fonts are pinned by commit and
// by SHA-256. Writes public/brand, public/fonts, assets/og, the metadata files of src/app and
// src/components/brand/marks.generated.tsx.
//
// Usage: pnpm brand:sync [--kit <path>]
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import subsetFont from 'subset-font';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const kitArg = process.argv.indexOf('--kit');
const kitRoot =
  kitArg > 0
    ? resolve(process.argv[kitArg + 1])
    : resolve(webRoot, '../../Pitchorium-Identite-Marque');

/** Official repository of Google Fonts, at a fixed commit. */
const GOOGLE_FONTS =
  'https://raw.githubusercontent.com/google/fonts/5e8a3ba899557829a76cfdac30fa512bda91d7ca';

/** Fonts absent from the kit: weights 500 and 600 of Poppins, Noto Sans as glyph fallback. */
const REMOTE_FONTS = {
  'Poppins-Medium.ttf': {
    url: `${GOOGLE_FONTS}/ofl/poppins/Poppins-Medium.ttf`,
    sha256: '90373e7d838d32468438fc3e152dca0bdb12edcab99ea639f158790b1ba1fd05',
  },
  'Poppins-SemiBold.ttf': {
    url: `${GOOGLE_FONTS}/ofl/poppins/Poppins-SemiBold.ttf`,
    sha256: 'd3bf1bdaf0550e83da9ac0b1d1d9fe6db086835a83aa28578e609a394b9a0286',
  },
  'NotoSans-Variable.ttf': {
    url: `${GOOGLE_FONTS}/ofl/notosans/NotoSans%5Bwdth,wght%5D.ttf`,
    sha256: 'bfb7bb691513f12e734dc346c03a03f784912432d7e3fa8e56efcf906fe86b3d',
  },
  'NotoSans-OFL.txt': {
    url: `${GOOGLE_FONTS}/ofl/notosans/OFL.txt`,
    sha256: null,
  },
};

/** Files copied from the kit, by destination under public/brand (share image bases: assets/og). */
const BRAND_FILES = {
  'favicon.svg': '02-icones/favicon/favicon.svg',
  'favicon.ico': '02-icones/favicon/favicon.ico',
  'app-icon-dark-180.png': '02-icones/application/pitchorium-app-sombre-180x180.png',
  'app-icon-dark-192.png': '02-icones/application/pitchorium-app-sombre-192x192.png',
  'app-icon-dark-512.png': '02-icones/application/pitchorium-app-sombre-512x512.png',
  'photo-cartouche-light.svg': '01-logos/photographie/pitchorium-photo-cartouche-clair.svg',
  'photo-cartouche-dark.svg': '01-logos/photographie/pitchorium-photo-cartouche-sombre.svg',
  'background-desktop-light-discreet.svg':
    '03-backgrounds/desktop-16-9/pitchorium-desktop-16-9-light-discret.svg',
  'background-desktop-dark-discreet.svg':
    '03-backgrounds/desktop-16-9/pitchorium-desktop-16-9-dark-discret.svg',
  'background-mobile-light-discreet.svg':
    '03-backgrounds/mobile-9-16/pitchorium-mobile-9-16-light-discret.svg',
  'background-mobile-dark-discreet.svg':
    '03-backgrounds/mobile-9-16/pitchorium-mobile-9-16-dark-discret.svg',
  'overlay-desktop.svg': '03-backgrounds/desktop-16-9/pitchorium-desktop-16-9-overlay.svg',
  'overlay-mobile.svg': '03-backgrounds/mobile-9-16/pitchorium-mobile-9-16-overlay.svg',
  '../../assets/og/linkedin-light-discreet-1200x627.png':
    '03-backgrounds/linkedin/pitchorium-linkedin-light-discret-1200x627.png',
  '../../assets/og/linkedin-dark-discreet-1200x627.png':
    '03-backgrounds/linkedin/pitchorium-linkedin-dark-discret-1200x627.png',
  '../../assets/og/x-light-discreet-1600x900.png':
    '03-backgrounds/x/pitchorium-x-light-discret-1600x900.png',
  '../../assets/og/x-dark-discreet-1600x900.png':
    '03-backgrounds/x/pitchorium-x-dark-discret-1600x900.png',
};

/** Next.js metadata file conventions, copied into src/app. */
const APP_FILES = {
  'favicon.ico': '02-icones/favicon/favicon.ico',
  'icon.svg': '02-icones/favicon/favicon.svg',
  'apple-icon.png': '02-icones/application/pitchorium-app-sombre-180x180.png',
};

/**
 * Marks rendered inline (one SVG for both themes): the light and dark variants of the kit only
 * swap violet and brand white, which the script checks before generating them.
 */
const MARKS = {
  HorizontalMark: {
    light: '01-logos/horizontal/pitchorium-horizontal-couleur.svg',
    dark: '01-logos/horizontal/pitchorium-horizontal-fond-sombre.svg',
  },
  SymbolMark: {
    light: '01-logos/symbole/pitchorium-symbole-couleur.svg',
    dark: '01-logos/symbole/pitchorium-symbole-fond-sombre.svg',
  },
  MicroMark: {
    light: '02-icones/micro/pitchorium-micro-violet.svg',
    dark: '02-icones/micro/pitchorium-micro-blanc.svg',
  },
};

const VIOLET = '#3e285d';
const COPPER = '#ca8764';
const WHITE = '#F7F7F5';

/** Latin, Latin Extended, combining marks, Latin Extended Additional, punctuation, currencies. */
const TEXT_RANGES = [
  [0x0020, 0x024f],
  [0x0250, 0x02ff],
  [0x0300, 0x036f],
  [0x1e00, 0x1eff],
  [0x2000, 0x206f],
  [0x20a0, 0x20c0],
  [0x2100, 0x214f],
  [0x2190, 0x2193],
  [0x2212, 0x2212],
  [0xfeff, 0xfeff],
  [0xfffd, 0xfffd],
];

/** Latin-1 and the typographic punctuation of French and English. */
const ACCENT_RANGES = [
  [0x0020, 0x007e],
  [0x00a0, 0x00ff],
  [0x0152, 0x0153],
  [0x0178, 0x0178],
  [0x2013, 0x2014],
  [0x2018, 0x201e],
  [0x2022, 0x2022],
  [0x2026, 0x2026],
  [0x20ac, 0x20ac],
];

/**
 * Characters of the supported languages and African proper names that Poppins or Bricolage
 * Grotesque lack (docs/design/typography.md): served by the Noto Sans subset, through its
 * unicode-range, only when a page contains one of them.
 */
const FALLBACK_RANGES = [
  [0x014a, 0x014b],
  [0x0181, 0x0181],
  [0x0186, 0x0186],
  [0x0189, 0x018a],
  [0x018e, 0x0192],
  [0x0194, 0x0194],
  [0x0198, 0x0199],
  [0x019d, 0x019d],
  [0x01b2, 0x01b4],
  [0x01cd, 0x01dc],
  [0x01f8, 0x01f9],
  [0x0253, 0x0254],
  [0x0256, 0x0257],
  [0x025b, 0x025b],
  [0x0263, 0x0263],
  [0x0272, 0x0272],
  [0x028b, 0x028b],
  [0x0300, 0x036f],
  [0x1e00, 0x1eff],
  [0x20a3, 0x20a3],
  [0x20a6, 0x20a6],
  [0x20b5, 0x20b5],
];

const FONTS = [
  {
    output: 'poppins-400.woff2',
    source: { kit: '05-polices/Poppins/Poppins-Regular.ttf' },
    ranges: TEXT_RANGES,
  },
  { output: 'poppins-500.woff2', source: { remote: 'Poppins-Medium.ttf' }, ranges: TEXT_RANGES },
  { output: 'poppins-600.woff2', source: { remote: 'Poppins-SemiBold.ttf' }, ranges: TEXT_RANGES },
  {
    output: 'bricolage-grotesque-800.woff2',
    source: { kit: '05-polices/Bricolage-Grotesque/BricolageGrotesque-800.ttf' },
    ranges: TEXT_RANGES,
    // Instance of the kit: normal width, display optical size (its default of 96).
    axes: { wdth: 100, opsz: 96 },
  },
  {
    // Share images (next/og): Satori reads TrueType, not WOFF2. Not served to browsers.
    output: '../../assets/og/bricolage-grotesque-800.ttf',
    source: { kit: '05-polices/Bricolage-Grotesque/BricolageGrotesque-800.ttf' },
    ranges: ACCENT_RANGES,
    axes: { wdth: 100, opsz: 96 },
    format: 'sfnt',
  },
  {
    output: 'edu-au-vic-wa-nt-hand-500.woff2',
    source: { kit: '05-polices/Edu-AU-VIC-WA-NT-Hand/EduAUVICWANTHand-Variable.ttf' },
    // Rare accents only (brand guide): Latin-1 and typographic punctuation.
    ranges: ACCENT_RANGES,
    axes: { wght: 500 },
  },
  {
    output: 'noto-sans-fallback.woff2',
    source: { remote: 'NotoSans-Variable.ttf' },
    ranges: FALLBACK_RANGES,
    axes: { wdth: 100, wght: { min: 400, max: 800 } },
  },
];

const LICENSES = {
  'OFL-Poppins.txt': { kit: '05-polices/Poppins/OFL.txt' },
  'OFL-Bricolage-Grotesque.txt': { kit: '05-polices/Bricolage-Grotesque/OFL.txt' },
  'OFL-Edu-AU-VIC-WA-NT-Hand.txt': { kit: '05-polices/Edu-AU-VIC-WA-NT-Hand/OFL.txt' },
  'OFL-Noto-Sans.txt': { remote: 'NotoSans-OFL.txt' },
};

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');

async function loadInventory() {
  let raw;
  try {
    raw = await readFile(join(kitRoot, 'inventaire.json'), 'utf8');
  } catch {
    throw new Error(`Brand kit not found at ${kitRoot}: it stays local (AGENTS.md), ask for it.`);
  }
  const inventory = JSON.parse(raw);
  return new Map(inventory.fichiers.map((entry) => [entry.fichier, entry.sha256]));
}

async function readKit(inventory, relative) {
  const expected = inventory.get(relative);
  if (!expected) throw new Error(`${relative} is not listed in inventaire.json`);
  const buffer = await readFile(join(kitRoot, relative));
  if (sha256(buffer) !== expected)
    throw new Error(`${relative}: SHA-256 differs from inventaire.json`);
  return buffer;
}

const remoteCache = new Map();
async function readRemote(name) {
  if (remoteCache.has(name)) return remoteCache.get(name);
  const { url, sha256: expected } = REMOTE_FONTS[name];
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (expected && sha256(buffer) !== expected) throw new Error(`${name}: unexpected SHA-256`);
  remoteCache.set(name, buffer);
  return buffer;
}

const readSource = (inventory, source) =>
  source.kit ? readKit(inventory, source.kit) : readRemote(source.remote);

/** Removes the title, the description and the whitespace between tags; geometry is untouched. */
function compactSvg(svg) {
  return svg
    .replace(/<desc>[\s\S]*?<\/desc>/, '')
    .replace(/>\s+</g, '><')
    .trim();
}

function textOf(range) {
  let text = '';
  for (const [start, end] of range) {
    for (let code = start; code <= end; code += 1) text += String.fromCodePoint(code);
  }
  return text;
}

/** Inner elements of a kit SVG, background rectangles excluded. */
function markBody(svg) {
  return svg
    .replace(/^[\s\S]*?<\/desc>/, '')
    .replace(/<\/svg>\s*$/, '')
    .replace(/<rect[^>]*\/>/g, '')
    .replace(/>\s+</g, '><')
    .trim();
}

/** Converts the small SVG grammar of the kit (g, path, circle) into JSX with tone classes. */
function toJsx(body) {
  return body
    .replace(/fill="([^"]+)"/g, (_, color) => {
      const value = color.toLowerCase();
      if (value === COPPER) return 'className="brand-accent"';
      if (value === VIOLET) return 'className="brand-ink"';
      throw new Error(`Unexpected fill ${color} in a mark`);
    })
    .replace(/<(path|circle)([^>]*)\/>/g, '<$1$2 />')
    .replace(/></g, '>\n      <');
}

async function generateMarks(inventory) {
  const components = [];
  for (const [name, { light, dark }] of Object.entries(MARKS)) {
    const lightSvg = (await readKit(inventory, light)).toString('utf8');
    const darkSvg = (await readKit(inventory, dark)).toString('utf8');
    const lightBody = markBody(lightSvg);
    if (lightBody.replaceAll(VIOLET, 'INK') !== markBody(darkSvg).replaceAll(WHITE, 'INK')) {
      throw new Error(`${name}: the dark variant is not the light one with violet as brand white`);
    }
    const viewBox = /viewBox="([^"]+)"/.exec(lightSvg)[1];
    components.push(`/** ${light} (light) and ${dark} (dark). */
export const ${name} = {
  viewBox: '${viewBox}',
  body: (
    <>
      ${toJsx(lightBody)}
    </>
  ),
};`);
  }
  const source = `// Generated by scripts/brand-sync.mjs from the official SVG files of the brand kit. Do not edit:
// the geometry, the proportions and the palette of the marks must stay those of the kit.
// Tones: .brand-ink is violet on a light background and brand white on a dark one,
// .brand-accent is copper in both.

${components.join('\n\n')}
`;
  const target = join(webRoot, 'src/components/brand/marks.generated.tsx');
  await writeFile(target, source);
  return target;
}

async function main() {
  const inventory = await loadInventory();
  const brandDir = join(webRoot, 'public/brand');
  const fontsDir = join(webRoot, 'public/fonts');
  await rm(brandDir, { recursive: true, force: true });
  await rm(fontsDir, { recursive: true, force: true });
  await mkdir(brandDir, { recursive: true });
  await mkdir(fontsDir, { recursive: true });
  await mkdir(join(webRoot, 'assets/og'), { recursive: true });

  for (const [target, relative] of Object.entries(BRAND_FILES)) {
    const buffer = await readKit(inventory, relative);
    const output = target.endsWith('.svg') ? compactSvg(buffer.toString('utf8')) : buffer;
    await writeFile(join(brandDir, target), output);
  }
  for (const [target, relative] of Object.entries(APP_FILES)) {
    await readKit(inventory, relative);
    await copyFile(join(kitRoot, relative), join(webRoot, 'src/app', target));
  }

  for (const font of FONTS) {
    const source = await readSource(inventory, font.source);
    const output = await subsetFont(source, textOf(font.ranges), {
      targetFormat: font.format ?? 'woff2',
      ...(font.axes ? { variationAxes: font.axes } : {}),
    });
    await writeFile(join(fontsDir, font.output), output);
    process.stdout.write(`${font.output.replace('../../', '')}: ${output.length} bytes\n`);
  }
  for (const [target, source] of Object.entries(LICENSES)) {
    await writeFile(join(fontsDir, target), await readSource(inventory, source));
  }

  const marks = await generateMarks(inventory);
  process.stdout.write(
    `Brand selection written: ${Object.keys(BRAND_FILES).length} files in public/brand, ` +
      `${FONTS.length} fonts, ${marks}.\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
