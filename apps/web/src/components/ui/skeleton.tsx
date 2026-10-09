import { useTranslations } from 'next-intl';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Placeholder of content to come, shaped like it (same heights, same columns): a discreet shine
 * crosses it, still with less motion (`.skeleton` in globals.css). Decorative: a Loading region
 * around the skeletons says what is loading.
 */
export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return <div aria-hidden className={cn('skeleton rounded-md', className)} {...props} />;
}

/** Region of skeletons, announced once as busy ("Chargement en cours"). */
export function Loading({
  label,
  children,
  className,
}: {
  label?: string;
  children: ReactNode;
  className?: string;
}) {
  const t = useTranslations('web.a11y');
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={className}>
      <span className="sr-only">{label ?? t('loading')}</span>
      {children}
    </div>
  );
}

/**
 * A field whose control loads on demand (a search, a select): it keeps the shape of a field
 * (border, height, hint text) so that the form does not move, and says it is loading. The review
 * captures wait for it to be gone (`data-loading`).
 */
export function FieldSkeleton({ hint, className }: { hint?: string; className?: string }) {
  const t = useTranslations('web.a11y');
  return (
    <div
      role="status"
      aria-busy="true"
      data-loading=""
      className={cn(
        'flex h-11 w-full items-center rounded-md border border-border-strong bg-surface px-3 text-base text-muted',
        className,
      )}
    >
      <span aria-hidden className="truncate">
        {hint}
      </span>
      <span className="sr-only">{t('loading')}</span>
    </div>
  );
}
