import type { ReactNode } from 'react';
import { SiteHeader } from '../site-header';
import { Main } from '../page-layouts';
import { Footer } from './parts';

/**
 * Public editorial pages: home, how it works, legal pages. Only the providers of the document:
 * no data, realtime, authentication, motion features nor toasts (ADR 0094).
 */
export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <Main className="flex-1">{children}</Main>
      <Footer />
    </div>
  );
}
