'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { LanguageSwitcher } from '@/components/ui';
import { usePathname } from '@/i18n/navigation';
import { useActiveLocales } from './active-locales';

/**
 * Language selector of the headers, always visible (§8.3) but limited to the active locales:
 * absent when only one is active. The path and the query stay the same, only the prefix changes
 * (ADR 0092); the proxy remembers the choice in the locale cookie.
 */
export function LocaleSwitcher() {
  const t = useTranslations('web.locale');
  const locale = useLocale();
  const locales = useActiveLocales();
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const suffix = `${pathname === '/' ? '' : pathname}${query ? `?${query}` : ''}`;
  return (
    <LanguageSwitcher
      label={t('label')}
      current={locale}
      options={locales.map((code) => ({
        code,
        label: t(`names.${code}`),
        href: `/${code}${suffix}`,
      }))}
    />
  );
}
