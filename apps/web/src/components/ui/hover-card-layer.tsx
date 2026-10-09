'use client';

import { HoverCard as Primitive } from 'radix-ui';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { floatingEnter, floatingSurface } from './overlay-classes';

/**
 * The positioned card of a `HoverCard` (Radix HoverCard, controlled), loaded at the first hover or
 * focus of its trigger: anchored on an invisible box over the trigger, so that the trigger is
 * never re-mounted when the layer arrives; the pointer may move into the card to read it.
 */
export default function HoverCardLayer({
  open,
  onOpenChange,
  side,
  className,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side: ComponentProps<typeof Primitive.Content>['side'];
  className?: string;
  children: ReactNode;
}) {
  return (
    <Primitive.Root open={open} onOpenChange={onOpenChange} openDelay={0} closeDelay={150}>
      <Primitive.Trigger asChild>
        <span aria-hidden className="pointer-events-none absolute inset-0" />
      </Primitive.Trigger>
      <Primitive.Portal>
        <Primitive.Content
          side={side}
          sideOffset={8}
          collisionPadding={12}
          className={cn(
            floatingSurface,
            floatingEnter,
            'w-80 origin-(--radix-hover-card-content-transform-origin) p-4',
            className,
          )}
        >
          {children}
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
