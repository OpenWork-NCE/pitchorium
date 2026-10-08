import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { SignOutButton } from '@/features/identity';
import { DataProvider } from '../data-provider';
import { InteractiveRuntime } from '../interactive-runtime';
import { SiteHeader } from '../site-header';
import { UrlStateProvider } from '../url-state';
import { Main } from './parts';

/** Administration console (§13, §14). */
export async function AdminShell({ children }: { children: ReactNode }) {
  const t = await getTranslations('web.shell');
  return (
    <InteractiveRuntime scope="admin">
      <DataProvider>
        <UrlStateProvider>
          <div className="flex min-h-dvh flex-col">
            <SiteHeader>
              <span className="rounded-full bg-accent-subtle px-3 py-1 text-xs font-medium text-on-accent-subtle">
                {t('admin')}
              </span>
              <SignOutButton />
            </SiteHeader>
            <Main>{children}</Main>
          </div>
        </UrlStateProvider>
      </DataProvider>
    </InteractiveRuntime>
  );
}
