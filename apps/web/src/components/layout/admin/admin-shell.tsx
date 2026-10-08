import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { BrandSymbol } from '@/components/brand';
import { AnnouncerProvider, Badge, ThemeToggle } from '@/components/ui';
import { routes } from '@/config/routes';
import { SignOutButton } from '@/features/identity';
import { Link } from '@/i18n/navigation';
import { DataProvider } from '../data-provider';
import { InteractiveRuntime } from '../interactive-runtime';
import { Main } from '../page-layouts';
import { RouteFocus } from '../route-focus';
import { UrlStateProvider } from '../url-state';
import { AdminMenu } from './admin-menu';
import { AdminNav } from './admin-nav';

/**
 * Administration console (§13, §14, ADR 0078): a dense internal tool, so a side navigation is
 * allowed here (direction.md), in a panel on a narrow screen. Moderators and administrators
 * only, checked by the server before the render and by the api on every call.
 */
export async function AdminShell({ children }: { children: ReactNode }) {
  const t = await getTranslations('web.admin');
  const a11y = await getTranslations('web.a11y');
  return (
    <InteractiveRuntime scope="admin">
      <DataProvider>
        <UrlStateProvider>
          <AnnouncerProvider>
            <div className="flex min-h-dvh flex-col" data-density="compact">
              <header className="sticky top-0 z-(--z-header) border-b border-border bg-background">
                <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
                  <AdminMenu />
                  <Link
                    href={routes.admin}
                    aria-label={a11y('homeLink')}
                    className="shrink-0 rounded-md"
                  >
                    <BrandSymbol />
                  </Link>
                  <Badge tone="accent">{t('label')}</Badge>
                  <div className="ml-auto flex items-center gap-1">
                    <ThemeToggle />
                    <SignOutButton />
                  </div>
                </div>
              </header>
              <div className="flex flex-1">
                <aside
                  aria-label={t('nav.label')}
                  className="hidden w-60 shrink-0 border-r border-border bg-surface-sunken/50 p-3 lg:block"
                >
                  <div className="sticky top-20">
                    <AdminNav />
                  </div>
                </aside>
                <Main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</Main>
              </div>
            </div>
            <RouteFocus />
          </AnnouncerProvider>
        </UrlStateProvider>
      </DataProvider>
    </InteractiveRuntime>
  );
}
