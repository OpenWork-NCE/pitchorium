'use client';

import { Languages } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { useActiveLocales } from './active-locales';

/**
 * Language selector, always visible (§8.3) but limited to the active locales: absent when only
 * one is active. The choice is remembered in the locale cookie by next-intl.
 */
export function LocaleSwitcher() {
  const t = useTranslations('web.locale');
  const locale = useLocale();
  const locales = useActiveLocales();
  const pathname = usePathname();
  const router = useRouter();

  if (locales.length < 2) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={t('label')}>
          <Languages aria-hidden />
          <span aria-hidden>{locale.toUpperCase()}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={locale}
          onValueChange={(next) => {
            const target = routing.locales.find((candidate) => candidate === next);
            if (target) router.replace(`${pathname}${window.location.search}`, { locale: target });
          }}
        >
          {locales.map((code) => (
            <DropdownMenuRadioItem key={code} value={code} lang={code}>
              {t(`names.${code}`)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
