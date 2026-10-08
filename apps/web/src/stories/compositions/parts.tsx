import type {
  MemberCard,
  Message,
  Notification,
  Post,
  ProjectCard,
  ProjectTier,
} from '@pitchorium/contracts';
import { MessageSquare, MoreHorizontal, Repeat2, ThumbsUp } from 'lucide-react';
import { translate } from '@pitchorium/i18n';
import { useLocale, useTranslations } from 'next-intl';
import {
  Avatar,
  AvatarGroup,
  Badge,
  Button,
  Card,
  FundingProgress,
  Heading,
  IconButton,
  ImpactBadge,
  Notice,
  Progress,
  RelativeTime,
  Skeleton,
  Text,
  Truncate,
} from '@/components/ui';
import { cn } from '@/lib/cn';

/**
 * Pieces of the reference compositions (Storybook only): the cards the business pages will build
 * from the design system, on the data the contracts describe. Not components of the app.
 */

export function PostCard({ post }: { post: Post }) {
  const reactions = useTranslations('reference.reactionTypes');
  if (post.author.type !== 'member') return null;
  const author = post.author.member;
  return (
    <article aria-label={`Publication de ${author.displayName}`}>
      <Card padding="none" className="grid gap-3 p-5">
        <div className="flex items-start gap-3">
          <Avatar name={author.displayName} src={author.avatarUrl} decorative />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{author.displayName}</p>
            <p className="truncate text-sm text-muted">{author.headline}</p>
            <RelativeTime date={post.createdAt} className="text-xs text-muted" />
          </div>
          <IconButton label="Plus d’actions" icon={<MoreHorizontal />} size="sm" />
        </div>
        <Truncate lines={4}>
          <p className="text-pretty">{post.text}</p>
        </Truncate>
        <div className="flex items-center justify-between text-xs text-muted">
          <span>
            {post.reactions.total} · {reactions('bravo')}
          </span>
          <span>{post.commentCount} commentaires</span>
        </div>
        <div className="-mx-2 flex border-t border-border pt-2">
          <Button variant="ghost" size="sm" className="flex-1">
            <ThumbsUp aria-hidden /> {reactions('like')}
          </Button>
          <Button variant="ghost" size="sm" className="flex-1">
            <MessageSquare aria-hidden /> Commenter
          </Button>
          <Button variant="ghost" size="sm" className="flex-1">
            <Repeat2 aria-hidden /> Repartager
          </Button>
        </div>
      </Card>
    </article>
  );
}

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

export function PersonRow({ member, reason }: { member: MemberCard; reason: string }) {
  return (
    <li className="flex items-start gap-3">
      <Avatar name={member.displayName} src={member.avatarUrl} size="sm" decorative />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{member.displayName}</p>
        <p className="line-clamp-2 text-xs text-muted">{reason}</p>
      </div>
      <Button variant="secondary" size="sm">
        Suivre
      </Button>
    </li>
  );
}

export function ProjectCardView({
  project,
  tiers,
}: {
  project: ProjectCard;
  tiers: readonly ProjectTier[];
}) {
  const reference = useTranslations('reference');
  if (!project.funding.goal) return null;
  const demo = ['criterion01', 'criterion02', 'criterion03'] as const;
  return (
    <Card padding="none" surface="interactive" className="relative grid gap-4 overflow-hidden">
      <div
        aria-hidden
        className="h-32 bg-surface-sunken bg-[url(/brand/overlay-desktop.svg)] bg-cover bg-center"
      />
      <div className="grid gap-4 px-5 pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent">En financement</Badge>
          <Badge>Énergie</Badge>
          <Badge>Sénégal</Badge>
        </div>
        <div className="grid gap-1">
          <Heading level={3} size="card">
            <a href="#projet" className="after:absolute after:inset-0 focus-visible:outline-none">
              {project.title}
            </a>
          </Heading>
          <Text size="sm" tone="muted">
            {project.summary}
          </Text>
        </div>
        <FundingProgress
          label={`Financement de ${project.title}`}
          raised={project.funding.collected}
          goal={project.funding.goal}
          daysLeft={project.funding.daysLeft}
          milestones={tiers.map((tier) => ({
            amountMinor: tier.threshold.amountMinor,
            label: tier.description,
          }))}
        />
        {project.impact ? (
          <div className="relative z-[1] grid gap-2">
            <ImpactBadge
              level={project.impact.level}
              levelLabel={reference(`impactLevels.${project.impact.level}`)}
              score={project.impact.score}
              mention={reference('impactMentions.selfDeclared', {
                version: `v${project.impact.methodologyVersion}`,
              })}
              criteria={demo.map((key, index) => ({
                label: reference(`impactDemo.${key}.label`),
                score: 5 - index,
                max: 5,
              }))}
            />
            <Notice kind="selfDeclared" version={`v${project.impact.methodologyVersion}`} />
          </div>
        ) : null}
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
