'use client';

import { Check, Minus } from 'lucide-react';
import { Checkbox as Primitive } from 'radix-ui';
import { type ComponentProps, type ReactNode, useId } from 'react';
import { cn } from '@/lib/cn';
import { useFieldControl } from './field';

type CheckboxProps = Omit<ComponentProps<typeof Primitive.Root>, 'children'> & {
  /** Label next to the box: the whole line is clickable. */
  label?: ReactNode;
  description?: ReactNode;
};

/**
 * Checkbox (Radix), with the indeterminate state of a group partly checked. With a label it is a
 * line of its own; inside a Field, the label of the Field names it.
 */
export function Checkbox({ label, description, className, ...props }: CheckboxProps) {
  const control = useFieldControl(props);
  const generated = useId();
  const id = control.id ?? generated;
  const descriptionId = description ? `${id}-description` : undefined;
  const box = (
    <Primitive.Root
      {...control}
      id={id}
      aria-describedby={cn(control['aria-describedby'], descriptionId) || undefined}
      className={cn(
        'peer mt-0.5 inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-xs border border-border-strong bg-surface text-on-accent transition-colors duration-(--duration-micro) outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger data-[state=checked]:border-accent data-[state=checked]:bg-accent data-[state=indeterminate]:border-accent data-[state=indeterminate]:bg-accent',
        !label && className,
      )}
    >
      <Primitive.Indicator className="[&_svg]:size-4">
        {props.checked === 'indeterminate' ? <Minus aria-hidden /> : <Check aria-hidden />}
      </Primitive.Indicator>
    </Primitive.Root>
  );
  if (!label) return box;
  return (
    <div className={cn('flex min-h-11 items-start gap-3 py-1 sm:min-h-0', className)}>
      {box}
      <div className="grid gap-0.5">
        <label
          htmlFor={id}
          className="cursor-pointer text-sm font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-50"
        >
          {label}
        </label>
        {description ? (
          <p id={descriptionId} className="text-sm text-muted">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}
