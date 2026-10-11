import type { ReactNode } from 'react';
import { Container } from '@/components/layout/container';
import { Heading, Kicker, Text } from '@/components/ui';
import { TitleWords } from './title-words';

/** Header of an editorial page: kicker, title revealed word by word, lede, and its actions. */
export function EditorialHeader({
  kicker,
  title,
  lede,
  children,
}: {
  kicker?: string;
  title: string;
  lede: string;
  children?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden border-b border-border">
      {/* The brand motif, an image found with the document: behind a short title it is the
          largest paint, which a background of the stylesheet would delay. */}
      <picture>
        <source media="(min-width: 768px)" srcSet="/brand/overlay-desktop.svg" />
        <img
          src="/brand/overlay-mobile.svg"
          alt=""
          aria-hidden
          fetchPriority="high"
          className="pointer-events-none absolute inset-0 size-full object-cover object-bottom md:object-right"
        />
      </picture>
      <Container className="editorial-reveal relative grid justify-items-start gap-6 py-20 md:py-28">
        {kicker ? <Kicker>{kicker}</Kicker> : null}
        <Heading level={1} size="display" className="title-reveal max-w-4xl">
          <TitleWords text={title} />
        </Heading>
        <Text size="lg" tone="muted" className="max-w-2xl">
          {lede}
        </Text>
        {children}
      </Container>
    </section>
  );
}
