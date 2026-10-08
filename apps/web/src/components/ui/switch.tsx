'use client';

import { Switch as Primitive } from 'radix-ui';
import { type ComponentProps, type ReactNode, useId } from 'react';
import { cn } from '@/lib/cn';
import { useFieldControl } from './field';

type SwitchProps = Omit<ComponentProps<typeof Primitive.Root>, 'children'> & {
  label?: ReactNode;
  description?: ReactNode;
};

/**
 * On and off setting that applies at once (Radix Switch, `role=switch`): a preference, never a
 * choice to submit later (a Checkbox then). The thumb slides with the micro duration.
 */
export function Switch({ label, description, className, ...props }: SwitchProps) {
  const control = useFieldControl(props);
  const generated = useId();
  const id = control.id ?? generated;
  const descriptionId = description ? `${id}-description` : undefined;
  const toggle = (
    <Primitive.Root
      {...control}
      id={id}
      aria-describedby={cn(control['aria-describedby'], descriptionId) || undefined}
      className={cn(
        'peer relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-border-strong bg-surface-sunken transition-colors duration-(--duration-micro) outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-accent data-[state=checked]:bg-accent',
        !label && className,
      )}
    >
      <Primitive.Thumb className="block size-4.5 translate-x-0.5 rounded-full bg-muted shadow-xs transition-transform duration-(--duration-micro) ease-(--ease-enter) data-[state=checked]:translate-x-[1.375rem] data-[state=checked]:bg-on-accent" />
    </Primitive.Root>
  );
  if (!label) return toggle;
  return (
    <div className={cn('flex min-h-11 items-center justify-between gap-4', className)}>
      <div className="grid gap-0.5">
        <label htmlFor={id} className="cursor-pointer text-sm font-medium">
          {label}
        </label>
        {description ? (
          <p id={descriptionId} className="text-sm text-muted">
            {description}
          </p>
        ) : null}
      </div>
      {toggle}
    </div>
  );
}
