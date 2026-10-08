import type { ReactNode } from 'react';
import { SiteHeader } from '../site-header';
import { Footer, Main } from './parts';

/** Public editorial pages: home, how it works, legal pages. */
export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <Main>{children}</Main>
      <Footer />
    </div>
  );
}
