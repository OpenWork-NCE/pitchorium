import type { ReactNode } from 'react';
import { BrandLogo } from '@/components/brand';
import { ThemeToggle } from '@/components/ui';
import { routes } from '@/config/routes';
import { LocaleSwitcher } from '@/features/localization';
import { Link } from '@/i18n/navigation';
import { getTranslations } from 'next-intl/server';
import { InteractiveRuntime } from '../interactive-runtime';
import { Main } from '../page-layouts';

/**
 * Sign-in, sign-up, verification, reset and onboarding: one centred column on the discreet
 * background of the brand (its light or dark variant), the logo above, the language and the
 * theme at hand. Nothing else competes with the form.
 */
export async function AuthShell({ children }: { children: ReactNode }) {
  const a11y = await getTranslations('web.a11y');
  return (
    <InteractiveRuntime scope="auth">
      <div className="relative flex min-h-dvh flex-col bg-background">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[url(/brand/background-mobile-light-discreet.svg)] bg-cover bg-bottom md:bg-[url(/brand/background-desktop-light-discreet.svg)] md:bg-right dark:bg-[url(/brand/background-mobile-dark-discreet.svg)] md:dark:bg-[url(/brand/background-desktop-dark-discreet.svg)]"
        />
        <div className="relative mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href={routes.home} aria-label={a11y('homeLink')} className="-ml-1 rounded-md">
            <BrandLogo />
          </Link>
          <div className="flex items-center gap-1">
            <LocaleSwitcher />
            <ThemeToggle />
          </div>
        </div>
        <Main className="relative flex flex-1 items-start justify-center px-4 pt-6 pb-16 sm:items-center sm:px-6">
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">
            {children}
          </div>
        </Main>
      </div>
    </InteractiveRuntime>
  );
}
