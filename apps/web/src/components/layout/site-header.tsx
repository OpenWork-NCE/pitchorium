import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { BrandLogo, BrandSymbol } from '@/components/brand';
import { routes } from '@/config/routes';
import { LocaleSwitcher } from '@/features/localization';
import { Link } from '@/i18n/navigation';
import { ThemeToggle } from './theme-toggle';

/**
 * Header of every shell: horizontal logo aligned left (brand guide), the symbol below 640 px,
 * then the slot of the shell, the language and the theme.
 */
export function SiteHeader({ children }: { children?: ReactNode }) {
  const t = useTranslations('web.a11y');
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
        </div>
      </div>
    </header>
  );
}
