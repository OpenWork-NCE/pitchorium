'use client';

import { Progress as Primitive } from 'radix-ui';
import { cn } from '@/lib/cn';

interface ProgressProps {
  /** 0 to `max`; null for an indeterminate wait. */
  value: number | null;
  max?: number;
  /** Accessible name of the bar ("Envoi de photo.jpg"). */
  label: string;
  /** Spoken value ("42 %"). */
  valueText?: string;
  size?: 'sm' | 'md';
  className?: string;
}

/** Progress of a known task (Radix Progress, `role=progressbar`), or a wait without a measure. */
export function Progress({
  value,
  max = 100,
  label,
  valueText,
  size = 'md',
  className,
}: ProgressProps) {
  const percent = value === null ? null : Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <Primitive.Root
      value={value}
      max={max}
      aria-label={label}
      getValueLabel={valueText ? () => valueText : undefined}
      className={cn(
        'relative w-full overflow-hidden rounded-full bg-track',
        size === 'sm' ? 'h-1' : 'h-2',
        className,
      )}
    >
      <Primitive.Indicator
        className={cn(
          'h-full rounded-full bg-accent transition-transform duration-(--duration-page) ease-(--ease-enter)',
          percent === null && 'w-1/3 animate-[loading-bar_1.2s_var(--ease-curtain)_infinite]',
        )}
        style={percent === null ? undefined : { transform: `translateX(-${100 - percent}%)` }}
      />
    </Primitive.Root>
  );
}
