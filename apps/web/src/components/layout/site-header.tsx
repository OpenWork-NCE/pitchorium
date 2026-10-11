import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { BrandLogo, BrandSymbol } from '@/components/brand';
import { LogIn } from 'lucide-react';
import { Button, ThemeToggle } from '@/components/ui';
import * as routes from '@/config/paths';
import { LocaleSwitcher } from '@/features/localization';
import { Link } from '@/i18n/navigation';

/**
 * Header of the editorial and public pages: horizontal logo aligned left (brand guide), the
 * symbol below 640 px, the editorial pages from 1 024 px (the footer lists them below), then the
 * slot of the shell, the language, the theme, « Se connecter » as the second action and
 * « Rejoindre Pitchorium » as the main one. Below 640 px, both stay: « Rejoindre » in short and
 * the sign-in as an icon named by its label.
 */
export function SiteHeader({ children }: { children?: ReactNode }) {
  const t = useTranslations('web.a11y');
  const nav = useTranslations('web.nav');
  const pages = useTranslations('web.marketing.nav');
  return (
    <header className="sticky top-0 z-(--z-header) border-b border-border bg-background">
      <div className="mx-auto flex h-18 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link href={routes.home} aria-label={t('homeLink')} className="-ml-1 rounded-md">
          <BrandSymbol className="sm:hidden" />
          <BrandLogo className="hidden sm:block" />
        </Link>
        <nav aria-label={pages('label')} className="ml-4 hidden lg:block">
          <ul className="flex items-center gap-1 text-sm font-medium">
            {(
              [
                [routes.howItWorks, pages('howItWorks')],
                [routes.transparency, pages('transparency')],
                [routes.projects, pages('projects')],
              ] as const
            ).map(([href, label]) => (
              <li key={href}>
                <Link
                  href={href}
                  className="inline-flex h-9 items-center rounded-full px-3 text-muted hover:bg-surface-sunken hover:text-foreground"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-1">
          {children}
          <LocaleSwitcher />
          <ThemeToggle />
          <Button asChild variant="outline" size="sm" className="ml-2 hidden sm:inline-flex">
            <Link href={routes.signIn}>{nav('signIn')}</Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="sm:hidden"
            aria-label={nav('signIn')}
          >
            <Link href={routes.signIn}>
              <LogIn aria-hidden />
            </Link>
          </Button>
          <Button asChild size="sm" className="ml-1 sm:ml-2">
            <Link href={routes.signUp}>
              <span className="sm:hidden">{pages('joinShort')}</span>
              <span className="hidden sm:inline">{pages('join')}</span>
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
