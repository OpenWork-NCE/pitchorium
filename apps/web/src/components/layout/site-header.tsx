import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { BrandLogo, BrandSymbol } from '@/components/brand';
import { Button, ThemeToggle } from '@/components/ui';
import { routes } from '@/config/routes';
import { LocaleSwitcher } from '@/features/localization';
import { Link } from '@/i18n/navigation';

/**
 * Header of the editorial and public pages: horizontal logo aligned left (brand guide), the
 * symbol below 640 px, then the slot of the shell, the language, the theme and the sign-in.
 */
export function SiteHeader({ children }: { children?: ReactNode }) {
  const t = useTranslations('web.a11y');
  const nav = useTranslations('web.nav');
  return (
    <header className="sticky top-0 z-(--z-header) border-b border-border bg-background">
      <div className="mx-auto flex h-18 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link href={routes.home} aria-label={t('homeLink')} className="-ml-1 rounded-md">
          <BrandSymbol className="sm:hidden" />
          <BrandLogo className="hidden sm:block" />
        </Link>
        <div className="ml-auto flex items-center gap-1">
          {children}
          <LocaleSwitcher />
          <ThemeToggle />
          <Button asChild variant="outline" size="sm" className="ml-2">
            <Link href={routes.signIn}>{nav('signIn')}</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
