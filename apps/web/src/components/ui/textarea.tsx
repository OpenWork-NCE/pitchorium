'use client';

import { type ChangeEvent, type ComponentProps, useLayoutEffect, useRef } from 'react';
import { cn } from '@/lib/cn';
import { useFieldControl } from './field';
import { controlClasses } from './input';

type TextareaProps = ComponentProps<'textarea'> & {
  /** Lines shown before growing, and the most it grows to before scrolling. */
  minRows?: number;
  maxRows?: number;
};

/**
 * Text area that grows with its content (CSS `field-sizing`, a measure where the browser lacks
 * it), from `minRows` to `maxRows`. The counter belongs to its Field (`counter`).
 */
export function Textarea({
  className,
  minRows = 3,
  maxRows = 12,
  onChange,
  ...props
}: TextareaProps) {
  const control = useFieldControl(props);
  const ref = useRef<HTMLTextAreaElement>(null);

  const fit = () => {
    const element = ref.current;
    if (!element || CSS.supports('field-sizing', 'content')) return;
    element.style.height = 'auto';
    element.style.height = `${element.scrollHeight + 2}px`;
  };

  useLayoutEffect(fit, [props.value]);

  return (
    <textarea
      ref={ref}
      rows={minRows}
      {...control}
      onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
        onChange?.(event);
        fit();
      }}
      style={{
        minHeight: `calc(${minRows} * 1.5em + 1.25rem)`,
        maxHeight: `calc(${maxRows} * 1.5em + 1.25rem)`,
      }}
      className={cn(
        controlClasses,
        'block [field-sizing:content] resize-none overflow-y-auto px-3 py-2.5 leading-normal',
        className,
      )}
    />
  );
}
