'use client';

import { Separator as Primitive } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

/**
 * Functional separation between two groups of content (Radix Separator, announced as such).
 * Never a decoration: spacing separates first (docs/design/direction.md).
 */
export function Separator({
  className,
  orientation = 'horizontal',
  decorative = false,
  ...props
}: ComponentProps<typeof Primitive.Root>) {
  return (
    <Primitive.Root
      orientation={orientation}
      decorative={decorative}
      className={cn(
        'shrink-0 bg-border',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        className,
      )}
      {...props}
    />
  );
}
