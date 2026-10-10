'use client';

import { useTranslations } from 'next-intl';
import { routes } from '@/config/routes';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/cn';
import { useCurrentMember } from '../current-member';

/**
 * Sections of the settings, one address each. The sections of the next prompts (notifications,
 * personal data) appear only once delivered: no empty page. The payout and the identity check
 * (`payouts`) concern the members who carry projects: shown with an entrepreneur facet.
 */
export const SETTINGS_SECTIONS = [
  { id: 'account', href: routes.settingsAccount },
  { id: 'security', href: routes.settingsSecurity },
  { id: 'privacy', href: routes.settingsPrivacy },
  { id: 'organizations', href: routes.settingsOrganizations },
  { id: 'preferences', href: routes.settingsPreferences },
  { id: 'payouts', href: routes.settingsPayouts },
] as const;

export function SettingsNav() {
  const t = useTranslations('web.settings');
  const pathname = usePathname();
  const entrepreneur = useCurrentMember().profile.facets.entrepreneur;
  const sections = SETTINGS_SECTIONS.filter(
    ({ id }) => id !== 'payouts' || entrepreneur || pathname === routes.settingsPayouts,
  );
  return (
    <nav aria-label={t('navLabel')} className="min-w-0">
      <ul className="flex gap-1 overflow-x-auto lg:grid">
        {sections.map(({ id, href }) => {
          const current = pathname === href;
          return (
            <li key={id}>
              <Link
                href={href}
                aria-current={current ? 'page' : undefined}
                className={cn(
                  'block rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors duration-(--duration-micro) hover:bg-surface-sunken lg:whitespace-normal',
                  current ? 'bg-accent-subtle text-on-accent-subtle' : 'text-muted',
                )}
              >
                {t(`sections.${id}`)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
