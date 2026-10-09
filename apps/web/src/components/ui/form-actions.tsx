import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Actions of a form, the main one first in the document: stacked full width on a phone, the
 * main one on top; in a row on a wider screen, the main one on the right.
 */
export function FormActions({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 *:w-full sm:flex-row-reverse sm:flex-wrap sm:justify-start sm:*:w-auto',
        className,
      )}
    >
      {children}
    </div>
  );
}
