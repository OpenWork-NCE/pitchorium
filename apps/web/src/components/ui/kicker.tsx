import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

/** Overline above a title: small capitals in Poppins 500, once per block. */
export function Kicker({ className, ...props }: ComponentProps<'p'>) {
  return (
    <p
      className={cn('text-xs font-medium tracking-[0.08em] text-muted uppercase', className)}
      {...props}
    />
  );
}
