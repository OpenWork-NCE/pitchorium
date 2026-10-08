import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

export const badgeVariants = cva(
  'inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs font-medium whitespace-nowrap [&_svg]:size-3.5',
  {
    variants: {
      tone: {
        neutral: 'bg-surface-sunken text-foreground',
        accent: 'bg-accent-subtle text-on-accent-subtle',
        success: 'bg-success-subtle text-success',
        warning: 'bg-warning-subtle text-warning',
        danger: 'bg-danger-subtle text-danger',
        info: 'bg-info-subtle text-info',
        /** A count to act on (unread): solid, rare. */
        count: 'min-w-5 justify-center bg-accent px-1.5 text-on-accent tabular-nums',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

/**
 * A state or a category in a word (Brouillon, En financement, Vérifié). Not interactive; the
 * tones of status only when they mean that status (direction.md).
 */
export function Badge({
  tone,
  className,
  ...props
}: ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
