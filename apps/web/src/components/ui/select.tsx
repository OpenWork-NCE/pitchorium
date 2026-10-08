'use client';

import { Check, ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Select as Primitive } from 'radix-ui';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { useFieldControl } from './field';
import { controlClasses } from './input';

export interface SelectOption<T extends string> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
}

type SelectProps<T extends string> = {
  value: T | undefined;
  onValueChange: (value: T) => void;
  options: readonly SelectOption<T>[];
  placeholder?: string;
  name?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
} & Pick<ComponentProps<'button'>, 'aria-describedby' | 'aria-invalid' | 'aria-label'>;

/**
 * One choice in a list too long for radios (Radix Select: typeahead, arrows, Escape). For a list
 * to search (countries, sectors), the Combobox.
 */
export function Select<T extends string>({
  value,
  onValueChange,
  options,
  placeholder,
  name,
  className,
  ...props
}: SelectProps<T>) {
  const t = useTranslations('web.ui.select');
  const control = useFieldControl(props);
  return (
    <Primitive.Root
      value={value ?? ''}
      onValueChange={(next) => onValueChange(next as T)}
      name={name}
      disabled={control.disabled}
    >
      <Primitive.Trigger
        id={control.id}
        aria-describedby={control['aria-describedby']}
        aria-invalid={control['aria-invalid']}
        aria-label={props['aria-label']}
        className={cn(
          controlClasses,
          'flex h-11 cursor-pointer items-center justify-between gap-2 px-3 text-left data-[placeholder]:text-muted',
          className,
        )}
      >
        <Primitive.Value placeholder={placeholder ?? t('placeholder')} />
        <Primitive.Icon>
          <ChevronDown aria-hidden className="size-4 text-muted" />
        </Primitive.Icon>
      </Primitive.Trigger>
      <Primitive.Portal>
        <Primitive.Content
          position="popper"
          sideOffset={6}
          collisionPadding={8}
          className="z-(--z-overlay) max-h-(--radix-select-content-available-height) min-w-(--radix-select-trigger-width) origin-(--radix-select-content-transform-origin) overflow-hidden rounded-lg border border-border bg-surface-elevated p-1 text-foreground shadow-md data-[state=open]:animate-[menu-in_var(--duration-micro)_var(--ease-enter)]"
        >
          <Primitive.Viewport>
            {options.map((option) => (
              <Primitive.Item
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className="relative flex min-h-11 cursor-pointer items-center rounded-md py-2 pr-3 pl-9 text-sm outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-surface-sunken data-[state=checked]:font-medium sm:min-h-10"
              >
                <Primitive.ItemIndicator className="absolute left-3 inline-flex">
                  <Check aria-hidden className="size-4 text-accent" />
                </Primitive.ItemIndicator>
                <Primitive.ItemText>{option.label}</Primitive.ItemText>
              </Primitive.Item>
            ))}
          </Primitive.Viewport>
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
