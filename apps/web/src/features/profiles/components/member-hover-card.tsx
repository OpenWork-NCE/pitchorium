'use client';

import type { MemberCard } from '@pitchorium/contracts';
import { lazy, type ReactNode, Suspense, useState } from 'react';
import { Avatar, HoverCard, Skeleton } from '@/components/ui';
import { routes } from '@/config/routes';
import { Link } from '@/i18n/navigation';

/** The relation, read at the first opening: its query (and the client of the api) loads then. */
const RelationLine = lazy(() => import('./member-relation-line'));

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
          // Lists and feeds name dozens of members: their pages are not fetched in advance.
          prefetch={false}
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
        {signedIn && opened ? (
          <Suspense fallback={<Skeleton className="h-5 w-40" />}>
            <RelationLine handle={member.handle} />
          </Suspense>
        ) : null}
      </div>
    </HoverCard>
  );
}
