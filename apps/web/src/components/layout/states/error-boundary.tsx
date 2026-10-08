'use client';

import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { reportError } from '@/lib/observability/report-error';

/** The view arrives with the error only: every page carries a boundary (ADR 0094). */
const ErrorView = dynamic(() => import('./error-view'), { ssr: false });

interface ErrorBoundaryViewProps {
  error: Error & { digest?: string };
  reset: () => void;
  home: string;
  withMain?: boolean;
}

/** Body of the `error.tsx` of a route group: reported to Sentry when configured, then a retry. */
export function ErrorBoundaryView({ error, reset, home, withMain }: ErrorBoundaryViewProps) {
  useEffect(() => {
    reportError(error);
  }, [error]);
  return <ErrorView digest={error.digest} reset={reset} home={home} withMain={withMain} />;
}
