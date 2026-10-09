import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface TagProps {
  children: ReactNode;
  /** Makes the tag removable: the label of the remove button ("Retirer Agriculture"). */
  removeLabel?: string;
  onRemove?: () => void;
  className?: string;
}

/**
 * A value among others (a sector, a country, a skill), removable when it is the person's own; a
 * long value goes on two lines on a narrow screen rather than overflowing.
 */
export function Tag({ children, removeLabel, onRemove, className }: TagProps) {
  return (
    <span
      className={cn(
        'inline-flex min-h-8 max-w-full items-center gap-1 rounded-full border border-border bg-surface px-3 py-1 text-sm leading-snug break-words text-foreground',
        onRemove && 'pr-1',
        className,
      )}
    >
      {children}
      {onRemove && removeLabel ? (
        <button
          type="button"
          aria-label={removeLabel}
          onClick={onRemove}
          className="inline-flex size-6 cursor-pointer items-center justify-center rounded-full text-muted outline-none hover:bg-surface-sunken hover:text-foreground focus-visible:outline-2 focus-visible:outline-focus"
        >
          <X aria-hidden className="size-3.5" />
        </button>
      ) : null}
    </span>
  );
}
