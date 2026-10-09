'use client';

import type { ReactNode } from 'react';
import { DataProvider } from './data-provider';
import { UrlStateProvider } from './url-state';

/**
 * TanStack Query and the URL state for a part of a public page that reads the api from the
 * browser (paginated lists, tabs in the address): the public shell does without them, so that a
 * page that only displays never downloads them (ADR 0094). Inside the member shell, which
 * provides both, it reuses the same client of the tab.
 */
export function ClientDataProviders({ children }: { children: ReactNode }) {
  return (
    <DataProvider>
      <UrlStateProvider>{children}</UrlStateProvider>
    </DataProvider>
  );
}
