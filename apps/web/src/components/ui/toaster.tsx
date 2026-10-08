'use client';

import { Toaster as Sonner } from 'sonner';

/** Toasts of the design system (sonner), styled with the tokens. */
export function Toaster() {
  return (
    <Sonner
      position="bottom-center"
      toastOptions={{
        unstyled: false,
        classNames: {
          toast:
            'rounded-lg! border! border-border! bg-surface-elevated! text-foreground! shadow-md! font-sans!',
          description: 'text-muted!',
          actionButton: 'bg-accent! text-on-accent!',
        },
      }}
    />
  );
}
