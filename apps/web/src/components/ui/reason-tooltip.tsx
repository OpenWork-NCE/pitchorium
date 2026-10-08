'use client';

import { lazy, type ReactNode, Suspense, useEffect } from 'react';
import { preloadWhenIdle } from '@/lib/preload';

/**
 * The tooltip of a disabled reason loads with the first button that has one. A client module of
 * its own: a lazy import inside the Button, which also renders on the server, would make the
 * tooltip a client reference of every page (ADR 0094).
 */
const loadTooltip = () => import('./tooltip');
const Tooltip = lazy(() => loadTooltip().then((module) => ({ default: module.Tooltip })));

export function ReasonTooltip({ reason, children }: { reason: string; children: ReactNode }) {
  useEffect(() => preloadWhenIdle(loadTooltip), []);
  return (
    <Suspense fallback={children}>
      <Tooltip content={reason}>{children}</Tooltip>
    </Suspense>
  );
}
