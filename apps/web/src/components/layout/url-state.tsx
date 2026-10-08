'use client';

import { NuqsAdapter } from 'nuqs/adapters/next/app';
import type { ReactNode } from 'react';

/**
 * State kept in the URL (filters, tabs, search) through nuqs, mounted by the groups that use it
 * only: the editorial pages do without its code.
 */
export function UrlStateProvider({ children }: { children: ReactNode }) {
  return <NuqsAdapter>{children}</NuqsAdapter>;
}
