'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import { CircleAlert, Info, TriangleAlert, WifiOff, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

const bannerVariants = cva('border-b text-sm', {
  variants: {
    tone: {
      info: 'border-info/30 bg-info-subtle text-info',
      warning: 'border-warning/30 bg-warning-subtle text-warning',
      danger: 'border-danger/30 bg-danger-subtle text-danger',
      neutral: 'border-border bg-surface-sunken text-foreground',
    },
  },
  defaultVariants: { tone: 'info' },
});

const ICONS = {
  info: Info,
  warning: TriangleAlert,
  danger: CircleAlert,
  neutral: WifiOff,
} as const;

type BannerProps = VariantProps<typeof bannerVariants> & {
  children: ReactNode;
  action?: ReactNode;
  /** Shows a button to hide the banner for the session. */
  onDismiss?: () => void;
  /** Announced when it appears after the page (offline): `status`. */
  live?: 'status' | 'alert';
  className?: string;
};

/**
 * Message of the site or of the account across the top of the member space: email to verify,
 * terms to accept, suspension, prerequisites, offline mode (patterns.md). One line, an action.
 */
export function Banner({ tone, children, action, onDismiss, live, className }: BannerProps) {
  const t = useTranslations('web.ui');
  const Icon = ICONS[tone ?? 'info'];
  return (
    <div role={live} className={cn(bannerVariants({ tone }), className)}>
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 sm:px-6">
        <Icon aria-hidden className="size-5 shrink-0" />
        <div className="min-w-0 flex-1 text-foreground">{children}</div>
        {action ? <div className="shrink-0">{action}</div> : null}
        {onDismiss ? (
          <button
            type="button"
            aria-label={t('dismiss')}
            onClick={onDismiss}
            className="inline-flex size-9 cursor-pointer items-center justify-center rounded-full text-foreground outline-none hover:bg-foreground/5 focus-visible:outline-2 focus-visible:outline-focus max-sm:size-11"
          >
            <X aria-hidden className="size-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
