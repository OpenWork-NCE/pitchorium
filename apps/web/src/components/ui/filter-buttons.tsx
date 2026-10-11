'use client';

import { type ReactNode, useId } from 'react';
import { SharedIndicator } from '@/components/motion';
import { cn } from '@/lib/cn';

interface FilterButtonsProps<T extends string> {
  options: readonly { value: T; label: ReactNode }[];
  value: T;
  onValueChange: (value: T) => void;
  /** Accessible name of the group. */
  label: string;
  className?: string;
}

/**
 * The filter of a list among a few (the conversations, the notifications): the look of the
 * segmented control (ToggleGroup), as plain buttons pressed or not (`aria-pressed`), Tab from one
 * to the next. Lighter than the Radix group in the first load of a page that holds a list.
 */
export function FilterButtons<T extends string>({
  options,
  value,
  onValueChange,
  label,
  className,
}: FilterButtonsProps<T>) {
  const layoutId = useId();
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        // One line: on a narrow screen the options scroll sideways rather than stack.
        'inline-flex max-w-full [scrollbar-width:none] flex-nowrap gap-1 overflow-x-auto rounded-full border border-border bg-surface-sunken p-1',
        className,
      )}
    >
      {options.map((option) => {
        const pressed = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={pressed}
            onClick={() => onValueChange(option.value)}
            className={cn(
              'relative inline-flex min-h-9 shrink-0 press cursor-pointer items-center justify-center gap-2 rounded-full px-3 text-sm font-medium whitespace-nowrap outline-none select-none hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus max-sm:min-h-11',
              pressed ? 'text-foreground' : 'text-muted',
            )}
          >
            {pressed ? (
              <SharedIndicator
                layoutId={layoutId}
                className="inset-0 rounded-full bg-surface shadow-xs ring-1 ring-border-strong"
              />
            ) : null}
            <span className="relative z-[1] inline-flex items-center gap-2">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
