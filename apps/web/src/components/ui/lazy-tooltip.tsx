'use client';

import { Tooltip as Primitive } from 'radix-ui';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface TooltipLayerProps {
  open: boolean;
  content: ReactNode;
  side: 'top' | 'bottom' | 'left' | 'right';
}

/**
 * The positioned part of the tooltip of an IconButton (Radix Tooltip, controlled), loaded on the
 * first hover or focus: its trigger is an invisible box over the button, so that the button is
 * never re-mounted (its focus stays) when the layer arrives.
 */
export default function TooltipLayer({ open, content, side }: TooltipLayerProps) {
  return (
    <Primitive.Provider delayDuration={0}>
      <Primitive.Root open={open}>
        <Primitive.Trigger asChild>
          <span aria-hidden className="pointer-events-none absolute inset-0" />
        </Primitive.Trigger>
        <Primitive.Portal>
          <Primitive.Content
            side={side}
            sideOffset={6}
            collisionPadding={8}
            // The button names itself: the tooltip shows its label, it does not describe it.
            aria-hidden
            className={cn(
              'pointer-events-none z-(--z-toast) max-w-64 rounded-md bg-foreground px-2.5 py-1.5 text-xs font-medium text-background shadow-md',
              'origin-(--radix-tooltip-content-transform-origin) animate-[menu-in_var(--duration-micro)_var(--ease-enter)]',
            )}
          >
            {content}
          </Primitive.Content>
        </Primitive.Portal>
      </Primitive.Root>
    </Primitive.Provider>
  );
}
