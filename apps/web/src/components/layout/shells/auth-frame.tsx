import type { ReactNode } from 'react';
import { preload } from 'react-dom';
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
  /** The promise of §3, with « Afrique–Diaspora » kept on one line. */
  promise: ReactNode;
  lede: string;
}

/**
 * Split screen of the authentication (AuthShell): the form on the right, the editorial panel of
 * the brand on the left (matter, elevation pattern, the promise of §3, revealed in D4), deep violet
 * in both themes; on a phone, one column, the form first and the panel right after it. One logo
 * only: the discreet backgrounds of the kit carry their own logotype, so the form column keeps
 * the plain background. Without server code, for Storybook too.
 */
export function AuthFrame({ texts, children }: { texts: AuthFrameTexts; children: ReactNode }) {
  // The pattern of the panel is the largest paint of the page: a background of the stylesheet,
  // asked only once the stylesheet is applied (LCP 2.4 s on a slow 4G phone). Preloaded from the
  // head, each variant for the screens that paint it, it arrives with the stylesheet.
  preload('/brand/overlay-mobile.svg', {
    as: 'image',
    fetchPriority: 'high',
    media: '(max-width: 1023.98px)',
  });
  preload('/brand/overlay-desktop.svg', {
    as: 'image',
    fetchPriority: 'high',
    media: '(min-width: 1024px)',
  });
  return (
    <div className="group/auth flex min-h-dvh flex-col bg-background lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="relative order-1 flex flex-col lg:order-2 lg:min-h-dvh">
        <div className="relative flex w-full items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-10">
          <Link href={routes.home} aria-label={texts.homeLink} className="-ml-1 rounded-md">
            <BrandLogo />
          </Link>
          <div className="flex items-center gap-1">
            <LocaleSwitcher />
            <ThemeToggle />
          </div>
        </div>
        <Main className="relative flex flex-1 items-start justify-center px-4 pt-2 pb-10 sm:px-6 lg:items-center lg:pb-16">
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
            {children}
          </div>
        </Main>
      </div>
      {/* On a phone, invisible while the page streams in (loading.tsx of the group): painted under an
          empty card, the panel was pushed down by the form (layout shift of 0.33 on one load in
          three on a slow network). Invisible, its moves are not shifts, and its background, the
          largest paint of the page, still loads at once. */}
      <aside
        aria-label={texts.label}
        className="relative order-2 flex-1 overflow-hidden bg-brand-panel px-6 py-12 text-on-brand-panel max-lg:group-has-[[data-page-loading]]/auth:invisible sm:px-10 lg:order-1 lg:flex lg:min-h-dvh lg:flex-col lg:justify-end lg:p-14"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[url(/brand/overlay-mobile.svg)] bg-cover bg-center opacity-80 lg:bg-[url(/brand/overlay-desktop.svg)] lg:bg-[length:220%] lg:bg-[position:85%_30%]"
        />
        <div className="editorial-reveal relative grid max-w-lg min-w-0 gap-5">
          <p className="text-sm font-semibold tracking-wide uppercase opacity-80">{texts.kicker}</p>
          {/* « Afrique–Diaspora » never breaks: the size keeps it within the panel at every width. */}
          <p className="font-display text-3xl font-extrabold text-balance xl:text-4xl 2xl:text-5xl">
            {texts.promise}
          </p>
          <p className="text-base text-pretty opacity-90 lg:text-lg">{texts.lede}</p>
        </div>
      </aside>
    </div>
  );
}
