'use client';

import { lazy, type ReactNode, Suspense, useState } from 'react';
import { ReportContext, type ReportTarget } from '@/lib/actions/report';

/** The dialog of the trust feature loads with its first opening, never with the shell. */
const loadReport = () =>
  import('@/features/trust').then((module) => ({ default: module.ReportDialog }));
const ReportDialog = lazy(loadReport);

/**
 * « Signaler » for every content of the member space (§13): the actions of the features open it
 * through ReportContext (ADR 0094: nothing of the reports in the first load of a page).
 */
export function ReportHost({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<ReportTarget | null>(null);
  const [open, setOpen] = useState(false);
  return (
    <ReportContext
      value={(next) => {
        void loadReport();
        setTarget(next);
        setOpen(true);
      }}
    >
      {children}
      {target ? (
        <Suspense fallback={null}>
          <ReportDialog
            key={`${target.type}:${target.id}`}
            target={target}
            open={open}
            onOpenChange={setOpen}
          />
        </Suspense>
      ) : null}
    </ReportContext>
  );
}
