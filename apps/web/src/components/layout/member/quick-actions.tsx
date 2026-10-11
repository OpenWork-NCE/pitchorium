'use client';

import {
  BellOff,
  Briefcase,
  CalendarDays,
  CalendarPlus,
  Compass,
  FolderPlus,
  Keyboard,
  Moon,
  PenSquare,
  Sun,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { type CommandAction, notify, useShortcutsHelp } from '@/components/ui';
import * as routes from '@/config/paths';
import { useMarkAllNotificationsRead } from '@/features/notifications';
import { useRouter } from '@/i18n/navigation';
import { useOnline } from '@/lib/query/offline';
import { NAV_ITEMS } from './member-nav';

/**
 * Quick actions of the command palette: create (a publication, a project, an event), the
 * sections, « Découvrir », the events and the missions, mark the notifications as read
 * (sent once even offline, ADR 0097), the theme and the help of the shortcuts. Given as a
 * function: their labels are formatted when the palette opens, not while the page starts.
 */
export function useQuickActions(): () => CommandAction[] {
  const t = useTranslations('web.actions');
  const nav = useTranslations('web.nav');
  const router = useRouter();
  const online = useOnline();
  const { resolvedTheme, setTheme } = useTheme();
  const openHelp = useShortcutsHelp();
  const markAllRead = useMarkAllNotificationsRead();

  return () => [
    {
      id: 'publish',
      label: nav('publish'),
      icon: <PenSquare />,
      onSelect: () => router.push(routes.compose),
    },
    {
      id: 'create-project',
      label: nav('createProject'),
      icon: <FolderPlus />,
      onSelect: () => router.push(routes.createProject),
    },
    {
      id: 'create-event',
      label: t('createEvent'),
      icon: <CalendarPlus />,
      onSelect: () => router.push(routes.createEvent),
    },
    {
      id: 'go-discover',
      label: t('goTo', { section: t('discover') }),
      icon: <Compass />,
      onSelect: () => router.push(routes.discover),
    },
    {
      id: 'go-events',
      label: t('goTo', { section: t('events') }),
      icon: <CalendarDays />,
      onSelect: () => router.push(routes.events),
    },
    {
      id: 'go-missions',
      label: t('goTo', { section: t('missions') }),
      icon: <Briefcase />,
      onSelect: () => router.push(routes.missions),
    },
    ...NAV_ITEMS.map((item) => {
      const Icon = item.icon;
      return {
        id: `go-${item.key}`,
        label: t('goTo', { section: nav(item.key) }),
        icon: <Icon />,
        onSelect: () => router.push(item.href),
      };
    }),
    {
      id: 'mark-notifications-read',
      label: t('markAllRead'),
      icon: <BellOff />,
      keywords: [nav('notifications')],
      onSelect: () => {
        markAllRead.mutate(undefined, {
          onSuccess: () => notify.success(t('markAllReadDone')),
        });
        if (!online) notify.info(t('queued'));
      },
    },
    resolvedTheme === 'dark'
      ? { id: 'theme', label: t('toLight'), icon: <Sun />, onSelect: () => setTheme('light') }
      : { id: 'theme', label: t('toDark'), icon: <Moon />, onSelect: () => setTheme('dark') },
    { id: 'shortcuts', label: t('shortcuts'), icon: <Keyboard />, keys: ['?'], onSelect: openHelp },
  ];
}
