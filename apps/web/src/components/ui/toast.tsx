'use client';

import dynamic from 'next/dynamic';

/** sonner and its stylesheet arrive after the first render of the interactive shells (ADR 0094). */
const Toaster = dynamic(() => import('./toaster').then((module) => module.Toaster), { ssr: false });

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
};
