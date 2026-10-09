'use client';

import { useTranslations } from 'next-intl';
import { AlertDialog as Primitive } from 'radix-ui';
import { type ReactNode, type RefObject, useId, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { Button } from './button';
import { Input } from './input';
import { backdrop } from './overlay-classes';

export interface AlertDialogContentProps {
  title: ReactNode;
  /** What will happen, and what cannot be undone. */
  description: ReactNode;
  /** Label of the confirming action: the verb of the action ("Supprimer le projet"). */
  confirmLabel: string;
  cancelLabel?: string;
  /** Phrase to type before confirming, for an action that cannot be undone (a name, a word). */
  confirmPhrase?: string;
  /** The action: the dialog stays open, busy, until it settles. */
  onConfirm: () => Promise<void> | void;
  /** `danger` for a destructive action, `primary` for a weighty one. */
  tone?: 'danger' | 'primary';
}

/**
 * The opened confirmation (Radix AlertDialog, `role=alertdialog`), loaded at the first opening
 * by `AlertDialog`: focus on Cancel at first, Escape cancels, no closing by a click outside, the
 * focus back on the element that opened it. With a phrase to type, the action stays unavailable
 * until it matches (docs/design/patterns.md).
 */
export function AlertDialogPanel({
  title,
  description,
  confirmLabel,
  cancelLabel,
  confirmPhrase,
  onConfirm,
  tone = 'danger',
  open,
  onOpenChange: setOpen,
  returnFocus,
}: AlertDialogContentProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The element the focus goes back to once closed; else the one that had it at the opening. */
  returnFocus: RefObject<HTMLElement | null>;
}) {
  const t = useTranslations('web.ui.confirm');
  const opener = useRef<HTMLElement | null>(null);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const inputId = useId();
  const matches = !confirmPhrase || typed.trim() === confirmPhrase;

  async function confirm() {
    if (!matches) return;
    setBusy(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Primitive.Root
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        setOpen(next);
        if (!next) setTyped('');
      }}
    >
      <Primitive.Portal>
        <Primitive.Overlay className={backdrop} />
        <Primitive.Content
          onOpenAutoFocus={() => {
            // Still on the element that opened it: the focus moves to Cancel right after.
            opener.current = document.activeElement as HTMLElement | null;
          }}
          onCloseAutoFocus={(event) => {
            const target = returnFocus.current ?? opener.current;
            if (!target) return;
            event.preventDefault();
            target.focus();
          }}
          className={cn(
            'fixed inset-x-0 bottom-0 z-(--z-modal) grid gap-5 rounded-t-2xl border border-border bg-surface-elevated p-6 text-foreground shadow-lg outline-none',
            'sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-[calc(100vw-2rem)] sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl',
            'data-[state=open]:animate-[dialog-in_var(--duration-page)_var(--ease-enter)]',
          )}
        >
          <div className="grid gap-2">
            <Primitive.Title className="font-display text-2xl font-extrabold text-balance">
              {title}
            </Primitive.Title>
            <Primitive.Description className="text-sm text-muted">
              {description}
            </Primitive.Description>
          </div>
          {confirmPhrase ? (
            <div className="grid gap-1.5">
              <label htmlFor={inputId} className="grid gap-1 text-sm">
                {t('typeToConfirm')}
                <strong className="font-semibold break-words">{confirmPhrase}</strong>
              </label>
              <Input
                id={inputId}
                value={typed}
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => setTyped(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void confirm();
                }}
              />
            </div>
          ) : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Primitive.Cancel asChild>
              <Button variant="outline" disabled={busy}>
                {cancelLabel ?? t('cancel')}
              </Button>
            </Primitive.Cancel>
            <Button
              variant={tone}
              loading={busy}
              loadingLabel={t('pending')}
              disabledReason={matches ? undefined : t('phraseMissing')}
              onClick={() => void confirm()}
            >
              {confirmLabel}
            </Button>
          </div>
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
