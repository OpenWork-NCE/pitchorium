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
 * background reserves for text (top left, above the logo); a resource adds a line under its name
 * (a title, a type of structure).
 */
export async function renderShareImage(
  format: ShareFormat,
  text: string,
  subtitle?: string | null,
): Promise<ImageResponse> {
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
          display: 'flex',
          flexDirection: 'column',
          gap: 18 * scale,
        }}
      >
        <div style={{ display: 'flex' }}>{text}</div>
        {subtitle ? (
          <div style={{ display: 'flex', fontSize: 32 * scale, lineHeight: 1.2 }}>{subtitle}</div>
        ) : null}
      </div>
    </div>,
    {
      ...shareImageSize(format),
      fonts: [{ name: 'Bricolage Grotesque', data: font, weight: 800, style: 'normal' }],
    },
  );
}

/** What the share image of a project shows: its visual, title and the state of its funding. */
export interface ProjectShare {
  title: string;
  /** Public address of its visual, null without one. */
  imageUrl: string | null;
  /** Share of the goal collected, 0 to 1 (may exceed 1, the bar stops at the end). */
  progress: number | null;
  /** « 12 500 € collectés sur 20 000 € · 62 % », already worded. */
  fundingText: string | null;
}

/**
 * Share image of a project (§11.2): its visual on the right in a rounded frame, its title in
 * Bricolage Grotesque 800, the bar of its funding in violet and its amounts, on the discreet
 * background of the brand that carries the logo.
 */
export async function renderProjectShareImage(
  format: ShareFormat,
  project: ProjectShare,
): Promise<ImageResponse> {
  const background = BACKGROUNDS[format];
  const [image, font] = await Promise.all([
    readFile(join(process.cwd(), 'assets', 'og', background.file)),
    readFile(join(process.cwd(), 'assets', 'og', 'bricolage-grotesque-800.ttf')),
  ]);
  const scale = background.width / 1200;
  const textWidth = (project.imageUrl ? 600 : 860) * scale;
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
          width: textWidth,
          fontFamily: 'Bricolage Grotesque',
          color: brandColors.violet,
          display: 'flex',
          flexDirection: 'column',
          gap: 24 * scale,
        }}
      >
        <div style={{ display: 'flex', fontSize: 50 * scale, lineHeight: 1.1 }}>
          {project.title.length > 90 ? `${project.title.slice(0, 87)}…` : project.title}
        </div>
        {project.progress !== null ? (
          <div
            style={{
              display: 'flex',
              width: textWidth,
              height: 14 * scale,
              borderRadius: 7 * scale,
              // The violet of the brand, faint: the rail of the bar.
              backgroundColor: `${brandColors.violet}29`,
            }}
          >
            <div
              style={{
                display: 'flex',
                width: `${Math.round(Math.min(1, project.progress) * 100)}%`,
                height: '100%',
                borderRadius: 7 * scale,
                backgroundColor: brandColors.violet,
              }}
            />
          </div>
        ) : null}
        {project.fundingText ? (
          <div style={{ display: 'flex', fontSize: 28 * scale, lineHeight: 1.2 }}>
            {project.fundingText}
          </div>
        ) : null}
      </div>
      {project.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={project.imageUrl}
          alt=""
          width={440 * scale}
          height={330 * scale}
          style={{
            position: 'absolute',
            right: 52 * scale,
            top: 84 * scale,
            objectFit: 'cover',
            borderRadius: 24 * scale,
          }}
        />
      ) : null}
    </div>,
    {
      ...shareImageSize(format),
      fonts: [{ name: 'Bricolage Grotesque', data: font, weight: 800, style: 'normal' }],
    },
  );
}
