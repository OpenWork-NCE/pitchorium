import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

/** A key of the keyboard, in the help of the shortcuts and the command palette. */
export function Kbd({ className, ...props }: ComponentProps<'kbd'>) {
  return (
    <kbd
      className={cn(
        'inline-flex h-6 min-w-6 items-center justify-center rounded-xs border border-border-strong bg-surface-sunken px-1.5 font-sans text-xs font-medium text-foreground',
        className,
      )}
      {...props}
    />
  );
}
