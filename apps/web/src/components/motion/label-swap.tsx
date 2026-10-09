import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface LabelSwapProps<T extends string> {
  /** Key of the label shown: a change transforms one label into the other. */
  state: NoInfer<T>;
  /** One label per state, all laid out in the same cell. */
  labels: Record<T, ReactNode>;
  className?: string;
}

/**
 * Changes the label of a button in place, without a jump of its width: the labels share one
 * cell, so the button keeps the width of the longest; the new one rises from below in a fade,
 * the old one leaves upwards (motion catalogue, `.label-swap` in globals.css). Only the label
 * shown is read; with less motion it appears at once.
 */
export function LabelSwap<T extends string>({ state, labels, className }: LabelSwapProps<T>) {
  return (
    <span className={cn('label-swap', className)} data-state={state}>
      {(Object.entries(labels) as [T, ReactNode][]).map(([key, label]) => (
        <span key={key} data-active={key === state ? '' : undefined} aria-hidden={key !== state}>
          {label}
        </span>
      ))}
    </span>
  );
}
