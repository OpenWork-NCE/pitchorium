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
        // A visually hidden description (the reason of a disabled button) keeps its 1 px: at
        // full width it would stretch the page sideways on a phone.
        'flex flex-col gap-2 *:not-[.sr-only]:w-full sm:flex-row-reverse sm:flex-wrap sm:justify-start sm:*:not-[.sr-only]:w-auto',
        className,
      )}
    >
      {children}
    </div>
  );
}
