import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface IconSwapProps<T extends string> {
  /** Key of the icon shown: a change swaps the icons. */
  state: NoInfer<T>;
  /** One icon per state, all rendered on top of each other. */
  icons: Record<T, ReactNode>;
  className?: string;
}

/**
 * Swaps icons in place: the new one grows from 0.25 with a 4 px blur that clears, the old one
 * shrinks away (motion catalogue). A CSS transition, interruptible and without JavaScript
 * (styles `.icon-swap` in globals.css); with less motion the new icon appears at once.
 */
export function IconSwap<T extends string>({ state, icons, className }: IconSwapProps<T>) {
  return (
    <span className={cn('icon-swap', className)} data-state={state}>
      {(Object.entries(icons) as [T, ReactNode][]).map(([key, icon]) => (
        <span key={key} data-active={key === state ? '' : undefined} aria-hidden={key !== state}>
          {icon}
        </span>
      ))}
    </span>
  );
}
