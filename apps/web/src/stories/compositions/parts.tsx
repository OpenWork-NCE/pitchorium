import type { MemberCard, Message, Notification } from '@pitchorium/contracts';
import { translate } from '@pitchorium/i18n';
import { useLocale } from 'next-intl';
import {
  Avatar,
  AvatarGroup,
  Button,
  Card,
  Heading,
  Progress,
  RelativeTime,
  Skeleton,
  Text,
} from '@/components/ui';
import { cn } from '@/lib/cn';

/**
 * Pieces of the reference compositions (Storybook only): the cards the business pages will build
 * from the design system, on the data the contracts describe. Not components of the app.
 */

export function PostSkeleton() {
  return (
    <Card padding="none" className="grid gap-3 p-5" aria-hidden>
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-full" />
        <div className="grid flex-1 gap-2">
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-11/12" />
      <Skeleton className="h-3 w-3/4" />
      <Skeleton className="h-9 w-full" />
    </Card>
  );
}

export function ProfileCard({ member, strength }: { member: MemberCard; strength: number }) {
  return (
    <Card padding="none" className="overflow-hidden">
      <div
        aria-hidden
        className="h-16 bg-accent-subtle bg-[url(/brand/overlay-desktop.svg)] bg-cover bg-center"
      />
      <div className="-mt-8 grid justify-items-center gap-2 px-5 pb-5 text-center">
        <Avatar
          name={member.displayName}
          src={member.avatarUrl}
          size="lg"
          className="ring-4 ring-surface"
        />
        <div className="grid gap-0.5">
          <Heading level={2} size="label">
            {member.displayName}
          </Heading>
          <Text size="sm" tone="muted">
            {member.headline}
          </Text>
        </div>
        <div className="mt-2 grid w-full gap-1.5 text-left">
          <div className="flex justify-between text-xs">
            <span className="text-muted">Force du profil</span>
            <span className="font-medium tabular-nums">{strength} %</span>
          </div>
          <Progress
            value={strength}
            label="Force du profil"
            valueText={`${strength} %`}
            size="sm"
          />
        </div>
        <Button variant="outline" size="sm" className="mt-2 w-full">
          Compléter mon profil
        </Button>
      </div>
    </Card>
  );
}

export function NotificationItem({ notification }: { notification: Notification }) {
  const locale = useLocale();
  const [first] = notification.actors;
  if (!first) return null;
  const others = notification.actorCount - 1;
  // The texts of the notifications namespace, shared with the emails (packages/i18n).
  const text = translate(
    locale,
    'notifications',
    `types.${notification.type}.${others > 0 ? 'many' : 'one'}`,
    {
      actor: first.displayName,
      others: String(others),
    },
  );
  return (
    <li>
      <a
        href="#notification"
        className={cn(
          'flex items-start gap-3 rounded-lg p-3 outline-none hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-focus',
          !notification.read && 'bg-accent-subtle/40',
        )}
      >
        {notification.actors.length > 1 ? (
          <AvatarGroup
            size="xs"
            label={text}
            people={notification.actors.map((actor) => ({ name: actor.displayName }))}
          />
        ) : (
          <Avatar name={first.displayName} size="sm" decorative />
        )}
        <div className="min-w-0 flex-1">
          <p className={cn('text-sm', !notification.read && 'font-medium')}>{text}</p>
          <RelativeTime date={notification.createdAt} className="text-xs text-muted" />
        </div>
        {notification.read ? null : (
          <span
            aria-label="Non lue"
            role="img"
            className="mt-1.5 size-2 shrink-0 rounded-full bg-accent"
          />
        )}
      </a>
    </li>
  );
}

export function ConversationThread({
  messages,
  other,
}: {
  messages: readonly Message[];
  other: MemberCard;
}) {
  return (
    <ol className="grid gap-3">
      {messages.map((message) => (
        <li
          key={message.id}
          className={cn('flex items-end gap-2', message.mine && 'flex-row-reverse')}
        >
          {message.mine ? null : <Avatar name={other.displayName} size="xs" decorative />}
          <div
            className={cn(
              'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm text-pretty',
              message.mine
                ? 'rounded-br-md bg-accent text-on-accent'
                : 'rounded-bl-md bg-surface-sunken text-foreground',
            )}
          >
            <p>{message.body}</p>
            <RelativeTime
              date={message.createdAt}
              className={cn(
                'mt-1 block text-[0.6875rem]',
                message.mine ? 'text-on-accent/80' : 'text-muted',
              )}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}
