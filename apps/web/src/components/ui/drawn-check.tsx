'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

/**
 * Confirmation drawn as a stroke (H18): a circle then a check, in the colour of success, drawn
 * once on arrival (`drawn-stroke`, 800 ms); with less motion, drawn at once.
 */
export function DrawnCheck({ className }: { className?: string }) {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      data-drawn={drawn ? '' : undefined}
      className={cn('drawn-stroke size-12 text-success', className)}
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        pathLength={1}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        transform="rotate(-90 12 12)"
      />
      <path
        d="m7.5 12.5 3 3 6-6.5"
        pathLength={1}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
