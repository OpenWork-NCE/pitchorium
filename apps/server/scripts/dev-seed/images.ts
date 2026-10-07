import sharp from 'sharp';

export type DemoImageKind = 'avatar' | 'cover' | 'logo' | 'post';

const SIZES: Readonly<Record<DemoImageKind, { width: number; height: number }>> = {
  avatar: { width: 600, height: 600 },
  cover: { width: 1600, height: 400 },
  logo: { width: 600, height: 600 },
  post: { width: 1200, height: 800 },
};

/**
 * Abstract demonstration image (gradient and shapes, no text: no font is needed), PNG,
 * deterministic for a kind, a hue and a variant.
 */
export function demoImage(kind: DemoImageKind, hue: number, variant = 0): Promise<Buffer> {
  const { width, height } = SIZES[kind];
  const second = (hue + 40 + variant * 25) % 360;
  const shapes =
    kind === 'post'
      ? Array.from({ length: 5 }, (_, index) => {
          const x = ((index * 263 + variant * 97) % width) + 40;
          const y = ((index * 151 + variant * 53) % height) + 40;
          return `<circle cx="${x}" cy="${y}" r="${80 + index * 30}" fill="hsl(${(second + index * 30) % 360},70%,60%)" fill-opacity="0.45"/>`;
        }).join('')
      : `<circle cx="${width * 0.7}" cy="${height * 0.35}" r="${Math.min(width, height) * 0.3}" fill="hsl(${second},75%,65%)" fill-opacity="0.5"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${hue},65%,45%)"/>
      <stop offset="1" stop-color="hsl(${second},65%,30%)"/>
    </linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>${shapes}</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
