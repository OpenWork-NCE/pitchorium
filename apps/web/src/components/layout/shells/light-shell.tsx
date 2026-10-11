import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { BrandLogo, BrandSymbol } from '@/components/brand';
import { buttonVariants } from '@/components/ui';
import * as routes from '@/config/paths';
import { cn } from '@/lib/cn';
import { LazyHeaderControls } from '../lazy-header-controls';
import { Main } from '../page-layouts';
import { Footer } from './parts';

/**
 * The shell of the localised 404 page: the editorial header and footer, with plain links and the
 * language and theme controls loaded after the page. That boundary is part of the first load of
 * every page of a locale; with no client code of its own, it no longer copies the shell's
 * components into each of them (FRONT 7, A2).
 */
export function LightShell({ children }: { children: ReactNode }) {
  const t = useTranslations('web.a11y');
  const nav = useTranslations('web.nav');
  const locale = useLocale();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-(--z-header) border-b border-border bg-background">
        <div className="mx-auto flex h-18 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <a href={`/${locale}`} aria-label={t('homeLink')} className="-ml-1 rounded-md">
            <BrandSymbol className="sm:hidden" />
            <BrandLogo className="hidden sm:block" />
          </a>
          <div className="ml-auto flex items-center gap-1">
            <LazyHeaderControls />
            <a
              href={`/${locale}${routes.signIn}`}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'ml-2')}
            >
              {nav('signIn')}
            </a>
          </div>
        </div>
      </header>
      <Main className="flex-1">{children}</Main>
      <Footer />
    </div>
  );
}
