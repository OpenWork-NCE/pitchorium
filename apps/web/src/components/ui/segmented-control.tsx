'use client';

import { ToggleGroup } from 'radix-ui';
import { type ReactNode, useId } from 'react';
import { SharedIndicator } from '@/components/motion';
import { cn } from '@/lib/cn';

interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  onValueChange: (value: T) => void;
  options: readonly SegmentedOption<T>[];
  /** Accessible name of the group. */
  label: string;
  className?: string;
}

/** Choice among a few options, the active one marked by a gliding indicator (layoutId). */
export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  label,
  className,
}: SegmentedControlProps<T>) {
  const layoutId = useId();
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(next) => {
        if (next) onValueChange(next as T);
      }}
      aria-label={label}
      className={cn(
        'inline-flex rounded-full border border-border bg-surface-sunken p-1',
        className,
      )}
    >
      {options.map((option) => (
        <ToggleGroup.Item
          key={option.value}
          value={option.value}
          className="relative inline-flex h-9 press cursor-pointer items-center gap-2 rounded-full px-3 text-sm font-medium text-muted data-[state=on]:text-foreground [&_svg]:size-4"
        >
          {option.value === value ? (
            <SharedIndicator
              layoutId={layoutId}
              className="inset-0 rounded-full bg-surface shadow-xs"
            />
          ) : null}
          <span className="relative z-[1] inline-flex items-center gap-2">{option.label}</span>
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
