'use client';

import { Tooltip as Primitive } from 'radix-ui';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface TooltipProps {
  /** The element described: a focusable element (button, link). */
  children: ReactNode;
  content: ReactNode;
  side?: ComponentProps<typeof Primitive.Content>['side'];
  align?: ComponentProps<typeof Primitive.Content>['align'];
  /** Opened state, for a controlled tooltip. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * Short hint on hover and keyboard focus (Radix Tooltip): never the only place of a piece of
 * information on a touch screen, dismissed by Escape (WCAG 1.4.13). The trigger keeps its own
 * accessible name; the tooltip describes it.
 */
export function Tooltip({
  children,
  content,
  side = 'top',
  align,
  open,
  onOpenChange,
}: TooltipProps) {
  return (
    <Primitive.Provider delayDuration={400} skipDelayDuration={200}>
      <Primitive.Root open={open} onOpenChange={onOpenChange}>
        <Primitive.Trigger asChild>{children}</Primitive.Trigger>
        <Primitive.Portal>
          <Primitive.Content
            side={side}
            align={align}
            sideOffset={6}
            collisionPadding={8}
            className={cn(
              'z-(--z-toast) max-w-64 rounded-md bg-foreground px-2.5 py-1.5 text-xs font-medium text-background shadow-md',
              'origin-(--radix-tooltip-content-transform-origin) data-[state=delayed-open]:animate-[menu-in_var(--duration-micro)_var(--ease-enter)]',
            )}
          >
            {content}
          </Primitive.Content>
        </Primitive.Portal>
      </Primitive.Root>
    </Primitive.Provider>
  );
}
