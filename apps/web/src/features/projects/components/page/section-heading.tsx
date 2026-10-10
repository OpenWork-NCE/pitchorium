import type { ReactNode } from 'react';
import { SplitHeading } from '@/components/motion/split-heading';
import { Heading, headingVariants } from '@/components/ui';

/**
 * Title of a section of the page of a project (h2). In the public view, an editorial page (D4),
 * it is revealed line by line as it comes into view (H13, GSAP loaded on demand); never in the
 * member view, which stays in the regime of the member space (docs/design/motion.md).
 */
export function SectionHeading({
  id,
  editorial,
  children,
}: {
  id: string;
  editorial: boolean;
  children: ReactNode;
}) {
  return editorial ? (
    <SplitHeading as="h2" id={id} className={headingVariants({ size: 'section' })}>
      {children}
    </SplitHeading>
  ) : (
    <Heading level={2} size="section" id={id}>
      {children}
    </Heading>
  );
}
