'use client';

import { useTranslations } from 'next-intl';
import { useShortcut } from '@/components/ui';
import * as routes from '@/config/paths';
import { useConsoleStates } from '@/features/admin';
import { useRouter } from '@/i18n/navigation';

/**
 * Keyboard of the console (ADR 0098): `g` then a letter goes to a screen the reader may open,
 * `?` lists them (ShortcutsProvider); a list adds `/` for its search.
 */
export function AdminShortcuts() {
  const t = useTranslations('web.admin.shortcuts');
  const router = useRouter();
  const stateOf = useConsoleStates();
  const go = (href: string, open: boolean) => () => {
    if (open) router.push(href);
  };
  const group = t('group');
  useShortcut({
    keys: 'g d',
    label: t('dashboard'),
    group,
    run: go(routes.admin, stateOf('admin.console.read').visible),
  });
  useShortcut({
    keys: 'g m',
    label: t('moderation'),
    group,
    run: go(routes.adminModeration, stateOf('trust.moderation.read').visible),
  });
  useShortcut({
    keys: 'g a',
    label: t('appeals'),
    group,
    run: go(routes.adminAppeals, stateOf('trust.moderation.read').visible),
  });
  useShortcut({
    keys: 'g u',
    label: t('members'),
    group,
    run: go(routes.adminMembers, stateOf('admin.members.read').visible),
  });
  return null;
}
