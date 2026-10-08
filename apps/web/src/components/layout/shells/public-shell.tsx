import type { ReactNode } from 'react';
import { DataProvider } from '../data-provider';
import { InteractiveRuntime } from '../interactive-runtime';
import { SiteHeader } from '../site-header';
import { UrlStateProvider } from '../url-state';
import { Footer } from './parts';

/**
 * Indexable public pages of a visitor: profile, organisation, project, event, showcase (ADR 0101).
 * Data from the browser, but neither realtime nor the authentication client (ADR 0094). The page
 * renders its own `main` (page-layouts.tsx), as in the member space.
 */
export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <InteractiveRuntime scope="public">
      <DataProvider>
        <UrlStateProvider>
          <div className="flex min-h-dvh flex-col">
            <SiteHeader />
            <div className="flex-1">{children}</div>
            <Footer />
          </div>
        </UrlStateProvider>
      </DataProvider>
    </InteractiveRuntime>
  );
}
