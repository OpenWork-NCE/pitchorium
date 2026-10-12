import type { ReactNode } from 'react';
import { SiteFooter } from '@/features/marketing';
import { env } from '@/lib/env';
import { InteractiveRuntime } from '../interactive-runtime';
import { SiteHeader } from '../site-header';
import { BELOW_FIRST_SCREEN } from './parts';

/**
 * Indexable public pages of a visitor: profile, organisation, project, event, showcase (ADR 0101).
 * Neither data from the browser, realtime nor the authentication client in its first load (ADR
 * 0094): a part of a page that reads the api from the browser brings its own providers
 * (`ClientData`). The page renders its own `main` (page-layouts.tsx), as in the member space.
 */
export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <InteractiveRuntime scope="public">
      <div className="flex min-h-dvh flex-col">
        <SiteHeader />
        <div className={`flex-1 ${BELOW_FIRST_SCREEN}`}>{children}</div>
        <SiteFooter contactEmail={env.CONTACT_EMAIL} />
      </div>
    </InteractiveRuntime>
  );
}
