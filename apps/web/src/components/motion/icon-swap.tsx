'use client';

import { AnimatePresence, m } from 'motion/react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { seconds } from './tokens';
import { useMotionPreference } from './use-motion-preference';

interface IconSwapProps {
  /** Key of the icon shown: a change swaps the icons. */
  state: string;
  children: ReactNode;
  className?: string;
}

const HIDDEN = { opacity: 0, scale: 0.25, filter: 'blur(4px)' };
const SHOWN = { opacity: 1, scale: 1, filter: 'blur(0px)' };

/**
 * Swaps two icons in place: scale 0.25 to 1 with a 4 px blur, spring without bounce (motion
 * catalogue). With less motion the new icon appears at once.
 */
export function IconSwap({ state, children, className }: IconSwapProps) {
  const reduced = useMotionPreference() === 'reduced';
  const transition = reduced
    ? { duration: 0 }
    : { type: 'spring' as const, bounce: 0, duration: seconds('page') };
  return (
    <span className={cn('relative inline-grid size-5 place-items-center', className)}>
      <AnimatePresence initial={false}>
        <m.span
          key={state}
          className="col-start-1 row-start-1 inline-grid place-items-center"
          initial={HIDDEN}
          animate={SHOWN}
          exit={HIDDEN}
          transition={transition}
          data-state={state}
        >
          {children}
        </m.span>
      </AnimatePresence>
    </span>
  );
}
