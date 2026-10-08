import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

/** Width of the content: wide on a desktop (reference screen, §4), 16 px of gutter on a phone. */
export function Container({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('mx-auto w-full max-w-7xl px-4 sm:px-6', className)} {...props} />;
}
