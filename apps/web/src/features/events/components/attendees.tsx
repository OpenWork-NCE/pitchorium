'use client';

import { eventsControllerAttendees } from '@pitchorium/api-client';
import type { EventAttendee } from '@pitchorium/contracts';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import {
  Avatar,
  Badge,
  EmptyState,
  ErrorState,
  Loading,
  Pagination,
  Skeleton,
  Text,
} from '@/components/ui';
import * as routes from '@/config/paths';
import { Link } from '@/i18n/navigation';

const PAGE = 20;

/**
 * The participants of an event as the api shows them (ADR 0070): every registration for its
 * organizers, waiting list included; for a registered member, the registered members who agreed
 * to appear; nothing for the others, who are told why.
 */
export function Attendees({
  eventId,
  canRead,
  manager,
}: {
  eventId: string;
  canRead: boolean;
  manager: boolean;
}) {
  const t = useTranslations('web.events.attendees');
  const statuses = useTranslations('reference.eventRegistrationStatuses');
  const list = useInfiniteQuery({
    queryKey: ['events', eventId, 'attendees'],
    queryFn: ({ pageParam, signal }) =>
      eventsControllerAttendees(
        eventId,
        { limit: PAGE, ...(pageParam ? { cursor: pageParam } : {}) },
        { signal },
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
    enabled: canRead,
  });
  if (!canRead) {
    return (
      <Text size="sm" tone="muted">
        {t('private')}
      </Text>
    );
  }
  if (list.isPending) {
    return (
      <Loading className="grid gap-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </Loading>
    );
  }
  if (list.isError) {
    return (
      <ErrorState
        title={t('error')}
        headingLevel={3}
        retrying={list.isRefetching}
        onRetry={() => void list.refetch()}
      />
    );
  }
  const items: EventAttendee[] = list.data.pages.flatMap((page) => page.items);
  if (items.length === 0) {
    return (
      <EmptyState
        size="inline"
        headingLevel={3}
        title={t('none')}
        description={manager ? t('noneManager') : t('noneHint')}
      />
    );
  }
  return (
    <div className="grid gap-3">
      <ul className="grid gap-2" aria-label={t('list')}>
        {items.map((attendee) => (
          <li key={attendee.member.handle} className="flex items-center gap-3">
            <Avatar
              name={attendee.member.displayName}
              src={attendee.member.avatarUrl}
              size="sm"
              decorative
            />
            <div className="grid min-w-0 flex-1">
              <Link
                href={routes.member(attendee.member.handle)}
                className="truncate link-underline-hover font-medium"
              >
                {attendee.member.displayName}
              </Link>
              {attendee.member.headline ? (
                <span className="truncate text-xs text-muted">{attendee.member.headline}</span>
              ) : null}
            </div>
            {manager ? <Badge>{statuses(attendee.status)}</Badge> : null}
          </li>
        ))}
      </ul>
      <Pagination
        hasMore={list.hasNextPage}
        loading={list.isFetchingNextPage}
        onLoadMore={() => void list.fetchNextPage()}
        shown={items.length}
      />
    </div>
  );
}
