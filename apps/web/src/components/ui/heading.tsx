import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

export const headingVariants = cva('text-foreground', {
  variants: {
    /** Role in the hierarchy of docs/design/direction.md, independent of the level. */
    size: {
      display: 'font-display text-5xl font-extrabold text-balance',
      page: 'font-display text-3xl font-extrabold text-balance',
      section: 'font-display text-2xl font-extrabold text-balance',
      card: 'font-sans text-lg font-semibold',
      label: 'font-sans text-base font-semibold',
    },
  },
  defaultVariants: { size: 'section' },
});

type HeadingProps = ComponentProps<'h2'> &
  VariantProps<typeof headingVariants> & {
    /** Level in the outline of the page (h1 to h4); the size follows the role, not the level. */
    level: 1 | 2 | 3 | 4;
  };

/**
 * Title of a page, a section or a card: Bricolage Grotesque 800 for pages and sections, Poppins
 * 600 for cards (docs/design/direction.md). Level and size are separate, so that the outline of
 * the page stays correct whatever the look.
 */
export function Heading({ level, size, className, ...props }: HeadingProps) {
  const Tag = `h${level}` as const;
  return <Tag className={cn(headingVariants({ size }), className)} {...props} />;
}
