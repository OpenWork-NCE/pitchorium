'use client';

import { HoverCard as Primitive } from 'radix-ui';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { floatingEnter, floatingSurface } from './overlay-classes';

interface HoverCardProps {
  /** A link to the full content: the card is a preview, never the only way to it. */
  trigger: ReactNode;
  children: ReactNode;
  side?: ComponentProps<typeof Primitive.Content>['side'];
  className?: string;
}

/**
 * Preview on hover and keyboard focus (Radix HoverCard): a profile, a project. Pointer devices
 * only: on a touch screen the link opens the page itself.
 */
export function HoverCard({ trigger, children, side = 'bottom', className }: HoverCardProps) {
  return (
    <Primitive.Root openDelay={500} closeDelay={150}>
      <Primitive.Trigger asChild>{trigger}</Primitive.Trigger>
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
