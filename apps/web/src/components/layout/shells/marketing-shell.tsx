import type { ReactNode } from 'react';
import { SiteFooter } from '@/features/marketing';
import { env } from '@/lib/env';
import { SiteHeader } from '../site-header';
import { Main } from '../page-layouts';

/**
 * Public editorial pages: home, how it works, transparency, legal pages. Only the providers of
 * the document: no data, realtime, authentication, motion features nor toasts (ADR 0094). The
 * content slides over the footer (H29, `footer-uncover`).
 */
export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="footer-uncover-content flex flex-1 flex-col">
        <SiteHeader />
        <Main className="flex-1">{children}</Main>
      </div>
      <SiteFooter contactEmail={env.CONTACT_EMAIL} uncover />
    </div>
  );
}
