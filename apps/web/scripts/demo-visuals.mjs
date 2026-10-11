#!/usr/bin/env node
// Visuals of the demonstration data (ADR 0160): the images of the projects, of their updates, of
// the publications and the cover of an organisation of the stub api, drawn from the shapes of the
// brand (the heads and the shoulders of its three figures: circles and crescents) in its palette,
// varied by sector, sober, without text. Written once into e2e/support/demo-visuals as PNG files,
// versioned as demonstration resources: never served by the production build (the stub api only).
//
// Usage: pnpm --filter @pitchorium/web demo:visuals
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(webRoot, 'e2e/support/demo-visuals');

/** The palette of the brand guide and its tints (docs/design/tokens.md). */
const C = {
  violet: '#3e285d',
  deep: '#2c1c44',
  lavender: '#b8a9d3',
  pale: '#eae4f2',
  copper: '#ca8764',
  sand: '#ecd2c2',
  ink: '#121212',
  white: '#f7f7f5',
};

/** A pseudo-random sequence fixed by its seed: the same file at every run. */
function random(seed) {
  // Spread the small seeds apart (Knuth's multiplicative hash), then a few steps of warm-up.
  let state = Math.imul(seed + 1, 0x9e37_79b1) >>> 0;
  for (let step = 0; step < 4; step += 1) state = (state * 1_664_525 + 1_013_904_223) >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

const circle = (cx, cy, r, fill, opacity = 1) =>
  `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="${fill}" fill-opacity="${opacity}"/>`;

/** A shoulder of a figure: the crescent between two circles, opened upward. */
const crescent = (cx, cy, r, fill, opacity = 1) => {
  const inner = r * 0.62;
  return `<path d="M ${(cx - r).toFixed(1)} ${cy.toFixed(1)} A ${r} ${r} 0 0 0 ${(cx + r).toFixed(1)} ${cy.toFixed(1)} L ${(cx + inner).toFixed(1)} ${cy.toFixed(1)} A ${inner} ${inner} 0 0 1 ${(cx - inner).toFixed(1)} ${cy.toFixed(1)} Z" fill="${fill}" fill-opacity="${opacity}"/>`;
};

/** Compositions by sector, on a canvas of the given size. */
const SECTORS = {
  // A copper sun over fields of violet crescents.
  energy(w, h, next) {
    const shapes = [`<rect width="${w}" height="${h}" fill="${C.pale}"/>`];
    const sunX = w * (0.15 + next() * 0.7);
    const sunR = h * (0.14 + next() * 0.1);
    shapes.push(circle(sunX, h * 0.32, sunR * 1.6, C.copper, 0.18));
    shapes.push(circle(sunX, h * 0.32, sunR, C.copper));
    const shift = next() * w * 0.2;
    const top = 0.56 + next() * 0.1;
    for (let row = 0; row < 4; row += 1) {
      const y = h * (top + row * 0.13);
      for (let x = -w * 0.2; x < w * 1.1; x += w * 0.22) {
        shapes.push(
          crescent(x + shift + row * w * 0.07, y, w * 0.11, row % 2 ? C.violet : C.lavender),
        );
      }
    }
    return shapes;
  },
  // Furrows of crescents, the harvest as copper circles.
  agriculture_forestry_fishing(w, h, next) {
    const shapes = [`<rect width="${w}" height="${h}" fill="${C.white}"/>`];
    for (let row = 0; row < 6; row += 1) {
      const y = h * (0.18 + row * 0.17);
      for (let x = -w * 0.05; x < w * 1.1; x += w * 0.16) {
        shapes.push(
          crescent(x + (row % 2) * w * 0.08, y, w * 0.075, row < 3 ? C.lavender : C.violet),
        );
      }
    }
    for (let index = 0; index < 5; index += 1) {
      shapes.push(circle(w * (0.1 + next() * 0.8), h * (0.12 + next() * 0.7), h * 0.045, C.copper));
    }
    return shapes;
  },
  // Waves of open arcs under a low copper circle.
  fishing(w, h, next) {
    const shapes = [`<rect width="${w}" height="${h}" fill="${C.deep}"/>`];
    shapes.push(circle(w * (0.25 + next() * 0.1), h * 0.36, h * 0.16, C.copper));
    for (let row = 0; row < 5; row += 1) {
      const y = h * (0.55 + row * 0.11);
      for (let x = -w * 0.1; x < w * 1.1; x += w * 0.2) {
        shapes.push(
          crescent(x + (row % 2) * w * 0.1, y, w * 0.1, row % 2 ? C.lavender : C.violet, 0.9),
        );
      }
    }
    return shapes;
  },
  // Three figures rising, as on the elevation motif: learning and growth.
  education(w, h, next) {
    const shapes = [`<rect width="${w}" height="${h}" fill="${C.pale}"/>`];
    for (let index = 0; index < 3; index += 1) {
      const cx = w * (0.28 + index * 0.22);
      const base = h * (0.95 - index * 0.12 - next() * 0.04);
      // The head sits in the opening of the shoulders, as in the figures of the brand.
      const r = h * 0.22;
      shapes.push(crescent(cx, base - h * 0.25, r, index === 0 ? C.copper : C.violet));
      shapes.push(
        circle(cx, base - h * 0.25 - r * 0.12, r * 0.4, index === 0 ? C.copper : C.violet),
      );
    }
    return shapes;
  },
  // Interlocking circles: a network of artisans, a cooperative.
  manufacturing(w, h, next) {
    const shapes = [`<rect width="${w}" height="${h}" fill="${C.white}"/>`];
    for (let index = 0; index < 9; index += 1) {
      const cx = w * (0.1 + (index % 5) * 0.2 + next() * 0.05);
      const cy = h * (0.3 + Math.floor(index / 5) * 0.4 + next() * 0.05);
      shapes.push(circle(cx, cy, h * 0.18, index % 3 === 0 ? C.copper : C.lavender, 0.75));
    }
    return shapes;
  },
  // A document: blocks of a page, no text.
  document(w, h) {
    return [
      `<rect width="${w}" height="${h}" fill="${C.white}"/>`,
      `<rect x="${w * 0.1}" y="${h * 0.08}" width="${w * 0.8}" height="${h * 0.14}" rx="8" fill="${C.violet}"/>`,
      ...[0, 1, 2, 3, 4, 5].map(
        (line) =>
          `<rect x="${w * 0.1}" y="${h * (0.3 + line * 0.07)}" width="${w * (line % 3 === 2 ? 0.55 : 0.8)}" height="${h * 0.025}" rx="4" fill="${C.lavender}"/>`,
      ),
      crescent(w * 0.72, h * 0.9, w * 0.14, C.copper),
      circle(w * 0.72, h * 0.72, w * 0.06, C.copper),
    ];
  },
};

/**
 * The visuals written, by file name: the sector of their project (or of their subject) and their
 * size. The alternative texts that describe them are in the stub api.
 */
const VISUALS = {
  'project-1.png': { sector: 'energy', width: 640, height: 400, seed: 1 },
  'project-2.png': { sector: 'energy', width: 640, height: 400, seed: 2 },
  'project-3.png': { sector: 'energy', width: 640, height: 400, seed: 3 },
  'project-4.png': { sector: 'energy', width: 640, height: 400, seed: 4 },
  'project-5.png': { sector: 'agriculture_forestry_fishing', width: 640, height: 400, seed: 5 },
  'project-6.png': { sector: 'agriculture_forestry_fishing', width: 640, height: 400, seed: 6 },
  'project-7.png': { sector: 'fishing', width: 640, height: 400, seed: 7 },
  'project-8.png': { sector: 'manufacturing', width: 640, height: 400, seed: 8 },
  'post-0.png': { sector: 'agriculture_forestry_fishing', width: 640, height: 400, seed: 10 },
  'post-1.png': { sector: 'energy', width: 640, height: 400, seed: 11 },
  'post-2.png': { sector: 'agriculture_forestry_fishing', width: 640, height: 400, seed: 12 },
  'post-3.png': { sector: 'energy', width: 640, height: 400, seed: 13 },
  'post-4.png': { sector: 'education', width: 640, height: 400, seed: 14 },
  'link-3.png': { sector: 'education', width: 640, height: 400, seed: 15 },
  'organization-cover-1.png': { sector: 'education', width: 1600, height: 400, seed: 16 },
  'document-portrait-1.png': { sector: 'document', width: 480, height: 600, seed: 17 },
};

function svgOf({ sector, width, height, seed }) {
  const shapes = SECTORS[sector](width, height, random(seed));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${shapes.join('')}</svg>`;
}

async function main() {
  await mkdir(output, { recursive: true });
  for (const [name, visual] of Object.entries(VISUALS)) {
    const png = await sharp(Buffer.from(svgOf(visual)))
      .png({ compressionLevel: 9, palette: true, colours: 64 })
      .toBuffer();
    await writeFile(join(output, name), png);
    process.stdout.write(`${name}: ${png.length} bytes\n`);
  }
}

await main();
