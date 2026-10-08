'use client';

import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { useFieldControl } from './field';

/** Surface of every text control: same height, border, focus ring and invalid state. */
export const controlClasses =
  'w-full rounded-md border border-border-strong bg-surface text-base text-foreground placeholder:text-muted transition-colors duration-(--duration-micro) outline-none hover:border-foreground/50 focus-visible:border-focus focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger aria-invalid:focus-visible:outline-danger';

type InputProps = ComponentProps<'input'> & {
  /** Content before the text (an icon, a currency): decorative unless it is a control. */
  startAdornment?: ReactNode;
  /** Content after the text (a button to show a password, a unit). */
  endAdornment?: ReactNode;
};

/** Text input of the design system, bound to its Field (label, description, error). */
export function Input({ className, startAdornment, endAdornment, ...props }: InputProps) {
  const control = useFieldControl(props);
  const input = (
    <input
      {...control}
      className={cn(
        controlClasses,
        'h-11 px-3',
        startAdornment ? 'pl-10' : undefined,
        endAdornment ? 'pr-12' : undefined,
        className,
      )}
    />
  );
  if (!startAdornment && !endAdornment) return input;
  return (
    <div className="relative">
      {startAdornment ? (
        <span className="pointer-events-none absolute inset-y-0 left-0 flex w-10 items-center justify-center text-muted [&_svg]:size-5">
          {startAdornment}
        </span>
      ) : null}
      {input}
      {endAdornment ? (
        <span className="absolute inset-y-0 right-0 flex items-center pr-1">{endAdornment}</span>
      ) : null}
    </div>
  );
}
