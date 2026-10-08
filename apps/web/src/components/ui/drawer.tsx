'use client';

import type { ComponentProps, ReactNode } from 'react';
import { Drawer as Primitive } from 'vaul';
import { cn } from '@/lib/cn';
import { backdrop } from './overlay-classes';

export const Drawer = Primitive.Root;
export const DrawerTrigger = Primitive.Trigger;
export const DrawerClose = Primitive.Close;

type DrawerContentProps = ComponentProps<typeof Primitive.Content> & {
  title: ReactNode;
  hideTitle?: boolean;
  description?: ReactNode;
};

/**
 * Panel pulled up from the bottom of a phone (vaul, on Radix Dialog): dragged down or Escape to
 * close, focus trapped. For a narrow screen; on a wide one, the Sheet or the Dialog.
 */
export function DrawerContent({
  title,
  hideTitle = false,
  description,
  className,
  children,
  ...props
}: DrawerContentProps) {
  return (
    <Primitive.Portal>
      <Primitive.Overlay className={backdrop} />
      <Primitive.Content
        {...(description ? {} : { 'aria-describedby': undefined })}
        className={cn(
          'fixed inset-x-0 bottom-0 z-(--z-modal) flex max-h-[92dvh] flex-col rounded-t-2xl border border-border bg-surface-elevated text-foreground shadow-lg outline-none',
          className,
        )}
        {...props}
      >
        <div
          aria-hidden
          className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-border-strong"
        />
        <div className={cn('grid gap-1 px-6 pt-4', hideTitle && 'sr-only')}>
          <Primitive.Title className="font-display text-xl font-extrabold">{title}</Primitive.Title>
          {description ? (
            <Primitive.Description className="text-sm text-muted">
              {description}
            </Primitive.Description>
          ) : null}
        </div>
        <div className="overflow-y-auto px-6 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </Primitive.Content>
    </Primitive.Portal>
  );
}
