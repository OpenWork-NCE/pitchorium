'use client';

import { domMax, LazyMotion } from 'motion/react';
import * as m from 'motion/react-m';
import { seconds } from './tokens';

export interface IndicatorProps {
  layoutId: string;
  className: string;
  reduced: boolean;
}

/**
 * The gliding indicator (Motion `layoutId`, layout features): loaded once the page is idle, so
 * that Motion never weighs on the start of a page (ADR 0094). Every indicator registers with the
 * same projection tree of the document, whatever its LazyMotion.
 */
export default function MotionIndicator({ layoutId, className, reduced }: IndicatorProps) {
  return (
    <LazyMotion features={domMax} strict>
      <m.span
        layoutId={layoutId}
        aria-hidden
        className={className}
        transition={
          reduced ? { duration: 0 } : { type: 'spring', bounce: 0, duration: seconds('page') }
        }
      />
    </LazyMotion>
  );
}
