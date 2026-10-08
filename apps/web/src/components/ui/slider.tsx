'use client';

import { Slider as Primitive } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';
import { useFieldControl, useFieldLabelId } from './field';

type SliderProps = Omit<ComponentProps<typeof Primitive.Root>, 'children'> & {
  /** Spoken value of a thumb (`aria-valuetext`): "70 %", "12 heures". */
  formatValue: (value: number) => string;
  /** Shows the formatted values above the track. */
  showValue?: boolean;
};

/** Value in a range (Radix Slider: arrows, Page Up and Down, Home and End). */
export function Slider({ formatValue, showValue = true, className, ...props }: SliderProps) {
  const control = useFieldControl(props);
  const labelId = useFieldLabelId();
  const values = props.value ?? props.defaultValue ?? [props.min ?? 0];
  return (
    <div className={cn('grid gap-2', className)}>
      {showValue ? (
        <p aria-hidden className="text-sm font-medium tabular-nums">
          {values.map(formatValue).join(' – ')}
        </p>
      ) : null}
      <Primitive.Root
        {...control}
        className="relative flex h-11 w-full touch-none items-center select-none data-[disabled]:opacity-50"
      >
        <Primitive.Track className="relative h-1.5 grow overflow-hidden rounded-full bg-track">
          <Primitive.Range className="absolute h-full bg-accent" />
        </Primitive.Track>
        {values.map((value, index) => (
          <Primitive.Thumb
            // A thumb per value, in the order of the values.
            key={index}
            aria-labelledby={labelId ?? props['aria-labelledby']}
            aria-describedby={control['aria-describedby']}
            aria-valuetext={formatValue(value)}
            className="block size-5 cursor-grab rounded-full border-2 border-accent bg-surface shadow-xs outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus active:cursor-grabbing"
          />
        ))}
      </Primitive.Root>
    </div>
  );
}
