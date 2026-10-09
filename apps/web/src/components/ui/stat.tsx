'use client';

import type { ReactNode } from 'react';
import { AnimatedNumber } from '@/components/motion';
import { cn } from '@/lib/cn';

interface StatProps {
  label: ReactNode;
  value: number;
  /** Localised formatter, applied to every frame of the count (H17). */
  format: (value: number) => string;
  /** Smallest step of the count (1, or the minor unit of a currency). */
  step?: number;
  /** Context under the value ("ce mois-ci", "+12 % en un mois"). */
  hint?: ReactNode;
  className?: string;
}

/**
 * A key figure: the value counts up once when it comes into view (H17, snapped to its step,
 * formatted on each frame), its final value rendered by the server and kept with less motion. Set
 * in Bricolage Grotesque 800 with its tabular figures: the width stays put while it counts
 * (ADR 0110).
 */
export function Stat({ label, value, format, step = 1, hint, className }: StatProps) {
  return (
    <div className={cn('grid gap-1', className)}>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="font-display text-3xl font-extrabold tabular-nums">
        <AnimatedNumber value={value} format={format} step={step} />
      </dd>
      {hint ? <dd className="text-sm text-muted">{hint}</dd> : null}
    </div>
  );
}
