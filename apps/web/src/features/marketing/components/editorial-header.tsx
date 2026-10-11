import type { ReactNode } from 'react';
import { Container } from '@/components/layout/container';
import { Heading, Kicker, Text } from '@/components/ui';
import { cn } from '@/lib/cn';
import { TitleWords } from './title-words';

/** A transparent pixel: what the motif loads where it is hidden (no request). */
const EMPTY = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/**
 * Header of an editorial page: kicker, title revealed word by word, lede, and its actions. With a
 * `visual` (the previews of the product on the home page, ADR 0162), two columns from `lg`, the
 * visual under the text below; without, the motif of the brand behind the text.
 */
export function EditorialHeader({
  kicker,
  title,
  lede,
  children,
  visual,
  titleClassName,
}: {
  kicker?: string;
  title: string;
  lede: string;
  children?: ReactNode;
  visual?: ReactNode;
  titleClassName?: string;
}) {
  return (
    <section className="relative overflow-hidden border-b border-border">
      {/* The brand motif, an image found with the document: behind a short title it is the
          largest paint, which a background of the stylesheet would delay. With a visual, it
          stays below `lg` only, where the visual is a band under the title; on a computer the
          previews take its place (no request there: an empty source). */}
      <picture>
        {visual ? <source media="(min-width: 1024px)" srcSet={EMPTY} /> : null}
        <source media="(min-width: 768px)" srcSet="/brand/overlay-desktop.svg" />
        <img
          src="/brand/overlay-mobile.svg"
          alt=""
          aria-hidden
          fetchPriority="high"
          className={cn(
            'pointer-events-none absolute inset-0 size-full object-cover object-bottom md:object-right',
            visual && 'lg:hidden',
          )}
        />
      </picture>
      <Container
        className={cn(
          'relative grid',
          visual
            ? 'gap-12 py-16 md:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-center lg:gap-10'
            : 'py-20 md:py-28',
        )}
      >
        <div className="editorial-reveal grid justify-items-start gap-6">
          {kicker ? <Kicker>{kicker}</Kicker> : null}
          <Heading
            level={1}
            size="display"
            className={cn('title-reveal max-w-4xl', titleClassName)}
          >
            <TitleWords text={title} />
          </Heading>
          <Text size="lg" tone="muted" className="max-w-2xl">
            {lede}
          </Text>
          {children}
        </div>
        {visual}
      </Container>
    </section>
  );
}
