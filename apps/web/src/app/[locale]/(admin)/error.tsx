'use client';

import { ErrorBoundaryView } from '@/components/layout/states/error-boundary';
import { routes } from '@/config/routes';

/** Unexpected error of a page of the group, inside its shell. */
export default function GroupError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorBoundaryView {...props} home={routes.admin} />;
}
