'use client';

import dynamic from 'next/dynamic';
import { idle } from '@/lib/preload';

/** sonner and its stylesheet arrive once the interactive shells are idle (ADR 0094). */
const Toaster = dynamic(
  () =>
    idle()
      .then(() => import('./toaster'))
      .then((module) => module.Toaster),
  { ssr: false },
);

/** Toasts of a shell, mounted once the page has rendered. */
export function ToasterLoader() {
  return <Toaster />;
}

/**
 * Shows a toast (sonner, loaded on demand): a short confirmation, never the only place of an
 * error to act on (patterns.md).
 */
export const notify = {
  success: (message: string) => void import('sonner').then(({ toast }) => toast.success(message)),
  info: (message: string) => void import('sonner').then(({ toast }) => toast(message)),
  error: (message: string, description?: string) =>
    void import('sonner').then(({ toast }) => toast.error(message, { description })),
  /** An action done at once, with « Annuler » to undo it (patterns.md: no confirmation). */
  undoable: (message: string, undo: { label: string; onUndo: () => void }) =>
    void import('sonner').then(({ toast }) =>
      toast(message, { action: { label: undo.label, onClick: undo.onUndo } }),
    ),
};
