import 'server-only';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { brandColors } from '@/styles/brand';

/** Base images of the brand kit (discreet backgrounds: the official logo is already on them). */
const BACKGROUNDS = {
  openGraph: { file: 'linkedin-light-discreet-1200x627.png', width: 1200, height: 627 },
  twitter: { file: 'x-light-discreet-1600x900.png', width: 1600, height: 900 },
} as const;

export type ShareFormat = keyof typeof BACKGROUNDS;

export function shareImageSize(format: ShareFormat): { width: number; height: number } {
  const { width, height } = BACKGROUNDS[format];
  return { width, height };
}

/**
 * Share image of a page: its text in Bricolage Grotesque 800, violet, in the area the discreet
 * background reserves for text (top left, above the logo).
 */
export async function renderShareImage(format: ShareFormat, text: string): Promise<ImageResponse> {
  const background = BACKGROUNDS[format];
  const [image, font] = await Promise.all([
    readFile(join(process.cwd(), 'assets', 'og', background.file)),
    readFile(join(process.cwd(), 'assets', 'og', 'bricolage-grotesque-800.ttf')),
  ]);
  const scale = background.width / 1200;
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        backgroundImage: `url(data:image/png;base64,${image.toString('base64')})`,
        backgroundSize: '100% 100%',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 52 * scale,
          top: 84 * scale,
          width: 860 * scale,
          fontFamily: 'Bricolage Grotesque',
          fontSize: 54 * scale,
          lineHeight: 1.12,
          color: brandColors.violet,
        }}
      >
        {text}
      </div>
    </div>,
    {
      ...shareImageSize(format),
      fonts: [{ name: 'Bricolage Grotesque', data: font, weight: 800, style: 'normal' }],
    },
  );
}
