'use client';

import * as m from 'motion/react-m';
import { cn } from '@/lib/cn';
import { seconds } from './tokens';
import { useMotionPreference } from './use-motion-preference';

interface SharedIndicatorProps {
  /** Same id for every item of one navigation or tab list: the indicator glides between them. */
  layoutId: string;
  className?: string;
}

/**
 * Indicator of the active item of a navigation or a tab list (Motion `layoutId`): rendered in
 * the active item only, it moves from the previous one. With less motion it jumps.
 */
export function SharedIndicator({ layoutId, className }: SharedIndicatorProps) {
  const reduced = useMotionPreference() === 'reduced';
  return (
    <m.span
      layoutId={layoutId}
      aria-hidden
      className={cn('pointer-events-none absolute', className)}
      transition={
        reduced ? { duration: 0 } : { type: 'spring', bounce: 0, duration: seconds('page') }
      }
    />
  );
}
