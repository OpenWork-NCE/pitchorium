import type { ReactNode } from 'react';
import { BrandLogo } from '@/components/brand';
import { ThemeToggle } from '@/components/ui';
import { routes } from '@/config/routes';
import { LocaleSwitcher } from '@/features/localization';
import { Link } from '@/i18n/navigation';
import { Main } from '../page-layouts';

export interface AuthFrameTexts {
  homeLink: string;
  label: string;
  kicker: string;
  promise: string;
  lede: string;
}

/**
 * Split screen of the authentication (AuthShell): the form on the right, the editorial panel of
 * the brand on the left (matter, elevation pattern, the promise of §3, revealed in D4); on a
 * phone, one column, the form first. Without server code, for Storybook too.
 */
export function AuthFrame({ texts, children }: { texts: AuthFrameTexts; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="relative order-1 flex min-h-dvh flex-col lg:order-2">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[url(/brand/background-mobile-light-discreet.svg)] bg-cover bg-bottom lg:hidden dark:bg-[url(/brand/background-mobile-dark-discreet.svg)]"
        />
        <div className="relative flex w-full items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-10">
          <Link href={routes.home} aria-label={texts.homeLink} className="-ml-1 rounded-md">
            <BrandLogo />
          </Link>
          <div className="flex items-center gap-1">
            <LocaleSwitcher />
            <ThemeToggle />
          </div>
        </div>
        <Main className="relative flex flex-1 items-start justify-center px-4 pt-4 pb-16 sm:items-center sm:px-6">
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
            {children}
          </div>
        </Main>
      </div>
      <aside
        aria-label={texts.label}
        className="relative order-2 overflow-hidden bg-accent px-6 py-12 text-on-accent sm:px-10 lg:order-1 lg:flex lg:min-h-dvh lg:flex-col lg:justify-end lg:p-14"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[url(/brand/overlay-mobile.svg)] bg-cover bg-center opacity-80 lg:bg-[url(/brand/overlay-desktop.svg)] lg:bg-[length:220%] lg:bg-[position:85%_30%]"
        />
        <div className="editorial-reveal relative grid max-w-lg gap-5">
          <p className="text-sm font-semibold tracking-wide uppercase opacity-80">{texts.kicker}</p>
          <p className="font-display text-3xl font-extrabold text-balance lg:text-5xl">
            {texts.promise}
          </p>
          <p className="text-base text-pretty opacity-90 lg:text-lg">{texts.lede}</p>
        </div>
      </aside>
    </div>
  );
}
