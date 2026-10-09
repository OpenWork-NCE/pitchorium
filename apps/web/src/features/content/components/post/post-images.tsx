'use client';

import type { PostImage } from '@pitchorium/contracts';
import { useTranslations } from 'next-intl';
import { lazy, Suspense, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { cn } from '@/lib/cn';
import { useMotionPreference } from '@/components/motion';
import { imageGrid } from '../../lib/image-grid';

/** The viewer and Embla load with the first opening (never in the first load of the feed). */
const loadViewer = () => import('./image-viewer');
const ImageViewer = lazy(loadViewer);

const GRIDS = {
  single: 'grid-cols-1',
  two: 'grid-cols-2',
  three: 'grid-cols-2 grid-rows-2',
  four: 'grid-cols-2',
} as const;
const RATIOS = { '4/3': 'aspect-4/3', '1/1': 'aspect-square', '4/5': 'aspect-4/5', auto: '' };

/** The smaller variant for a cell of the grid, the larger one otherwise. */
export function imageSource(image: PostImage, cell: 'grid' | 'full'): string {
  const variant = image.variants[cell === 'grid' ? 'medium' : 'large'];
  return variant?.webp ?? image.url;
}

/** Ratio of a single image, bounded between 4:5 and 16:9 (direction.md). */
function singleRatio(image: PostImage): string {
  const large = image.variants['large'];
  if (!large?.width || !large.height) return '4 / 3';
  const ratio = Math.min(16 / 9, Math.max(4 / 5, large.width / large.height));
  return `${ratio}`;
}

/**
 * The images of a publication in a grid adapted to their number (1, 2, 3, 4, then « +N »), each
 * a button that opens the viewer at its place, with its text alternative; loaded when they near
 * the screen, on a quiet background meanwhile. The thumbnail grows a little on hover, in its
 * frame.
 */
export function PostImages({ images, postId }: { images: readonly PostImage[]; postId: string }) {
  const t = useTranslations('web.content.images');
  const [open, setOpen] = useState<number | null>(null);
  const tiles = useRef<(HTMLButtonElement | null)[]>([]);
  const reduced = useMotionPreference() === 'reduced';
  const layout = imageGrid(images.length);
  const show = (index: number) => {
    // A shared transition from the thumbnail where the browser can, without when motion is reduced.
    if ('startViewTransition' in document && !reduced) {
      document.startViewTransition(() => flushSync(() => setOpen(index)));
    } else {
      setOpen(index);
    }
    void loadViewer();
  };
  return (
    <>
      <ul
        aria-label={t('label')}
        className={cn('grid gap-1 overflow-hidden rounded-lg', GRIDS[layout.grid])}
      >
        {layout.cells.map((cell, index) => {
          const image = images[index]!;
          const last = index === layout.shown - 1 && layout.more > 0;
          return (
            <li
              key={image.mediaId}
              className={cn(
                'relative overflow-hidden bg-surface-sunken',
                RATIOS[cell.ratio],
                cell.span === 2 && 'row-span-2',
              )}
              style={layout.grid === 'single' ? { aspectRatio: singleRatio(image) } : undefined}
            >
              <button
                ref={(element) => {
                  tiles.current[index] = element;
                }}
                type="button"
                onClick={() => show(index)}
                onPointerEnter={() => void loadViewer()}
                // The tile of the last image names what it shows: « +N », the images left.
                aria-label={
                  last
                    ? `${t('open', { index: index + 1, count: images.length })}, ${t('more', { count: layout.more })}`
                    : t('open', { index: index + 1, count: images.length })
                }
                className="group block size-full outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- variants of the media module, presigned for a private publication. */}
                <img
                  src={imageSource(image, layout.grid === 'single' ? 'full' : 'grid')}
                  alt={image.alt ?? t('noAlt')}
                  loading="lazy"
                  decoding="async"
                  style={{
                    viewTransitionName: open === null ? `post-${postId}-${index}` : undefined,
                  }}
                  className="size-full object-cover transition-transform duration-(--duration-page) ease-(--ease-enter) group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                />
                {last ? (
                  <span className="absolute inset-0 flex items-center justify-center bg-overlay font-display text-3xl font-extrabold text-on-brand-panel">
                    {t('more', { count: layout.more })}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
      {open !== null ? (
        <Suspense fallback={null}>
          <ImageViewer
            images={images}
            startIndex={open}
            transitionName={`post-${postId}-${open}`}
            onClose={() => {
              // The focus goes back to the thumbnail that opened the viewer (WebKit never
              // focuses a button on a click, and the viewer leaves with its focus scope).
              const opened = open;
              setOpen(null);
              requestAnimationFrame(() => tiles.current[opened]?.focus());
            }}
          />
        </Suspense>
      ) : null}
    </>
  );
}
