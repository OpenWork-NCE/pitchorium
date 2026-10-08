'use client';

import { ErrorBoundaryView } from '@/components/layout/states/error-boundary';
import { routes } from '@/config/routes';

/** Unexpected error of a page outside the route groups. */
export default function LocaleError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorBoundaryView {...props} home={routes.home} />;
}
