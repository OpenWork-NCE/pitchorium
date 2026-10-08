'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { configureBrowserApi } from '@/lib/api/browser';
import { getQueryClient } from '@/lib/query/query-client';

configureBrowserApi();

/**
 * TanStack Query and the browser client of the api, for the groups that read the api from the
 * browser (member space, administration, public pages): the editorial pages render on the server
 * only and do without their code (ADR 0094).
 */
export function DataProvider({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={getQueryClient()}>{children}</QueryClientProvider>;
}
