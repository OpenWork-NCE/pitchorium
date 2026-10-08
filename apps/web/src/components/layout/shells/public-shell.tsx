import type { ReactNode } from 'react';
import { SiteHeader } from '../site-header';
import { DataProvider } from '../data-provider';
import { UrlStateProvider } from '../url-state';
import { Footer, Main } from './parts';

/** Indexable public pages: profile, organisation, project, event. */
export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <DataProvider>
      <UrlStateProvider>
        <div className="flex min-h-dvh flex-col">
          <SiteHeader />
          <Main>{children}</Main>
          <Footer />
        </div>
      </UrlStateProvider>
    </DataProvider>
  );
}
