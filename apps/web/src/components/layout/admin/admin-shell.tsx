import type { ConsoleCapabilities } from '@pitchorium/contracts';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { BrandSymbol } from '@/components/brand';
import { AnnouncerProvider, Badge, ShortcutsProvider, ThemeToggle } from '@/components/ui';
import * as routes from '@/config/paths';
import { ConsoleAccessProvider } from '@/features/admin';
import { SignOutButton } from '@/features/identity';
import { Link } from '@/i18n/navigation';
import { DataProvider } from '../data-provider';
import { InteractiveRuntime } from '../interactive-runtime';
import { Main } from '../page-layouts';
import { RouteFocus } from '../route-focus';
import { UrlStateProvider } from '../url-state';
import { AdminMenu } from './admin-menu';
import { AdminNav } from './admin-nav';
import { AdminShortcuts } from './admin-shortcuts';

/**
 * Administration console (§13, §14, ADR 0078, ADR 0172): a dense internal tool, so a side
 * navigation is allowed here (direction.md), in a panel on a narrow screen. Moderators and
 * administrators only, checked by the server before the render and by the api on every call;
 * what the reader may do comes with the page (`capabilities`) and decides what the screens show.
 */
export async function AdminShell({
  capabilities,
  children,
}: {
  capabilities: ConsoleCapabilities;
  children: ReactNode;
}) {
  const t = await getTranslations('web.admin');
  const a11y = await getTranslations('web.a11y');
  const role = capabilities.roles.includes('admin') ? 'admin' : 'moderator';
  return (
    <InteractiveRuntime scope="admin">
      <DataProvider>
        <UrlStateProvider>
          <ConsoleAccessProvider capabilities={capabilities}>
            <AnnouncerProvider>
              <ShortcutsProvider>
                <div className="flex min-h-dvh flex-col" data-density="compact">
                  <header className="sticky top-0 z-(--z-header) border-b border-border bg-background">
                    <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
                      <AdminMenu />
                      <Link
                        href={routes.admin}
                        aria-label={a11y('homeLink')}
                        className="shrink-0 rounded-md"
                      >
                        <BrandSymbol />
                      </Link>
                      <Badge tone="accent">{t('label')}</Badge>
                      <span className="hidden text-sm text-muted sm:inline">
                        {t(`roles.${role}`)}
                      </span>
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
                      <div className="sticky top-18 max-h-[calc(100dvh-5rem)] overflow-y-auto">
                        <AdminNav />
                      </div>
                    </aside>
                    <Main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</Main>
                  </div>
                </div>
                <AdminShortcuts />
              </ShortcutsProvider>
              <RouteFocus />
            </AnnouncerProvider>
          </ConsoleAccessProvider>
        </UrlStateProvider>
      </DataProvider>
    </InteractiveRuntime>
  );
}
