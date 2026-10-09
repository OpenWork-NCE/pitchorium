/** A region of an image, in pixels of the original (react-easy-crop gives it). */
export interface PixelArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The framed images (direction.md, media module): a square photo or logo, a cover of 4:1; each
 * sent at the size of its largest variant, never below the minimum of its media usage. A logo
 * keeps its transparency (PNG), a photo goes in JPEG.
 */
export const IMAGE_FORMATS = {
  avatar: { aspect: 1, minWidth: 200, targetWidth: 800, usage: 'avatar', type: 'image/jpeg' },
  profile_cover: {
    aspect: 4,
    minWidth: 1200,
    targetWidth: 1584,
    usage: 'profile_cover',
    type: 'image/jpeg',
  },
  organization_logo: {
    aspect: 1,
    minWidth: 200,
    targetWidth: 800,
    usage: 'organization_logo',
    type: 'image/png',
  },
  organization_cover: {
    aspect: 4,
    minWidth: 1200,
    targetWidth: 1584,
    usage: 'organization_cover',
    type: 'image/jpeg',
  },
} as const;

export type ImageKind = keyof typeof IMAGE_FORMATS;

/**
 * Size of the image sent for a cropped region: its own width when it lies between the minimum of
 * the usage and the largest variant, else brought to the nearest bound; the height follows the
 * ratio. A small region is enlarged only up to the minimum the api accepts.
 */
export function outputSize(area: PixelArea, kind: ImageKind): { width: number; height: number } {
  const { aspect, minWidth, targetWidth } = IMAGE_FORMATS[kind];
  const width = Math.round(Math.min(targetWidth, Math.max(minWidth, area.width)));
  return { width, height: Math.round(width / aspect) };
}

/**
 * The cropped region drawn at its output size, encoded in the type of its format: the canvas
 * keeps the pixels only (no EXIF); the api still checks the file and strips its metadata.
 */
export async function cropToBlob(
  image: HTMLImageElement,
  area: PixelArea,
  kind: ImageKind,
): Promise<Blob> {
  const { width, height } = outputSize(area, kind);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('canvas');
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, width, height);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('encode'))),
      IMAGE_FORMATS[kind].type,
      0.9,
    ),
  );
}
