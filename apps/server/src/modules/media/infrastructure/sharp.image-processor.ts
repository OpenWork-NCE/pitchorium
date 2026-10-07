import { Injectable } from '@nestjs/common';
import sharp from 'sharp';
import { ImageProcessor, type RenderedImage } from '../application/ports';
import type { VariantSpec } from '../domain/usages';

/** Decompression bomb guard: 100 megapixels, above every usage limit. */
const MAX_INPUT_PIXELS = 100_000_000;
const WEBP_QUALITY = 82;
const AVIF_QUALITY = 55;
/** EXIF orientations 5 to 8 rotate by 90 degrees: width and height swap once upright. */
const SWAPPING_ORIENTATIONS = new Set([5, 6, 7, 8]);

const open = (content: Buffer) =>
  sharp(content, { failOn: 'error', limitInputPixels: MAX_INPUT_PIXELS });

/**
 * sharp (libvips). Outputs are re-encoded from pixels: no metadata (EXIF, GPS, XMP, ICC
 * comments) is kept, and the EXIF orientation is applied to the pixels.
 */
@Injectable()
export class SharpImageProcessor extends ImageProcessor {
  async inspect(content: Buffer): Promise<{ width: number; height: number } | null> {
    try {
      const metadata = await open(content).metadata();
      if (!metadata.width || !metadata.height) return null;
      // Decodes the pixels once: a truncated file fails here rather than during rendering.
      await open(content).stats();
      const swap = SWAPPING_ORIENTATIONS.has(metadata.orientation ?? 1);
      return swap
        ? { width: metadata.height, height: metadata.width }
        : { width: metadata.width, height: metadata.height };
    } catch {
      return null;
    }
  }

  async render(content: Buffer, variants: readonly VariantSpec[]): Promise<RenderedImage[]> {
    const rendered: RenderedImage[] = [];
    for (const variant of variants) {
      const upright = open(content)
        .rotate()
        .resize({
          width: variant.width,
          height: variant.height ?? undefined,
          fit: variant.fit,
          withoutEnlargement: variant.fit === 'inside',
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        });
      const webp = await upright
        .clone()
        .webp({ quality: WEBP_QUALITY })
        .toBuffer({ resolveWithObject: true });
      const avif = await upright.clone().avif({ quality: AVIF_QUALITY }).toBuffer();
      rendered.push({
        name: variant.name,
        width: webp.info.width,
        height: webp.info.height,
        webp: webp.data,
        avif,
      });
    }
    return rendered;
  }
}
