'use client';

import type { CountersDtoOutput } from '@pitchorium/api-client';
import {
  Bell,
  CircleUser,
  FolderKanban,
  House,
  type LucideIcon,
  MessageSquare,
  Users,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef } from 'react';
import { SharedIndicator } from '@/components/motion';
import { CountBadge, useAnnounce, useShortcuts } from '@/components/ui';
import { routes } from '@/config/routes';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/cn';
import { usePlural } from '@/lib/i18n/plural';

export interface NavItem {
  key: 'home' | 'network' | 'projects' | 'messages' | 'notifications' | 'profile';
  href: string;
  icon: LucideIcon;
  /** Second key of its `g` shortcut. */
  shortcut: string;
}

/** The sections of the header (§6.1), in this order. */
export const NAV_ITEMS: readonly NavItem[] = [
  { key: 'home', href: routes.feed, icon: House, shortcut: 'a' },
  { key: 'network', href: routes.network, icon: Users, shortcut: 'r' },
  { key: 'projects', href: routes.projects, icon: FolderKanban, shortcut: 'p' },
  { key: 'messages', href: routes.messages, icon: MessageSquare, shortcut: 'm' },
  { key: 'notifications', href: routes.notifications, icon: Bell, shortcut: 'n' },
  { key: 'profile', href: routes.profile, icon: CircleUser, shortcut: 'u' },
];

/** Sections that stay in the narrow header, with their counts (the others are in the panel). */
export const HEADER_ITEMS: readonly NavItem['key'][] = ['messages', 'notifications'];

/** The item of a path: its first segment (`/messages/123` is in Messages). */
export function activeItem(pathname: string): NavItem['key'] | undefined {
  const segment = `/${pathname.split('/')[1] ?? ''}`;
  return NAV_ITEMS.find((item) => item.href === segment)?.key;
}

/** Count of an item to act on: unread messages and message requests, unread notifications. */
export function countOf(key: NavItem['key'], counters: CountersDtoOutput | undefined): number {
  if (!counters) return 0;
  if (key === 'messages') return counters.messages.unread + counters.messageRequests;
  if (key === 'notifications') return counters.notifications;
  return 0;
}

/**
 * What an item adds to its visible label for screen readers (", 3 messages non lus"): the name
 * comes from the content, the visible label first (WCAG 2.5.3, label in name).
 */
export function useCountText() {
  const counts = useTranslations('web.counters');
  const plural = usePlural();
  return (key: NavItem['key'], count: number) =>
    count > 0 && (key === 'messages' || key === 'notifications')
      ? `, ${counts(`${key}.${plural(count)}`, { count })}`
      : '';
}

/**
 * Navigation of the wide header: icon above label, the count of what is to act on, an indicator
 * that glides to the active section (layout animation). The `g` shortcuts go to the sections; a
 * change of a count is announced politely.
 */
export function MemberNav({ counters }: { counters: CountersDtoOutput | undefined }) {
  const t = useTranslations('web.nav');
  const counts = useTranslations('web.counters');
  const shortcuts = useTranslations('web.shortcuts');
  const plural = usePlural();
  const pathname = usePathname();
  const router = useRouter();
  const announce = useAnnounce();
  const layoutId = useId();
  const countText = useCountText();
  const active = activeItem(pathname);
  const previous = useRef<{ messages: number; notifications: number } | null>(null);

  useShortcuts(
    NAV_ITEMS.map((item) => ({
      keys: `g ${item.shortcut}`,
      label: () => shortcuts('goTo', { section: t(item.key) }),
      group: shortcuts('navigation'),
      run: () => router.push(item.href),
    })),
  );

  const messages = countOf('messages', counters);
  const notifications = countOf('notifications', counters);
  useEffect(() => {
    const before = previous.current;
    previous.current = { messages, notifications };
    if (!before) return;
    if (notifications > before.notifications) {
      announce(counts(`notifications.${plural(notifications)}`, { count: notifications }));
    }
    if (messages > before.messages)
      announce(counts(`messages.${plural(messages)}`, { count: messages }));
  }, [messages, notifications, announce, counts, plural]);

  return (
    <nav aria-label={t('primary')} className="h-full">
      <ul className="flex h-full items-stretch">
        {NAV_ITEMS.map((item) => {
          const isActive = item.key === active;
          const count = countOf(item.key, counters);
          const Icon = item.icon;
          return (
            <li key={item.key} className="relative flex">
              <Link
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'relative flex min-w-[4.5rem] flex-col items-center justify-center gap-1 rounded-md px-2 text-xs font-medium outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
                  isActive ? 'text-foreground' : 'text-muted hover:text-foreground',
                )}
              >
                <Icon aria-hidden className="size-5" />
                <span>
                  {t(item.key)}
                  <span className="sr-only">{countText(item.key, count)}</span>
                </span>
                <CountBadge count={count} className="absolute top-1.5 left-1/2 ml-1" />
              </Link>
              {isActive ? (
                <SharedIndicator
                  layoutId={layoutId}
                  className="inset-x-2 -bottom-px h-0.5 rounded-full bg-accent"
                />
              ) : null}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Messages and Notifications in the narrow header, icons with their counts: what is to act on
 * stays one tap away, the other sections are in the panel of the menu.
 */
export function MobileSectionLinks({ counters }: { counters: CountersDtoOutput | undefined }) {
  const t = useTranslations('web.nav');
  const pathname = usePathname();
  const active = activeItem(pathname);
  const countText = useCountText();
  return (
    <ul className="flex items-center gap-1 max-sm:ml-0 sm:ml-auto lg:hidden">
      {NAV_ITEMS.filter((item) => HEADER_ITEMS.includes(item.key)).map((item) => {
        const Icon = item.icon;
        const count = countOf(item.key, counters);
        return (
          <li key={item.key}>
            <Link
              href={item.href}
              aria-current={item.key === active ? 'page' : undefined}
              className={cn(
                'relative inline-flex size-11 items-center justify-center rounded-full outline-none hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-focus',
                item.key === active ? 'text-foreground' : 'text-muted',
              )}
            >
              <Icon aria-hidden className="size-5" />
              <span className="sr-only">
                {t(item.key)}
                {countText(item.key, count)}
              </span>
              <CountBadge count={count} className="absolute top-0.5 right-0.5" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
