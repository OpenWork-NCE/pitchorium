'use client';

import { Slot } from 'radix-ui';
import { lazy, type ReactNode, Suspense, useRef, useState } from 'react';
import type { AlertDialogContentProps } from './alert-dialog-panel';

const loadPanel = () => import('./alert-dialog-panel');
/** The dialog (Radix AlertDialog, its focus trap and scroll lock) loads at its first opening. */
const AlertDialogPanel = lazy(() =>
  loadPanel().then((module) => ({ default: module.AlertDialogPanel })),
);

interface AlertDialogProps extends AlertDialogContentProps {
  /** The element that opens it, usually a danger button; none when it is opened from outside. */
  trigger?: ReactNode;
  /** Opened from outside (a button that changes with its state, a menu item). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * Confirmation of a destructive or irreversible action (`role=alertdialog`): its trigger renders
 * at once, the dialog loads when the pointer or the focus reaches it, or at the first opening
 * (ADR 0094), then keeps the behaviour of `AlertDialogPanel`: focus on Cancel at first, Escape
 * cancels, no closing by a click outside, the focus back on the trigger. With a phrase to type,
 * the action stays unavailable until it matches (docs/design/patterns.md).
 */
export function AlertDialog({
  trigger,
  open: controlledOpen,
  onOpenChange,
  ...content
}: AlertDialogProps) {
  const [ownOpen, setOwnOpen] = useState(false);
  const open = controlledOpen ?? ownOpen;
  // Mounted from the first opening on, so that the closing keeps its animation.
  const [opened, setOpened] = useState(open);
  if (open && !opened) setOpened(true);
  const triggerRef = useRef<HTMLElement | null>(null);
  const setOpen = (next: boolean) => {
    setOwnOpen(next);
    onOpenChange?.(next);
  };
  const preload = () => void loadPanel().catch(() => undefined);
  return (
    <>
      {trigger ? (
        <Slot.Root
          ref={triggerRef}
          aria-haspopup="dialog"
          aria-expanded={open}
          onPointerEnter={preload}
          onFocus={preload}
          onClick={(event: { defaultPrevented: boolean }) => {
            // A blocked trigger (`disabledReason`) prevents the opening.
            if (!event.defaultPrevented) setOpen(true);
          }}
        >
          {trigger}
        </Slot.Root>
      ) : null}
      {opened ? (
        <Suspense fallback={null}>
          <AlertDialogPanel
            {...content}
            open={open}
            onOpenChange={setOpen}
            returnFocus={triggerRef}
          />
        </Suspense>
      ) : null}
    </>
  );
}
