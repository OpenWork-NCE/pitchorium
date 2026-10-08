import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { SignOutButton } from '@/features/identity';
import { DataProvider } from '../data-provider';
import { InteractiveRuntime } from '../interactive-runtime';
import { SiteHeader } from '../site-header';
import { UrlStateProvider } from '../url-state';
import { Main } from './parts';

/** Member space: the realtime channel is mounted by the layout of the group. */
export async function MemberShell({ children }: { children: ReactNode }) {
  const t = await getTranslations('web.shell');
  return (
    <InteractiveRuntime scope="member">
      <DataProvider>
        <UrlStateProvider>
          <div className="flex min-h-dvh flex-col">
            <SiteHeader>
              <span className="sr-only">{t('member')}</span>
              <SignOutButton />
            </SiteHeader>
            <Main>{children}</Main>
          </div>
        </UrlStateProvider>
      </DataProvider>
    </InteractiveRuntime>
  );
}
