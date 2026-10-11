'use client';

import {
  getMessagingControllerListQueryKey,
  messagingControllerList,
  type MessagingControllerListParams,
} from '@pitchorium/api-client';
import type { Conversation, CursorPage } from '@pitchorium/contracts';
import { useInfiniteQuery } from '@tanstack/react-query';
import { BellOff, Handshake, MessageSquare, Paperclip, Search } from 'lucide-react';
import { useFormatter, useLocale, useNow, useTimeZone, useTranslations } from 'next-intl';
import { useSelectedLayoutSegment } from 'next/navigation';
import { parseAsString, parseAsStringLiteral, useQueryState } from 'nuqs';
import { useEffect, useRef, useState } from 'react';
import {
  Avatar,
  AvatarGroup,
  Badge,
  Button,
  CountBadge,
  EmptyState,
  ErrorState,
  Input,
  Loading,
  Skeleton,
  FilterButtons,
} from '@/components/ui';
import { routes } from '@/config/routes';
import { useCounters } from '@/features/notifications';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/cn';
import { formatNames } from '@/lib/format/list';
import { usePlural } from '@/lib/i18n/plural';
import { MESSAGING_LIMITS } from '../lib/limits';
import { listTime } from '../lib/list-time';

export const FILTERS = ['all', 'unread', 'requests', 'archived'] as const;
export type ConversationFilter = (typeof FILTERS)[number];

const PAGE = 20;

/** The query of the api for a filter and a search. */
export function listParams(filter: ConversationFilter, q: string): MessagingControllerListParams {
  return {
    box: filter === 'requests' ? 'requests' : filter === 'archived' ? 'archived' : 'inbox',
    ...(filter === 'unread' ? { unread: 'true' as const } : {}),
    ...(q ? { q } : {}),
    limit: PAGE,
  };
}

/** What the last message says in a line: its text, a file, a publication, a deletion. */
function useExcerpt() {
  const t = useTranslations('web.messaging.list');
  const messaging = useTranslations('web.messaging');
  const plural = usePlural();
  return (conversation: Conversation): { text: string; file: boolean } => {
    const last = conversation.lastMessage;
    if (!last) return { text: t('noMessage'), file: false };
    const text = last.deleted
      ? messaging('deleted')
      : last.body
        ? last.body
        : last.attachments.length > 0
          ? t(`attachment.${plural(last.attachments.length)}`, {
              count: last.attachments.length,
            })
          : last.sharedPost
            ? t('shared')
            : last.moderationStatus !== 'visible'
              ? t('moderated')
              : '';
    return {
      text: last.mine ? t('you', { text }) : text,
      file: !last.deleted && last.attachments.length > 0,
    };
  };
}

function ConversationRow({
  conversation,
  active,
}: {
  conversation: Conversation;
  active: boolean;
}) {
  const t = useTranslations('web.messaging.list');
  const plural = usePlural();
  const format = useFormatter();
  const locale = useLocale();
  const timeZone = useTimeZone() ?? 'UTC';
  const now = useNow({ updateInterval: 60_000 });
  const excerpt = useExcerpt()(conversation);
  const others = conversation.participants.filter((participant) => !participant.left);
  const names = formatNames(
    others.map((participant) => participant.member.displayName),
    locale,
  );
  const unread = conversation.unreadCount > 0 || conversation.markedUnread;
  const at = new Date(conversation.lastMessageAt);
  const time = listTime(at, now, timeZone);
  return (
    <li className="min-w-0">
      <Link
        href={routes.conversation(conversation.id)}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex min-h-16 min-w-0 items-center gap-3 rounded-lg px-3 py-2.5 outline-none focus-visible:outline-2 focus-visible:outline-focus',
          active ? 'bg-accent-subtle' : 'hover:bg-surface-sunken',
        )}
      >
        {conversation.kind === 'group' ? (
          // The names follow in the link: the avatars are decorative.
          <span aria-hidden className="w-10 shrink-0">
            <AvatarGroup
              size="xs"
              max={2}
              showRest={false}
              label=""
              people={others.map((participant) => ({
                name: participant.member.displayName,
                src: participant.member.avatarUrl,
              }))}
            />
          </span>
        ) : (
          <Avatar
            name={names || t('someone')}
            src={others[0]?.member.avatarUrl ?? null}
            size="md"
            decorative
          />
        )}
        <span className="grid min-w-0 flex-1 grid-cols-1 gap-0.5">
          <span className="flex items-baseline gap-2">
            <span
              className={cn(
                'min-w-0 flex-1 truncate text-sm',
                unread ? 'font-semibold text-foreground' : 'font-medium text-foreground',
              )}
            >
              {names || t('someone')}
            </span>
            <time
              dateTime={conversation.lastMessageAt}
              className={cn('shrink-0 text-xs tabular-nums', unread ? 'text-accent' : 'text-muted')}
            >
              {format.dateTime(at, time.options as Parameters<typeof format.dateTime>[1])}
            </time>
          </span>
          <span className="flex items-center gap-2">
            <span
              className={cn(
                'flex min-w-0 flex-1 items-center gap-1 truncate text-sm',
                unread ? 'text-foreground' : 'text-muted',
              )}
            >
              {excerpt.file ? <Paperclip aria-hidden className="size-3.5 shrink-0" /> : null}
              <span className="truncate">{excerpt.text}</span>
            </span>
            {conversation.kind === 'group' ? (
              <Handshake aria-label={t('introduction')} className="size-4 shrink-0 text-muted" />
            ) : null}
            {conversation.muted ? (
              <BellOff aria-label={t('muted')} className="size-4 shrink-0 text-muted" />
            ) : null}
            {conversation.requestState === 'received' ? (
              <Badge tone="info">{t('request')}</Badge>
            ) : conversation.requestState === 'sent' ? (
              <Badge>{t('requestSent')}</Badge>
            ) : null}
            {conversation.unreadCount > 0 ? (
              <>
                <CountBadge count={conversation.unreadCount} className="ring-0" />
                <span className="sr-only">
                  {t(`unread.${plural(conversation.unreadCount)}`, {
                    count: conversation.unreadCount,
                  })}
                </span>
              </>
            ) : conversation.markedUnread ? (
              <span className="size-2.5 shrink-0 rounded-full bg-accent">
                <span className="sr-only">{t('markedUnread')}</span>
              </span>
            ) : null}
          </span>
        </span>
      </Link>
    </li>
  );
}

