import { preload } from 'react-dom';
import { cn } from '@/lib/cn';
import { PREVIEW_SIZES } from '../lib/previews.generated';

export type PreviewId = keyof typeof PREVIEW_SIZES;
type Theme = 'light' | 'dark';

/** A transparent pixel, in the document: what a hidden eager image loads (no request). */
const EMPTY = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

const srcSet = (id: PreviewId, theme: Theme, format: 'avif' | 'webp') =>
  PREVIEW_SIZES[id].widths
    .map((width) => `/marketing/${id}-${theme}-${width}.${format} ${width}w`)
    .join(', ');

/**
 * Preloads the preview that is the largest paint of a page, in the theme of the system (the
 * theme chosen otherwise loads at the layout, from its lazy image) and for the screens of `media`.
 */
export function preloadPreview(id: PreviewId, sizes: string, media: string): void {
  for (const theme of ['light', 'dark'] as const) {
    preload(`/marketing/${id}-${theme}-${PREVIEW_SIZES[id].widths[0]}.avif`, {
      as: 'image',
      type: 'image/avif',
      imageSrcSet: srcSet(id, theme, 'avif'),
      imageSizes: sizes,
      fetchPriority: 'high',
      media: `${media} and (prefers-color-scheme: ${theme})`,
    });
  }
}

/**
 * A preview of the product (ADR 0162): a section of the application captured by
 * `pnpm marketing:captures` (docs/design/marketing-captures.md), in the active theme. Both themes
 * are in the page, the other one hidden: its lazy image is never fetched. AVIF then WebP, its
 * widths for `sizes`, its intrinsic size against any layout shift. The text alternative describes
 * the interface shown (« aperçu d'une page projet sur Pitchorium »).
 *
 * `priority` (the largest paint of a page): the image of the theme of the system loads at once,
 * high priority, found by the browser in the document; a theme chosen against the system shows its
 * own image instead, lazy (`preview-system`, `preview-chosen-*`, globals.css).
 */
export function ProductPreview({
  id,
  alt,
  sizes,
  priority = false,
  hiddenOn,
  className,
  imageClassName,
}: {
  id: PreviewId;
  alt: string;
  sizes: string;
  priority?: boolean;
  /** The screens where its figure is hidden (`priority`): no image is fetched there. */
  hiddenOn?: string;
  className?: string;
  imageClassName?: string;
}) {
  const size = PREVIEW_SIZES[id];
  const image = (theme: Theme, eager: boolean) => (
    <img
      src={`/marketing/${id}-${theme}-${size.widths[0]}.webp`}
      srcSet={srcSet(id, theme, 'webp')}
      sizes={sizes}
      width={size.width}
      height={size.height}
      alt={alt}
      // The largest paint decodes with its frame, never after it.
      {...(eager
        ? { loading: 'eager' as const, fetchPriority: 'high' as const, decoding: 'sync' as const }
        : { loading: 'lazy' as const, decoding: 'async' as const })}
      className={cn('block h-auto w-full', imageClassName)}
    />
  );
  return (
    <figure
      className={cn(
        'overflow-hidden rounded-xl border border-border bg-surface shadow-md',
        className,
      )}
      data-preview={id}
    >
      {priority ? (
        <>
          <picture className="preview-system contents">
            {hiddenOn ? <source media={hiddenOn} srcSet={EMPTY} /> : null}
            <source
              type="image/avif"
              media="(prefers-color-scheme: dark)"
              srcSet={srcSet(id, 'dark', 'avif')}
              sizes={sizes}
            />
            <source
              type="image/webp"
              media="(prefers-color-scheme: dark)"
              srcSet={srcSet(id, 'dark', 'webp')}
              sizes={sizes}
            />
            <source type="image/avif" srcSet={srcSet(id, 'light', 'avif')} sizes={sizes} />
            {image('light', true)}
          </picture>
          {(['light', 'dark'] as const).map((theme) => (
            <picture key={theme} className={`preview-chosen-${theme} hidden`}>
              <source type="image/avif" srcSet={srcSet(id, theme, 'avif')} sizes={sizes} />
              {image(theme, false)}
            </picture>
          ))}
        </>
      ) : (
        (['light', 'dark'] as const).map((theme) => (
          <picture
            key={theme}
            className={theme === 'light' ? 'contents dark:hidden' : 'hidden dark:contents'}
          >
            <source type="image/avif" srcSet={srcSet(id, theme, 'avif')} sizes={sizes} />
            {image(theme, false)}
          </picture>
        ))
      )}
    </figure>
  );
}
