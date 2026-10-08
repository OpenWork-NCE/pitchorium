import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { SignOutButton } from '@/features/identity';
import { SiteHeader } from '../site-header';
import { DataProvider } from '../data-provider';
import { UrlStateProvider } from '../url-state';
import { Main } from './parts';

/** Member space: the realtime channel is mounted by the layout of the group. */
export function MemberShell({ children }: { children: ReactNode }) {
  const t = useTranslations('web.shell');
  return (
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
  );
}
