'use client';

import type { ReactNode } from 'react';
import { DataProvider } from './data-provider';

/**
 * TanStack Query for a part of a public page that reads the api from the browser (paginated
 * lists): the public shell does without it, so that a page that only displays never downloads it
 * (ADR 0094). Inside the member shell, which provides it, it reuses the same client of the tab.
 * The URL state (nuqs) is mounted by the components that keep a tab or a filter in the address.
 */
export function ClientDataProviders({ children }: { children: ReactNode }) {
  return <DataProvider>{children}</DataProvider>;
}
