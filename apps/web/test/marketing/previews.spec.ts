import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { encodePreview } from '../../scripts/marketing-encode.mjs';
import {
  fileName,
  FORMATS,
  heightOf,
  PREVIEW_IDS,
  THEMES,
  widthsOf,
} from '../../scripts/marketing-previews.mjs';
import { PREVIEW_SIZES } from '../../src/features/marketing/lib/previews.generated';

const root = join(import.meta.dirname, '../..');

describe('the previews of the product (pnpm marketing:captures)', () => {
  it('writes each width a capture holds, never an enlargement', () => {
    expect(widthsOf(2560)).toEqual([480, 800, 1200]);
    expect(widthsOf(704)).toEqual([480, 704]);
    expect(widthsOf(400)).toEqual([400]);
    expect(heightOf({ width: 1280, height: 800 }, 480)).toBe(300);
  });

  it('gives the same bytes for the same capture: the images are reproducible', async () => {
    const source = readFileSync(
      join(root, 'public/marketing', fileName('notification', 'light', 480, 'webp')),
    );
    for (const format of FORMATS) {
      const [first, second] = await Promise.all([
        encodePreview(source, 320, format),
        encodePreview(source, 320, format),
      ]);
      expect(first.equals(second)).toBe(true);
    }
  });

  it('has every image the page asks for, in both themes and both formats', () => {
    expect(Object.keys(PREVIEW_SIZES).sort()).toEqual([...PREVIEW_IDS].sort());
    for (const [id, size] of Object.entries(PREVIEW_SIZES)) {
      for (const theme of THEMES) {
        for (const format of FORMATS) {
          for (const width of size.widths) {
            expect(() =>
              readFileSync(join(root, 'public/marketing', fileName(id, theme, width, format))),
            ).not.toThrow();
          }
        }
      }
    }
  });
});
