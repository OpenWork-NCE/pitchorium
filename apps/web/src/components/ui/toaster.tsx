'use client';

import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Toaster as Sonner } from 'sonner';

/**
 * Toasts of the design system (sonner) in the colours of the brand: a short confirmation of an
 * action, never the only place of an error the person must act on (an Alert in the page then).
 * Announced politely by sonner's live region; dismissed by swipe, by its button or by itself.
 */
export function Toaster() {
  const t = useTranslations('web.ui.toast');
  return (
    <Sonner
      position="bottom-center"
      closeButton
      containerAriaLabel={t('region')}
      icons={{
        success: <CircleCheck aria-hidden className="size-5 text-success" />,
        error: <CircleAlert aria-hidden className="size-5 text-danger" />,
        warning: <TriangleAlert aria-hidden className="size-5 text-warning" />,
        info: <Info aria-hidden className="size-5 text-info" />,
      }}
      toastOptions={{
        unstyled: false,
        closeButtonAriaLabel: t('close'),
        classNames: {
          toast:
            'gap-3! rounded-xl! border! border-border! bg-surface-elevated! px-4! py-3! text-foreground! shadow-md! font-sans!',
          title: 'text-sm! font-medium!',
          description: 'text-sm! text-muted!',
          actionButton: 'rounded-full! bg-accent! px-3! text-on-accent! font-medium!',
          cancelButton: 'rounded-full! bg-surface-sunken! px-3! text-foreground!',
          closeButton: 'border-border! bg-surface-elevated! text-muted! hover:text-foreground!',
        },
      }}
    />
  );
}
