'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { getQueryClient } from '@/lib/query/query-client';

/**
 * TanStack Query for the groups that read the api from the browser (member space,
 * administration, public pages): the editorial pages render on the server only and do without
 * its code (docs/architecture/frontend.md).
 */
export function DataProvider({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={getQueryClient()}>{children}</QueryClientProvider>;
}
