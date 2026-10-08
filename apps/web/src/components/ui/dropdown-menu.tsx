'use client';

import { Check, ChevronRight } from 'lucide-react';
import { DropdownMenu as Primitive } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';
import { floatingEnter, floatingSurface } from './overlay-classes';

export const DropdownMenu = (props: ComponentProps<typeof Primitive.Root>) => (
  // Non-modal: no scroll lock, the page stays usable (ADR 0082).
  <Primitive.Root modal={false} {...props} />
);
export const DropdownMenuTrigger = Primitive.Trigger;
export const DropdownMenuGroup = Primitive.Group;
export const DropdownMenuSub = Primitive.Sub;
export const DropdownMenuRadioGroup = Primitive.RadioGroup;

const ITEM =
  'relative flex min-h-11 cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-surface-sunken sm:min-h-10 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted';

/** Actions of a trigger (Radix DropdownMenu): arrows, typeahead, Escape gives the focus back. */
export function DropdownMenuContent({
  className,
  sideOffset = 8,
  align = 'end',
  ...props
}: ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Content
        sideOffset={sideOffset}
        align={align}
        collisionPadding={8}
        className={cn(
          floatingSurface,
          floatingEnter,
          'min-w-56 origin-(--radix-dropdown-menu-content-transform-origin) p-1',
          className,
        )}
        {...props}
      />
    </Primitive.Portal>
  );
}

export function DropdownMenuItem({
  className,
  tone,
  ...props
}: ComponentProps<typeof Primitive.Item> & { tone?: 'danger' }) {
  return (
    <Primitive.Item
      className={cn(ITEM, tone === 'danger' && 'text-danger [&_svg]:text-danger', className)}
      {...props}
    />
  );
}

export function DropdownMenuLabel({ className, ...props }: ComponentProps<typeof Primitive.Label>) {
  return (
    <Primitive.Label
      className={cn('px-3 py-2 text-xs font-medium text-muted', className)}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({
  className,
  ...props
}: ComponentProps<typeof Primitive.Separator>) {
  return <Primitive.Separator className={cn('-mx-1 my-1 h-px bg-border', className)} {...props} />;
}

export function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: ComponentProps<typeof Primitive.RadioItem>) {
  return (
    <Primitive.RadioItem
      className={cn(ITEM, 'pl-9 data-[state=checked]:font-medium', className)}
      {...props}
    >
      <span className="absolute left-3 inline-flex size-4 items-center justify-center">
        <Primitive.ItemIndicator>
          <Check aria-hidden className="text-accent!" />
        </Primitive.ItemIndicator>
      </span>
      {children}
    </Primitive.RadioItem>
  );
}

export function DropdownMenuSubTrigger({
  className,
  children,
  ...props
}: ComponentProps<typeof Primitive.SubTrigger>) {
  return (
    <Primitive.SubTrigger
      className={cn(ITEM, 'data-[state=open]:bg-surface-sunken', className)}
      {...props}
    >
      {children}
      <ChevronRight aria-hidden className="ml-auto" />
    </Primitive.SubTrigger>
  );
}

export function DropdownMenuSubContent({
  className,
  ...props
}: ComponentProps<typeof Primitive.SubContent>) {
  return (
    <Primitive.Portal>
      <Primitive.SubContent
        collisionPadding={8}
        className={cn(
          floatingSurface,
          floatingEnter,
          'min-w-48 origin-(--radix-dropdown-menu-content-transform-origin) p-1',
          className,
        )}
        {...props}
      />
    </Primitive.Portal>
  );
}
