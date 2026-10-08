'use client';

import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { reportError } from '@/lib/observability/report-error';

/** The view arrives with the error only: every page carries this boundary (ADR 0094). */
const LocaleErrorView = dynamic(() => import('@/components/layout/locale-error-view'), {
  ssr: false,
});

/** Unexpected error of a page: reported to Sentry when configured, then a retry. */
export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportError(error);
  }, [error]);
  return <LocaleErrorView digest={error.digest} reset={reset} />;
}
