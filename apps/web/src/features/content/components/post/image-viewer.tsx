'use client';

import type { PostImage } from '@pitchorium/contracts';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Dialog as Primitive } from 'radix-ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { IconButton } from '@/components/ui';
import { imageSource } from './post-images';

/**
 * The images of a publication in full (Embla): swipe, arrows of the keyboard and buttons, the
 * counter and the text alternative written under each image (readable by everyone), Escape
 * closes and gives the focus back to the thumbnail (Radix Dialog). Loaded on the first opening.
 */
export default function ImageViewer({
  images,
  startIndex,
  transitionName,
  onClose,
}: {
  images: readonly PostImage[];
  startIndex: number;
  /** Name of the shared transition with the thumbnail opened. */
  transitionName: string;
  onClose: () => void;
}) {
  const t = useTranslations('web.content.viewer');
  const close = useTranslations('web.ui');
  const noAlt = useTranslations('web.content.images');
  const [viewport, embla] = useEmblaCarousel({ startIndex, loop: false, duration: 20 });
  const [index, setIndex] = useState(startIndex);

  // An arrow pressed before the carousel is ready (its code loads with the viewer) is kept, and
  // the carousel starts on the image asked for instead of losing the key.
  const pending = useRef<number | null>(null);

  useEffect(() => {
    if (!embla) return;
    if (pending.current !== null) embla.scrollTo(pending.current, true);
    pending.current = null;
    const select = () => setIndex(embla.selectedScrollSnap());
    embla.on('select', select);
    return () => {
      embla.off('select', select);
    };
  }, [embla]);

  const go = useCallback(
    (step: 1 | -1) => {
      if (embla) {
        if (step === 1) embla.scrollNext();
        else embla.scrollPrev();
        return;
      }
      const target = Math.min(Math.max(index + step, 0), images.length - 1);
      pending.current = target;
      setIndex(target);
    },
    [embla, index, images.length],
  );
  const previous = useCallback(() => go(-1), [go]);
  const next = useCallback(() => go(1), [go]);
  const current = images[index];

  return (
    <Primitive.Root open onOpenChange={(open) => !open && onClose()}>
      <Primitive.Portal>
        <Primitive.Overlay className="fixed inset-0 z-(--z-modal) bg-viewer-backdrop data-[state=open]:animate-[fade-in_var(--duration-page)_var(--ease-enter)]" />
        <Primitive.Content
          aria-describedby={undefined}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft') {
              event.preventDefault();
              previous();
            } else if (event.key === 'ArrowRight') {
              event.preventDefault();
              next();
            }
          }}
          className="fixed inset-0 z-(--z-modal) grid grid-rows-[auto_1fr_auto] gap-3 p-3 text-on-brand-panel outline-none sm:p-6"
        >
          <div className="flex items-center justify-between gap-3">
            <Primitive.Title className="text-sm font-medium tabular-nums">
              <span className="sr-only">{t('title')} : </span>
              {t('counter', { index: index + 1, count: images.length })}
            </Primitive.Title>
            <Primitive.Close asChild>
              <IconButton
                label={close('close')}
                icon={<X />}
                variant="secondary"
                data-dialog-close=""
              />
            </Primitive.Close>
          </div>
          <div className="relative min-h-0">
            <div ref={viewport} className="h-full overflow-hidden">
              <ul className="flex h-full touch-pan-y">
                {images.map((image, position) => (
                  <li
                    key={image.mediaId}
                    aria-roledescription={t('slide')}
                    aria-hidden={position !== index}
                    className="flex h-full min-w-0 flex-[0_0_100%] items-center justify-center"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- variants of the media module, presigned for a private publication. */}
                    <img
                      src={imageSource(image, 'full')}
                      alt={image.alt ?? noAlt('noAlt')}
                      style={{
                        viewTransitionName: position === index ? transitionName : undefined,
                      }}
                      className="max-h-full max-w-full rounded-md object-contain"
                    />
                  </li>
                ))}
              </ul>
            </div>
            {images.length > 1 ? (
              <>
                <IconButton
                  label={t('previous')}
                  icon={<ChevronLeft />}
                  variant="secondary"
                  onClick={previous}
                  disabled={index === 0}
                  className="absolute top-1/2 left-1 -translate-y-1/2"
                />
                <IconButton
                  label={t('next')}
                  icon={<ChevronRight />}
                  variant="secondary"
                  onClick={next}
                  disabled={index === images.length - 1}
                  className="absolute top-1/2 right-1 -translate-y-1/2"
                />
              </>
            ) : null}
          </div>
          <p aria-live="polite" className="mx-auto max-w-prose text-center text-sm text-pretty">
            {current?.alt ? (
              <>
                <span className="sr-only">{t('description')} : </span>
                {current.alt}
              </>
            ) : (
              <span className="opacity-80">{noAlt('noAlt')}</span>
            )}
          </p>
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
