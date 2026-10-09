'use client';

import { useMemberNetworkControllerRelationship } from '@pitchorium/api-client';
import type { MemberCard } from '@pitchorium/contracts';
import { useFormatter, useTranslations } from 'next-intl';
import { type ReactNode, useState } from 'react';
import { Avatar, Badge, HoverCard, Skeleton } from '@/components/ui';
import { routes } from '@/config/routes';
import { Link } from '@/i18n/navigation';
import { usePlural } from '@/lib/i18n/plural';

/**
 * The name of a member, with a preview of their profile on hover and on keyboard focus (500 ms,
 * HoverCard): photo, name and title from the card the page already has, then, for a signed-in
 * reader, the degree of relation and the connections in common, read at the first opening. The
 * name stays a link to the profile: the preview is never the only way to it.
 */
export function MemberHoverCard({
  member,
  signedIn,
  children,
  className,
}: {
  member: MemberCard;
  /** A visitor sees the card only: the relationship needs a session. */
  signedIn: boolean;
  /** The visible name, by default the display name. */
  children?: ReactNode;
  className?: string;
}) {
  const [opened, setOpened] = useState(false);
  return (
    <HoverCard
      onOpenChange={(open) => open && setOpened(true)}
      trigger={
        <Link
          href={routes.member(member.handle)}
          className={className ?? 'link-underline-hover font-medium text-foreground'}
        >
          {children ?? member.displayName}
        </Link>
      }
    >
      <div className="grid gap-3">
        <div className="flex items-start gap-3">
          <Avatar name={member.displayName} src={member.avatarUrl} size="lg" decorative />
          <div className="grid min-w-0 gap-0.5">
            <p className="font-semibold break-words">{member.displayName}</p>
            {member.headline ? (
              <p className="line-clamp-2 text-sm text-muted">{member.headline}</p>
            ) : null}
          </div>
        </div>
        {signedIn && opened ? <RelationLine handle={member.handle} /> : null}
      </div>
    </HoverCard>
  );
}

function RelationLine({ handle }: { handle: string }) {
  const t = useTranslations('web.profile.hover');
  const reference = useTranslations('reference.relationDegrees');
  const format = useFormatter();
  const plural = usePlural();
  const relationship = useMemberNetworkControllerRelationship(handle, {
    query: { staleTime: 60_000, retry: false },
  });
  if (relationship.isPending) return <Skeleton className="h-5 w-40" />;
  if (!relationship.data || relationship.data.degree === 'self') return null;
  const { degree, mutualConnections } = relationship.data;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <Badge tone="accent">{reference(degree)}</Badge>
      {mutualConnections.count > 0 ? (
        <span className="text-muted">
          {t(`mutual.${plural(mutualConnections.count)}`, {
            count: `${format.number(mutualConnections.count)}${mutualConnections.capped ? '+' : ''}`,
          })}
        </span>
      ) : null}
    </div>
  );
}
