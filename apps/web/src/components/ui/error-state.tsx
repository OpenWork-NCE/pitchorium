'use client';

import { CircleAlert, RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Button } from './button';

interface ErrorStateProps {
  /** What could not be done; a generic title by default. */
  title?: ReactNode;
  /** Translated text of the error code (`errors.<code>`), never the technical message. */
  description?: ReactNode;
  /** Retries what failed: a query refetch, a reset of an error boundary. */
  onRetry?: () => void;
  retrying?: boolean;
  /** `X-Request-Id` of the failed call, to quote to the support. */
  reference?: string | null;
  headingLevel?: 2 | 3;
  size?: 'page' | 'inline';
  className?: string;
}

/** A part of the page could not load: what happened, a retry, and the reference for the support. */
export function ErrorState({
  title,
  description,
  onRetry,
  retrying = false,
  reference,
  headingLevel = 2,
  size = 'inline',
  className,
}: ErrorStateProps) {
  const t = useTranslations('web.ui.errorState');
  const Heading = `h${headingLevel}` as const;
  return (
    <div
      role="alert"
      className={cn(
        'grid justify-items-center gap-3 rounded-xl text-center',
        size === 'page' ? 'border border-border bg-surface px-6 py-14' : 'px-4 py-8',
        className,
      )}
    >
      <span
        aria-hidden
        className="flex size-12 items-center justify-center rounded-full bg-danger-subtle text-danger"
      >
        <CircleAlert className="size-6" />
      </span>
      <Heading className="font-sans text-base font-semibold text-balance">
        {title ?? t('title')}
      </Heading>
      <p className="max-w-md text-sm text-muted">{description ?? t('description')}</p>
      {reference ? (
        <p className="font-mono text-xs text-muted">{t('reference', { reference })}</p>
      ) : null}
      {onRetry ? (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          loading={retrying}
          loadingLabel={t('retrying')}
        >
          <RotateCcw aria-hidden />
          {t('retry')}
        </Button>
      ) : null}
    </div>
  );
}
