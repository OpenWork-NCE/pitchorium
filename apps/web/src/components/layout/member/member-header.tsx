'use client';

import type { CountersDtoOutput } from '@pitchorium/api-client';
import { useTranslations } from 'next-intl';
import { BrandSymbol } from '@/components/brand';
import { routes } from '@/config/routes';
import { GlobalSearch } from '@/features/discovery';
import { UserMenu } from '@/features/identity';
import { useCounters } from '@/features/notifications';
import { Link } from '@/i18n/navigation';
import { ContextualAction } from './contextual-action';
import { MemberNav, MobileSectionLinks } from './member-nav';
import { MobileMenu } from './mobile-menu';
import { useQuickActions } from './quick-actions';

/**
 * Header of the member space (§6.1): no bottom tab bar, even on a phone (§6.2). Wide: the logo,
 * the global search, the sections, the action of the context and the menu of the account.
 * Narrow: the logo, the search, Messages and Notifications with their counts, and a menu button
 * that opens the other sections in a panel.
 */
export function MemberHeader({ initialCounters }: { initialCounters: CountersDtoOutput | null }) {
  const t = useTranslations('web.nav');
  const a11y = useTranslations('web.a11y');
  const { data: counters } = useCounters(initialCounters);
  const actions = useQuickActions();

  return (
    <header className="sticky top-0 z-(--z-header) border-b border-border bg-background">
      <div className="mx-auto flex h-(--header-height) max-w-7xl items-center gap-3 px-4 sm:px-6 lg:gap-4">
        <Link
          href={routes.feed}
          aria-label={a11y('homeLink')}
          className="-ml-2 shrink-0 rounded-md"
        >
          <BrandSymbol />
        </Link>
        <div className="min-w-0 flex-1 max-sm:hidden lg:max-w-56 xl:max-w-sm">
          <GlobalSearch actions={actions} display="field" />
        </div>
        <div className="ml-auto flex items-center sm:hidden">
          <GlobalSearch actions={actions} display="icon" />
        </div>
        <MobileSectionLinks counters={counters} />
        <div className="hidden h-full items-center gap-4 lg:ml-auto lg:flex">
          <MemberNav counters={counters} />
          <ContextualAction display="button" />
          <UserMenu />
        </div>
        <MobileMenu counters={counters} label={t('menu')} />
      </div>
    </header>
  );
}
