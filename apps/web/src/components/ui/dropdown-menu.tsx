'use client';

import { DropdownMenu as Primitive } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

export const DropdownMenu = (props: ComponentProps<typeof Primitive.Root>) => (
  // Non-modal: no scroll lock, hence no style injected at runtime (CSP, ADR 0088).
  <Primitive.Root modal={false} {...props} />
);

export const DropdownMenuTrigger = Primitive.Trigger;

export function DropdownMenuContent({
  className,
  sideOffset = 8,
  ...props
}: ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Content
        sideOffset={sideOffset}
        className={cn(
          'z-(--z-overlay) min-w-44 rounded-lg border border-border bg-surface-elevated p-1 text-foreground shadow-md',
          'origin-(--radix-dropdown-menu-content-transform-origin) data-[state=open]:animate-[menu-in_var(--duration-micro)_var(--ease-enter)]',
          className,
        )}
        {...props}
      />
    </Primitive.Portal>
  );
}

export function DropdownMenuRadioGroup(props: ComponentProps<typeof Primitive.RadioGroup>) {
  return <Primitive.RadioGroup {...props} />;
}

export function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: ComponentProps<typeof Primitive.RadioItem>) {
  return (
    <Primitive.RadioItem
      className={cn(
        'relative flex min-h-10 cursor-pointer items-center gap-2 rounded-md py-2 pr-3 pl-8 text-sm outline-none select-none data-[highlighted]:bg-surface-sunken data-[state=checked]:font-medium',
        className,
      )}
      {...props}
    >
      <span className="absolute left-2.5 inline-flex size-4 items-center justify-center">
        <Primitive.ItemIndicator>
          <span className="block size-1.5 rounded-full bg-accent" />
        </Primitive.ItemIndicator>
      </span>
      {children}
    </Primitive.RadioItem>
  );
}
