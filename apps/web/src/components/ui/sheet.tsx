'use client';

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Dialog as Primitive } from 'radix-ui';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { IconButton } from './icon-button';
import { backdrop } from './overlay-classes';

export const Sheet = Primitive.Root;
export const SheetTrigger = Primitive.Trigger;
export const SheetClose = Primitive.Close;

type SheetContentProps = ComponentProps<typeof Primitive.Content> & {
  title: ReactNode;
  /** The title stays for assistive technologies only (a navigation panel shows its own). */
  hideTitle?: boolean;
  description?: ReactNode;
  side?: 'right' | 'left';
};

/**
 * Side panel over the page (Radix Dialog, modal): filters, details, the navigation of a narrow
 * screen. Slides from its side; on a phone, the Drawer pulls up from the bottom instead.
 */
export function SheetContent({
  title,
  hideTitle = false,
  description,
  side = 'right',
  className,
  children,
  ...props
}: SheetContentProps) {
  const t = useTranslations('web.ui');
  return (
    <Primitive.Portal>
      <Primitive.Overlay className={backdrop} />
      <Primitive.Content
        {...(description ? {} : { 'aria-describedby': undefined })}
        onOpenAutoFocus={(event) => {
          props.onOpenAutoFocus?.(event);
          if (event.defaultPrevented) return;
          // As in DialogContent: never the close button first.
          event.preventDefault();
          const content = event.currentTarget as HTMLElement;
          const first = content.querySelector<HTMLElement>(
            'input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]):not([data-dialog-close]), [href], [tabindex]:not([tabindex="-1"])',
          );
          (first ?? content).focus();
        }}
        className={cn(
          'fixed inset-y-0 z-(--z-modal) flex w-[min(24rem,calc(100vw-3rem))] flex-col gap-4 overflow-y-auto border-border bg-surface-elevated p-6 text-foreground shadow-lg outline-none',
          side === 'right'
            ? 'right-0 border-l data-[state=open]:animate-[sheet-in-right_var(--duration-page)_var(--ease-enter)]'
            : 'left-0 border-r data-[state=open]:animate-[sheet-in-left_var(--duration-page)_var(--ease-enter)]',
          className,
        )}
        {...props}
      >
        <div className={cn('grid gap-1 pr-10', hideTitle && 'sr-only')}>
          <Primitive.Title className="font-display text-xl font-extrabold">{title}</Primitive.Title>
          {description ? (
            <Primitive.Description className="text-sm text-muted">
              {description}
            </Primitive.Description>
          ) : null}
        </div>
        {children}
        <Primitive.Close asChild>
          <IconButton
            label={t('close')}
            icon={<X />}
            size="sm"
            className="absolute top-4 right-4"
            data-dialog-close=""
          />
        </Primitive.Close>
      </Primitive.Content>
    </Primitive.Portal>
  );
}
