'use client';

import { Popover as Primitive } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';
import { floatingEnter, floatingSurface } from './overlay-classes';

/** Floating panel anchored to its trigger, non-modal (Radix Popover): Escape and a click outside close it. */
export const Popover = Primitive.Root;
export const PopoverTrigger = Primitive.Trigger;
export const PopoverAnchor = Primitive.Anchor;
export const PopoverClose = Primitive.Close;

export function PopoverContent({
  className,
  align = 'start',
  sideOffset = 8,
  ...props
}: ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Content
        align={align}
        sideOffset={sideOffset}
        collisionPadding={12}
        className={cn(
          floatingSurface,
          floatingEnter,
          'w-72 max-w-[calc(100vw-1.5rem)] origin-(--radix-popover-content-transform-origin) p-4',
          className,
        )}
        {...props}
      />
    </Primitive.Portal>
  );
}
