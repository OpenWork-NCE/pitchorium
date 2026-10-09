/**
 * Photos are made lighter in the browser before they are sent (ADR 0120): many members publish
 * from a mobile connection where every megabyte counts. The server stays the only judge of the
 * file (real type, antivirus, dimensions, EXIF removed from every variant).
 */

/** Longest side kept: above the largest variant of `post_image` (1 600 wide), for a 4:5 photo. */
export const MAX_DIMENSION = 2048;
/** JPEG quality: no visible loss on a photo at the sizes shown. */
export const JPEG_QUALITY = 0.82;
/** A light enough file within MAX_DIMENSION is sent as it is. */
export const KEEP_BELOW_BYTES = 1_000_000;

/** Size of the image once its longest side is at most `max` (never enlarged). */
export function fittedSize(
  width: number,
  height: number,
  max = MAX_DIMENSION,
): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** Whether a file needs to be made lighter: too heavy, or larger than MAX_DIMENSION. */
export function needsCompression(
  file: { size: number; type: string },
  dimensions: { width: number; height: number },
): boolean {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return false;
  return (
    file.size > KEEP_BELOW_BYTES || Math.max(dimensions.width, dimensions.height) > MAX_DIMENSION
  );
}

/** What the browser offers to draw an image again (injected by the tests). */
export interface CompressionPlatform {
  /** The image decoded with its EXIF orientation applied to the pixels. */
  decode(file: Blob): Promise<{ width: number; height: number; close(): void } & CanvasImageSource>;
  canvas(
    width: number,
    height: number,
  ): {
    getContext(kind: '2d'):
      | (Pick<CanvasRenderingContext2D, 'drawImage' | 'fillRect'> & {
          fillStyle: string | CanvasGradient | CanvasPattern;
        })
      | null;
    toBlob(type: string, quality: number): Promise<Blob | null>;
  };
}

export const browserPlatform: CompressionPlatform = {
  // `from-image`: the orientation written by the camera turns the pixels, as the server does.
  decode: (file) => createImageBitmap(file, { imageOrientation: 'from-image' }),
  canvas: (width, height) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return {
      getContext: (kind) => canvas.getContext(kind),
      toBlob: (type, quality) => new Promise((resolve) => canvas.toBlob(resolve, type, quality)),
    };
  },
};

/**
 * The photo redrawn at most MAX_DIMENSION on its longest side, upright, as a JPEG of
 * JPEG_QUALITY on a white background (a transparent PNG would turn black); the file itself when
 * it is light enough or when the browser cannot redraw it, and when the result is not lighter.
 */
export async function compressImage(
  file: File,
  platform: CompressionPlatform = browserPlatform,
): Promise<File> {
  let bitmap: Awaited<ReturnType<CompressionPlatform['decode']>>;
  try {
    bitmap = await platform.decode(file);
  } catch {
    return file;
  }
  try {
    if (!needsCompression(file, bitmap)) return file;
    const size = fittedSize(bitmap.width, bitmap.height);
    const canvas = platform.canvas(size.width, size.height);
    const context = canvas.getContext('2d');
    if (!context) return file;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, size.width, size.height);
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    const blob = await canvas.toBlob('image/jpeg', JPEG_QUALITY);
    if (!blob || blob.size >= file.size) return file;
    const name = file.name.replace(/\.[^.]+$/, '') || 'photo';
    return new File([blob], `${name}.jpg`, { type: 'image/jpeg', lastModified: file.lastModified });
  } finally {
    bitmap.close();
  }
}
