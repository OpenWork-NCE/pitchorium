import type { Notification } from '@pitchorium/contracts';
import {
  AtSign,
  Bell,
  Briefcase,
  Building2,
  CalendarDays,
  Clock,
  Eye,
  Flag,
  FolderKanban,
  HandCoins,
  Handshake,
  type LucideIcon,
  MessageCircle,
  MessageSquare,
  Newspaper,
  Shield,
  Sparkles,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { createElement } from 'react';
import { Avatar, AvatarGroup, RelativeTime } from '@/components/ui';
import { REACTION_ICONS } from '@/features/content';
import { ConnectionRequestActions } from '@/features/network';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/cn';

/** Drawing of each family of notifications, in the corner of its avatars. */
const FAMILIES: readonly [RegExp, LucideIcon][] = [
  [/^connection_request$/, UserPlus],
  [/^(connection_accepted|new_follower)$/, UserCheck],
  [/^comment$/, MessageCircle],
  [/^mention$/, AtSign],
  [/^followed_post$/, Newspaper],
  [/^message/, MessageSquare],
  [/^introduction_/, Handshake],
  [/^profile_views$/, Eye],
  [/^tier_unlocked$/, Flag],
  [/^(project_|offline_contribution_)/, FolderKanban],
  [/^contribution_/, HandCoins],
  [/^organization_/, Building2],
  [/^event_/, CalendarDays],
  [/^mission_/, Briefcase],
  [/^time_entry_/, Clock],
  [/^new_suggestions$/, Sparkles],
  [/^(report_|moderation_|suspension_|appeal_|security_|kyc_)/, Shield],
];

function iconOf(notification: Notification): LucideIcon {
  if (notification.type === 'reaction') {
    const reaction = notification.data['reaction'];
    return typeof reaction === 'string' && reaction in REACTION_ICONS
      ? REACTION_ICONS[reaction as keyof typeof REACTION_ICONS]
      : REACTION_ICONS.like;
  }
  return FAMILIES.find(([pattern]) => pattern.test(notification.type))?.[1] ?? Bell;
}

/**
 * A notification (§10.5): its avatars in a column of fixed width (every text starts at the same
 * place), the drawing of its type in their corner, its sentence, the opening of its target when
 * it is a publication, and the answer of a connection request right there. The whole line opens
 * the target; the controls in it stay controls of their own.
 */
export function NotificationItem({ notification }: { notification: Notification }) {
  const t = useTranslations('notifications.types');
  const ui = useTranslations('web.notifications');
  const [first] = notification.actors;
  const others = Math.max(0, notification.actorCount - 1);
  const values = { actor: first?.displayName ?? ui('someone'), others: String(others) };
  const key = `${notification.type}.${others > 0 ? 'many' : 'one'}` as Parameters<typeof t>[0];
  const text = t.has(key) ? t(key, values) : ui('generic');
  const requestId = notification.data['requestId'];

  return (
    <li
      className={cn(
        'relative flex items-start gap-3 rounded-lg p-3 focus-within:bg-surface-sunken hover:bg-surface-sunken',
        !notification.read && 'bg-accent-subtle/40',
      )}
    >
      <div aria-hidden className="relative flex w-12 shrink-0 justify-start">
        {notification.actors.length > 1 ? (
          <AvatarGroup
            size="xs"
            max={2}
            showRest={false}
            label=""
            people={notification.actors.map((actor) => ({
              name: actor.displayName,
              src: actor.avatarUrl,
            }))}
            className="pt-1"
          />
        ) : first ? (
          <Avatar name={first.displayName} src={first.avatarUrl} size="md" decorative />
        ) : (
          <span className="inline-flex size-10 items-center justify-center rounded-full bg-surface-sunken text-muted">
            <Bell className="size-5" />
          </span>
        )}
        <span className="absolute top-7.5 left-7.5 inline-flex size-6 items-center justify-center rounded-full bg-accent text-on-accent ring-2 ring-surface">
          {createElement(iconOf(notification), { className: 'size-4' })}
        </span>
      </div>
      <div className="grid min-w-0 flex-1 gap-1">
        <Link
          href={notification.target.path}
          className={cn(
            'rounded-xs text-sm text-pretty outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:outline-2 focus-visible:after:outline-focus',
            !notification.read && 'font-medium',
          )}
        >
          {text}
          {notification.read ? null : <span className="sr-only">{ui('unread')}</span>}
        </Link>
        {notification.excerpt ? (
          <p className="line-clamp-2 text-sm text-muted">
            {ui('excerpt', { text: notification.excerpt })}
          </p>
        ) : null}
        <RelativeTime
          date={notification.createdAt}
          className="relative z-[1] w-fit text-xs text-muted"
        />
        {notification.type === 'connection_request' && typeof requestId === 'string' && first ? (
          <div className="relative z-[1] mt-1">
            <ConnectionRequestActions requestId={requestId} name={first.displayName} />
          </div>
        ) : null}
      </div>
      {notification.read ? null : (
        <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" />
      )}
    </li>
  );
}
