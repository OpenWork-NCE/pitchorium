import type { ReactNode } from 'react';
import { DataProvider } from '../data-provider';
import { InteractiveRuntime } from '../interactive-runtime';
import { SiteHeader } from '../site-header';
import { UrlStateProvider } from '../url-state';
import { Main } from '../page-layouts';
import { Footer } from './parts';

/**
 * Indexable public pages: profile, organisation, project, event. Data from the browser, but
 * neither realtime nor the authentication client (ADR 0094).
 */
export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <InteractiveRuntime scope="public">
      <DataProvider>
        <UrlStateProvider>
          <div className="flex min-h-dvh flex-col">
            <SiteHeader />
            <Main className="flex-1">{children}</Main>
            <Footer />
          </div>
        </UrlStateProvider>
      </DataProvider>
    </InteractiveRuntime>
  );
}
