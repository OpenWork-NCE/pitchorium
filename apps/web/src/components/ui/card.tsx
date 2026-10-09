import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

export const cardVariants = cva('rounded-xl text-foreground', {
  variants: {
    surface: {
      /** One level above the page: a bordered surface, nearly flat. */
      default: 'border border-border bg-surface shadow-xs',
      /** A secondary zone inside a page or a card. */
      sunken: 'bg-surface-sunken',
      /** A card that is a link as a whole: lifts its border on hover and focus. */
      interactive:
        'border border-border bg-surface shadow-xs transition-[border-color,box-shadow] duration-(--duration-micro) focus-within:border-border-strong hover:border-border-strong hover:shadow-sm',
    },
    padding: { none: '', sm: 'p-4', md: 'p-5 md:p-6' },
  },
  defaultVariants: { surface: 'default', padding: 'md' },
});

/**
 * Surface of the design system (direction.md: two elevations at most at once): the content is a
 * card, an overlay is the other level.
 */
export function Card({
  surface,
  padding,
  className,
  ...props
}: ComponentProps<'div'> & VariantProps<typeof cardVariants>) {
  // `data-card`: the review captures check that the content stays within its padding.
  return (
    <div data-card="" className={cn(cardVariants({ surface, padding }), className)} {...props} />
  );
}
