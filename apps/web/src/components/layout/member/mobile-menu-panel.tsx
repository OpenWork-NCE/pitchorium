'use client';

import type { CountersDtoOutput } from '@pitchorium/api-client';
import { Bookmark, LogOut } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTransition } from 'react';
import {
  Avatar,
  Button,
  CountBadge,
  Drawer,
  DrawerContent,
  Separator,
  ThemeSelector,
} from '@/components/ui';
import { routes } from '@/config/routes';
import { useCurrentMember, useSignOut } from '@/features/identity';
import { LocaleSwitcher } from '@/features/localization';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/cn';
import { ContextualAction } from './contextual-action';
import { activeItem, countOf, HEADER_ITEMS, NAV_ITEMS, useCountText } from './member-nav';

interface MobileMenuPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  counters: CountersDtoOutput | undefined;
  label: string;
}

/**
 * Content of the menu of a narrow screen: the sections not in the header, the followed projects
 * (the right column of a wide screen), the action and the account.
 */
export default function MobileMenuPanel({
  open,
  onOpenChange,
  counters,
  label,
}: MobileMenuPanelProps) {
  const t = useTranslations('web.nav');
  const member = useCurrentMember();
  const pathname = usePathname();
  const active = activeItem(pathname);
  const countText = useCountText();
  const signOut = useSignOut();
  const [pending, startTransition] = useTransition();

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent title={label} hideTitle>
        <nav aria-label={t('primary')}>
          <ul className="grid gap-1">
            {NAV_ITEMS.filter((item) => !HEADER_ITEMS.includes(item.key)).map((item) => {
              const Icon = item.icon;
              const count = countOf(item.key, counters);
              return (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    aria-current={item.key === active ? 'page' : undefined}
                    onClick={() => onOpenChange(false)}
                    className={cn(
                      'flex min-h-12 items-center gap-3 rounded-lg px-3 text-base outline-none focus-visible:outline-2 focus-visible:outline-focus',
                      item.key === active
                        ? 'bg-accent-subtle font-medium text-on-accent-subtle'
                        : 'hover:bg-surface-sunken',
                    )}
                  >
                    <Icon aria-hidden className="size-5" />
                    <span className="flex-1">
                      {t(item.key)}
                      <span className="sr-only">{countText(item.key, count)}</span>
                    </span>
                    <CountBadge count={count} />
                  </Link>
                </li>
              );
            })}
            <li>
              <Link
                href={routes.followedProjects}
                onClick={() => onOpenChange(false)}
                className="flex min-h-12 items-center gap-3 rounded-lg px-3 text-base outline-none hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-focus"
              >
                <Bookmark aria-hidden className="size-5" />
                <span className="flex-1">{t('followedProjects')}</span>
              </Link>
            </li>
          </ul>
        </nav>
        <div className="mt-4">
          <ContextualAction display="button" />
        </div>
        <Separator className="my-5" />
        <div className="grid gap-4">
          <div className="flex items-center gap-3">
            <Avatar name={member.profile.displayName} src={member.profile.avatarUrl} decorative />
            <div className="min-w-0">
              <p className="truncate font-semibold">{member.profile.displayName}</p>
              <p className="truncate text-sm text-muted">@{member.profile.handle}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={routes.saved} onClick={() => onOpenChange(false)}>
                {t('saved')}
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={routes.settings} onClick={() => onOpenChange(false)}>
                {t('settings')}
              </Link>
            </Button>
            <LocaleSwitcher />
          </div>
          <ThemeSelector />
          <Button
            variant="ghost"
            className="justify-start"
            loading={pending}
            loadingLabel={t('signingOut')}
            onClick={() => startTransition(signOut)}
          >
            <LogOut aria-hidden />
            {t('signOut')}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
