import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

/** Surface of the design system: one level above the page background. */
export function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('rounded-xl border border-border bg-surface p-6 shadow-xs', className)}
      {...props}
    />
  );
}
