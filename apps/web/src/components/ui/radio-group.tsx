'use client';

import { RadioGroup as Primitive } from 'radix-ui';
import { type ComponentProps, type ReactNode, useId } from 'react';
import { cn } from '@/lib/cn';
import { useFieldControl, useFieldLabelId } from './field';

export interface RadioOption<T extends string> {
  value: T;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}

type RadioGroupProps<T extends string> = Omit<
  ComponentProps<typeof Primitive.Root>,
  'value' | 'onValueChange' | 'defaultValue' | 'children'
> & {
  value: T | undefined;
  onValueChange: (value: T) => void;
  options: readonly RadioOption<T>[];
  /** `card`: each option is a bordered card, for choices that need a description. */
  variant?: 'list' | 'card';
};

/** One choice among a few, all visible (Radix RadioGroup: arrows move, Space selects). */
export function RadioGroup<T extends string>({
  value,
  onValueChange,
  options,
  variant = 'list',
  className,
  ...props
}: RadioGroupProps<T>) {
  const control = useFieldControl(props);
  const labelId = useFieldLabelId();
  const base = useId();
  return (
    <Primitive.Root
      {...control}
      // The Field labels the group by the id of its label.
      aria-labelledby={labelId ?? props['aria-labelledby']}
      value={value ?? ''}
      onValueChange={(next) => onValueChange(next as T)}
      className={cn('grid gap-2', className)}
    >
      {options.map((option) => {
        const id = `${base}-${option.value}`;
        return (
          <div
            key={option.value}
            className={cn(
              'relative flex min-h-11 items-start gap-3 has-[[data-disabled]]:opacity-50',
              variant === 'card' &&
                'rounded-lg border border-border bg-surface p-4 transition-colors duration-(--duration-micro) hover:border-border-strong has-[[data-state=checked]]:border-accent has-[[data-state=checked]]:bg-accent-subtle/40',
            )}
          >
            <Primitive.Item
              id={id}
              value={option.value}
              disabled={option.disabled}
              className="peer relative z-[1] mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus data-[state=checked]:border-accent"
            >
              <Primitive.Indicator className="size-2.5 rounded-full bg-accent" />
            </Primitive.Item>
            {/* A sibling label: a card is clickable as a whole through its stretched label. */}
            <label
              htmlFor={id}
              className={cn(
                'grid cursor-pointer gap-0.5 peer-disabled:cursor-not-allowed',
                variant === 'card' && 'after:absolute after:inset-0',
              )}
            >
              <span className="text-sm font-medium">{option.label}</span>
              {option.description ? (
                <span className="text-sm text-muted">{option.description}</span>
              ) : null}
            </label>
          </div>
        );
      })}
    </Primitive.Root>
  );
}