function RowSkeleton() {
  return (
    <div className="flex min-h-16 items-center gap-3 px-3 py-2.5">
      <Skeleton className="size-10 rounded-full" />
      <div className="grid flex-1 gap-2">
        <Skeleton className="h-3.5 w-2/5" />
        <Skeleton className="h-3 w-4/5" />
      </div>
    </div>
  );
}

/**
 * The conversations of the member (§10.4): all, unread, requests (first messages out of network)
 * and archived, a search on the name of a participant, the pages that follow as the list is
 * scrolled, kept up to date by the realtime channel. Each row: the avatars, the names, the start
 * of the last message, its moment, the unread count, the mute and the request.
 */
export function ConversationList({
  initialInbox,
}: {
  initialInbox: CursorPage<Conversation> | null;
}) {
  const t = useTranslations('web.messaging.list');
  const active = useSelectedLayoutSegment();
  const counters = useCounters(null).data;
  const [filter, setFilter] = useQueryState(
    'filter',
    parseAsStringLiteral(FILTERS).withDefault('all'),
  );
  const [q, setQ] = useQueryState('q', parseAsString.withDefault(''));
  const [search, setSearch] = useState(q);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search.trim() !== q) void setQ(search.trim() || null);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, q, setQ]);

  const params = listParams(filter, q);
  const list = useInfiniteQuery({
    queryKey: getMessagingControllerListQueryKey(params),
    queryFn: ({ pageParam, signal }) =>
      messagingControllerList(
        { ...params, ...(pageParam ? { cursor: pageParam } : {}) },
        { signal },
      ) as Promise<CursorPage<Conversation>>,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    ...(filter === 'all' && !q && initialInbox
      ? { initialData: { pages: [initialInbox], pageParams: [undefined] } }
      : {}),
  });

  // The next page loads as the end of the list comes into view.
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = end.current;
    if (!element || !list.hasNextPage) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting) && !list.isFetchingNextPage) {
        void list.fetchNextPage();
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [list]);

  const conversations = list.data?.pages.flatMap((page) => page.items) ?? [];
  const requests = counters?.messageRequests ?? 0;
  const introductions = counters?.invitations.introductions ?? 0;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <div className="grid grid-cols-1 gap-3 border-b border-border p-3">
        <Input
          type="search"
          aria-label={t('searchLabel')}
          placeholder={t('search')}
          maxLength={MESSAGING_LIMITS.search}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          startAdornment={<Search aria-hidden />}
          autoComplete="off"
        />
        <FilterButtons
          label={t('filters.label')}
          value={filter}
          onValueChange={(next) => void setFilter(next === 'all' ? null : next)}
          options={FILTERS.map((value) => ({
            value,
            label:
              value === 'requests' && requests > 0
                ? t('filters.requestsCount', { count: requests })
                : t(`filters.${value}`),
          }))}
          className="w-full"
        />
        <Link
          href={routes.introductions}
          className="flex items-center gap-2 rounded-md px-1 text-sm font-medium text-accent outline-none hover:underline focus-visible:outline-2 focus-visible:outline-focus"
        >
          <Handshake aria-hidden className="size-4" />
          {introductions > 0
            ? t('introductionsCount', { count: introductions })
            : t('introductions')}
        </Link>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2" aria-busy={list.isPending || undefined}>
        {list.isPending ? (
          <Loading className="grid">
            <RowSkeleton />
            <RowSkeleton />
            <RowSkeleton />
            <RowSkeleton />
          </Loading>
        ) : list.isError ? (
          <ErrorState
            size="inline"
            title={t('error')}
            retrying={list.isRefetching}
            onRetry={() => void list.refetch()}
          />
        ) : conversations.length === 0 ? (
          <EmptyState
            size="inline"
            headingLevel={2}
            icon={<MessageSquare />}
            title={q ? t('noResults', { q }) : t(`empty.${filter}.title`)}
            description={q ? t('noResultsBody') : t(`empty.${filter}.body`)}
            action={
              filter === 'all' && !q ? (
                <Button asChild variant="secondary" size="sm">
                  <Link href={routes.network}>{t('empty.all.action')}</Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul aria-label={t(`filters.${filter}`)} className="grid grid-cols-1 gap-0.5">
            {conversations.map((conversation) => (
              <ConversationRow
                key={conversation.id}
                conversation={conversation}
                active={active === conversation.id}
              />
            ))}
          </ul>
        )}
        {list.hasNextPage ? (
          <div ref={end} className="flex justify-center py-3">
            <Button
              variant="ghost"
              size="sm"
              loading={list.isFetchingNextPage}
              loadingLabel={t('loadingMore')}
              onClick={() => void list.fetchNextPage()}
            >
              {t('more')}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
