'use client';

import { ToggleGroup as Primitive } from 'radix-ui';
import { type ReactNode, useId } from 'react';
import { LayoutMotion, SharedIndicator } from '@/components/motion';
import { cn } from '@/lib/cn';

export interface ToggleOption<T extends string> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
}

interface CommonProps<T extends string> {
  options: readonly ToggleOption<T>[];
  /** Accessible name of the group. */
  label: string;
  className?: string;
}

type ToggleGroupProps<T extends string> = CommonProps<T> &
  (
    | { type: 'single'; value: T; onValueChange: (value: T) => void }
    | { type: 'multiple'; value: readonly T[]; onValueChange: (value: T[]) => void }
  );

const ITEM =
  'relative inline-flex min-h-9 press cursor-pointer items-center justify-center gap-2 rounded-full px-3 text-sm font-medium text-muted outline-none select-none hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:pointer-events-none disabled:opacity-50 data-[state=on]:text-foreground max-sm:min-h-11 [&_svg]:size-4';

/**
 * Choice among a few options (Radix ToggleGroup, arrows to move, Space to press). `single`: a
 * segmented control, the active option marked by an indicator that glides (layout animation,
 * LayoutMotion); `multiple`: toggles that stay pressed, for filters.
 */
export function ToggleGroup<T extends string>(props: ToggleGroupProps<T>) {
  const layoutId = useId();
  const { options, label, className } = props;
  const items = (selected: (value: T) => boolean, glide: boolean) =>
    options.map((option) => (
      <Primitive.Item
        key={option.value}
        value={option.value}
        disabled={option.disabled}
        className={cn(
          ITEM,
          !glide && 'data-[state=on]:bg-accent-subtle data-[state=on]:text-on-accent-subtle',
        )}
      >
        {glide && selected(option.value) ? (
          <SharedIndicator
            layoutId={layoutId}
            className="inset-0 rounded-full bg-surface shadow-xs ring-1 ring-border-strong"
          />
        ) : null}
        <span className="relative z-[1] inline-flex items-center gap-2">{option.label}</span>
      </Primitive.Item>
    ));
  const root = cn(
    'inline-flex flex-wrap gap-1 rounded-full border border-border bg-surface-sunken p-1',
    className,
  );

  if (props.type === 'single') {
    return (
      <LayoutMotion>
        <Primitive.Root
          type="single"
          value={props.value}
          onValueChange={(next) => {
            // Radix lets the pressed option be released; a segmented control always has one.
            if (next) props.onValueChange(next as T);
          }}
          aria-label={label}
          className={root}
        >
          {items((value) => value === props.value, true)}
        </Primitive.Root>
      </LayoutMotion>
    );
  }
  return (
    <Primitive.Root
      type="multiple"
      value={[...props.value]}
      onValueChange={(next) => props.onValueChange(next as T[])}
      aria-label={label}
      className={cn(root, 'border-0 bg-transparent p-0')}
    >
      {items((value) => props.value.includes(value), false)}
    </Primitive.Root>
  );
}
