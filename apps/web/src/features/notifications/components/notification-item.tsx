'use client';

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
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { createElement, useState } from 'react';
import { Avatar, AvatarGroup, Dialog, IconButton, RelativeTime } from '@/components/ui';
import { REACTION_ICONS } from '@/features/content';
import { ConnectionRequestActions } from '@/features/network';
import { LazyProjectInvitationDialogContent } from '@/features/projects';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/cn';
import { targetHref } from '../lib/target';
import { IntroductionAnswer } from './introduction-answer';

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

/** The values a sentence of `notifications.types` reads (the actor, the others, a title). */
function valuesOf(notification: Notification, someone: string): Record<string, string> {
  const [first] = notification.actors;
  const data = Object.fromEntries(
    Object.entries(notification.data).flatMap(([key, value]) =>
      typeof value === 'string' || typeof value === 'number' ? [[key, String(value)]] : [],
    ),
  );
  // The data of the source event first (a title, a count of visits), then the actors.
  return {
    count: String(notification.eventCount),
    title: '',
    position: '',
    ...data,
    actor: first?.displayName ?? someone,
    others: String(Math.max(0, notification.actorCount - 1)),
  };
}

interface NotificationItemProps {
  notification: Notification;
  /** Opened: marked read (at the click on its line). */
  onOpen?: (notification: Notification) => void;
  /** Removed from the list (the api deletes it). */
  onRemove?: (notification: Notification) => void;
}

/**
 * A notification (§10.5): its avatars in a column of fixed width (every text starts at the same
 * place), the drawing of its type in their corner, its sentence (« Amina et 12 autres ont réagi
 * à votre publication » for a group), the opening of the publication it concerns, and its direct
 * actions: a connection request answered, an introduction accepted or declined. The whole line
 * opens the target (a delivered page only) and marks it read; the controls in it stay controls.
 */
export function NotificationItem({ notification, onOpen, onRemove }: NotificationItemProps) {
  const t = useTranslations('notifications.types');
  const ui = useTranslations('web.notifications');
  const [first] = notification.actors;
  const others = Math.max(0, notification.actorCount - 1);
  const key = `${notification.type}.${others > 0 ? 'many' : 'one'}` as Parameters<typeof t>[0];
  const text = t.has(key) ? t(key, valuesOf(notification, ui('someone'))) : ui('generic');
  const requestId = notification.data['requestId'];
  // An invitation to the team of a project is answered in a dialog, with its consent (A1).
  const teamInvitation =
    notification.type === 'project_team_invitation' &&
    notification.target.type === 'project_invitations';
  const [answering, setAnswering] = useState(false);
  const href = teamInvitation ? null : targetHref(notification.target);
  const lineClass = cn(
    'rounded-xs text-sm text-pretty outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:outline-2 focus-visible:after:outline-focus',
    !notification.read && 'font-medium',
  );
  const content = (
    <>
      {text}
      {notification.read ? null : <span className="sr-only">{ui('unread')}</span>}
    </>
  );

  return (
    <li
      className={cn(
        'group/notification relative flex items-start gap-3 rounded-lg p-3 focus-within:bg-surface-sunken hover:bg-surface-sunken',
        !notification.read && 'bg-accent-subtle/40',
      )}
      data-notification-type={notification.type}
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
        {teamInvitation ? (
          <Dialog open={answering} onOpenChange={setAnswering}>
            <button
              type="button"
              aria-haspopup="dialog"
              onClick={() => {
                setAnswering(true);
                if (!notification.read) onOpen?.(notification);
              }}
              className={cn(lineClass, 'cursor-pointer text-left')}
            >
              {content}
            </button>
            {answering ? (
              <LazyProjectInvitationDialogContent
                slug={notification.target.key}
                title={String(notification.data['title'] ?? '')}
                onClose={() => setAnswering(false)}
              />
            ) : null}
          </Dialog>
        ) : href ? (
          <Link
            href={href}
            onClick={() => {
              if (!notification.read) onOpen?.(notification);
            }}
            className={lineClass}
          >
            {content}
          </Link>
        ) : (
          <p className={cn('text-sm text-pretty', !notification.read && 'font-medium')}>
            {content}
          </p>
        )}
        {notification.excerpt ? (
          <p className="line-clamp-2 text-sm text-muted">
            {ui('excerpt', { text: notification.excerpt })}
          </p>
        ) : null}
        <RelativeTime
          date={notification.updatedAt}
          className="relative z-[1] w-fit text-xs text-muted"
        />
        {notification.type === 'connection_request' && typeof requestId === 'string' && first ? (
          <div className="relative z-[1] mt-1">
            <ConnectionRequestActions requestId={requestId} name={first.displayName} />
          </div>
        ) : null}
        {notification.type === 'introduction_proposed' &&
        notification.target.type === 'introduction' ? (
          <div className="relative z-[1] mt-1">
            <IntroductionAnswer
              introductionId={notification.target.key}
              name={first?.displayName ?? ui('someone')}
            />
          </div>
        ) : null}
      </div>
      {notification.read ? null : (
        <span aria-hidden className="absolute top-4.5 left-1 size-2 rounded-full bg-accent" />
      )}
      <div className="relative z-[1] flex shrink-0 flex-col items-center gap-2">
        {onRemove ? (
          <IconButton
            size="sm"
            label={ui('remove')}
            icon={<X />}
            className="opacity-0 group-focus-within/notification:opacity-100 group-hover/notification:opacity-100 pointer-coarse:opacity-100"
            onClick={() => onRemove(notification)}
          />
        ) : null}
      </div>
    </li>
  );
}
