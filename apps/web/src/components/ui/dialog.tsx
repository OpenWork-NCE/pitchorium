'use client';

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Dialog as Primitive } from 'radix-ui';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { IconButton } from './icon-button';
import { backdrop } from './overlay-classes';

export const Dialog = Primitive.Root;
export const DialogTrigger = Primitive.Trigger;
export const DialogClose = Primitive.Close;

type DialogContentProps = ComponentProps<typeof Primitive.Content> & {
  title: ReactNode;
  /** Read with the title when the dialog opens (`aria-describedby`). */
  description?: ReactNode;
  /** Actions at the bottom, the main one last. */
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** Without the close button: a step the person has to answer (AlertDialog). */
  hideClose?: boolean;
};

const SIZES = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' } as const;

/**
 * Modal dialog (Radix Dialog): focus trapped, then given back to the trigger, Escape closes,
 * the page behind inert. A full sheet from the bottom on a phone. Rises and fades in.
 */
export function DialogContent({
  title,
  description,
  footer,
  size = 'md',
  hideClose = false,
  className,
  children,
  ...props
}: DialogContentProps) {
  const t = useTranslations('web.ui');
  return (
    <Primitive.Portal>
      <Primitive.Overlay className={backdrop} />
      <Primitive.Content
        // Without a description, nothing describes the dialog (Radix asks for it explicitly).
        {...(description ? {} : { 'aria-describedby': undefined })}
        onOpenAutoFocus={(event) => {
          props.onOpenAutoFocus?.(event);
          if (event.defaultPrevented) return;
          // The first field or action of the content, never the close button (its tooltip
          // would open and take the first Escape); the dialog itself when there is none.
          event.preventDefault();
          const content = event.currentTarget as HTMLElement;
          const first = content.querySelector<HTMLElement>(
            'input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]):not([data-dialog-close]), [href], [tabindex]:not([tabindex="-1"])',
          );
          (first ?? content).focus();
        }}
        className={cn(
          // On a phone, the sheet keeps the safe area of the screen under its last line.
          'fixed inset-x-0 bottom-0 z-(--z-modal) grid max-h-[92dvh] gap-5 overflow-y-auto rounded-t-2xl border border-border bg-surface-elevated p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-foreground shadow-lg outline-none sm:pb-6',
          'sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-[calc(100vw-2rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl',
          'data-[state=open]:animate-[dialog-in_var(--duration-page)_var(--ease-enter)]',
          SIZES[size],
          className,
        )}
        {...props}
      >
        <div className="grid gap-1.5 pr-10">
          <Primitive.Title className="font-display text-2xl font-extrabold text-balance">
            {title}
          </Primitive.Title>
          {description ? (
            <Primitive.Description className="text-sm text-muted">
              {description}
            </Primitive.Description>
          ) : null}
        </div>
        {children}
        {footer ? (
          <DialogActions className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {footer}
          </DialogActions>
        ) : null}
        {hideClose ? null : (
          <Primitive.Close asChild>
            <IconButton
              label={t('close')}
              icon={<X />}
              size="sm"
              className="absolute top-4 right-4"
              data-dialog-close=""
            />
          </Primitive.Close>
        )}
      </Primitive.Content>
    </Primitive.Portal>
  );
}

/**
 * The actions of a dialog, kept in view at the bottom of its content while it scrolls (a sheet
 * from the bottom on a phone): « Continuer », « Payer » never leave the screen. On a phone, a line
 * separates them from the content they float over, and the safe area of the screen stays free
 * under them. The last child of the content of a `DialogContent` (`footer` uses it).
 */
export function DialogActions({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-dialog-actions=""
      className={cn(
        // Stuck to the edge of the dialog, its padding included (a sticky box stops at the
        // padding of its scroll container otherwise).
        'sticky -bottom-[max(1.5rem,env(safe-area-inset-bottom))] z-[1] -mx-6 -mb-[max(1.5rem,env(safe-area-inset-bottom))] border-t border-border bg-surface-elevated px-6 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:-bottom-6 sm:-mb-6 sm:border-transparent sm:pb-6',
        className,
      )}
      {...props}
    />
  );
}
