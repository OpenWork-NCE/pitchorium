'use client';

import { accountControllerUpdatePreferences } from '@pitchorium/api-client';
import type { Locale } from '@pitchorium/contracts';
import { usePathname, useRouter } from '@/i18n/navigation';
import { useActiveLocales } from './active-locales';

/**
 * Language change of a member: the account remembers it (`PUT /v1/me/preferences`, emails and
 * next sessions), then the same page opens in that language (only the prefix changes, ADR 0092;
 * the proxy writes the locale cookie). A failed save still changes the language of the page.
 */
export function useMemberLocaleChange(): {
  locales: readonly Locale[];
  change: (next: string) => Promise<void>;
} {
  const locales = useActiveLocales();
  const pathname = usePathname();
  const router = useRouter();
  return {
    locales,
    async change(next) {
      const target = locales.find((code) => code === next);
      if (!target) return;
      try {
        await accountControllerUpdatePreferences({ locale: target });
      } catch {
        // The preference is saved again at the next change; the page language changes anyway.
      }
      router.replace(`${pathname}${window.location.search}`, { locale: target });
    },
  };
}
