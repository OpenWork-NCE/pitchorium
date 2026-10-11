'use client';

import {
  getNotificationsControllerCountersQueryKey,
  getNotificationsControllerListQueryKey,
  notificationsControllerList,
  notificationsControllerRead,
  notificationsControllerRemove,
} from '@pitchorium/api-client';
import type { CursorPage, Notification } from '@pitchorium/contracts';
import { type InfiniteData, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUp, Bell, CheckCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { parseAsStringLiteral, useQueryState } from 'nuqs';
import { useEffect, useRef, useState } from 'react';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Loading,
  notify,
  Skeleton,
  FilterButtons,
  useAnnounce,
} from '@/components/ui';
import * as routes from '@/config/paths';
import { Link } from '@/i18n/navigation';
import { usePlural } from '@/lib/i18n/plural';
import { REALTIME_EVENTS } from '@/lib/realtime/realtime-bus';
import { useRealtime } from '@/lib/realtime/use-realtime';
import { NOTIFICATION_FILTERS, type NotificationFilter } from '../lib/families';
import { useCounters, useMarkAllNotificationsRead } from './counters';
import { NotificationItem } from './notification-item';

type Page = CursorPage<Notification>;
const PAGE = 20;

const paramsOf = (filter: NotificationFilter) =>
  ({ limit: PAGE, ...(filter === 'all' ? {} : { family: filter }) }) as const;

function ItemSkeleton() {
  return (
    <div className="flex items-start gap-3 p-3">
      <Skeleton className="size-10 rounded-full" />
      <div className="grid flex-1 gap-2">
        <Skeleton className="h-3.5 w-3/4" />
        <Skeleton className="h-3 w-1/4" />
      </div>
    </div>
  );
}

/**
 * The notifications of the member (§10.5): every one or a family (mentions, network,
 * publications, projects and contributions), page after page as the list is scrolled, read at the
 * opening of their target, all read at once, removed one by one (at once, put back if refused). A
 * notification that arrives in real time inserts nothing: « N nouvelles notifications » slides in
 * and shows them on demand (ADR 0148), so nothing moves under the reader.
 */
export function NotificationsPage({ initial }: { initial: Page | null }) {
  const t = useTranslations('web.notifications');
  const plural = usePlural();
  const announce = useAnnounce();
  const queryClient = useQueryClient();
  const counters = useCounters(null).data;
  const markAll = useMarkAllNotificationsRead();
  const [filter, setFilter] = useQueryState(
    'filter',
    parseAsStringLiteral(NOTIFICATION_FILTERS).withDefault('all'),
  );
  const key = getNotificationsControllerListQueryKey(paramsOf(filter));
  const list = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam, signal }) =>
      notificationsControllerList(
        { ...paramsOf(filter), ...(pageParam ? { cursor: pageParam } : {}) },
        { signal },
      ) as Promise<Page>,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    // The realtime channel never reloads the list under the reader (ADR 0148).
    refetchOnMount: false,
    ...(filter === 'all' && initial
      ? { initialData: { pages: [initial], pageParams: [undefined] } }
      : {}),
  });
  const items = list.data?.pages.flatMap((page) => page.items) ?? [];

  // New or grouped notifications pushed meanwhile: counted, shown at the press of the pill.
  const [arrived, setArrived] = useState<ReadonlySet<string>>(new Set());
  const top = useRef<HTMLDivElement>(null);
  useRealtime<{ notification: Notification }>(REALTIME_EVENTS.notification, ({ notification }) => {
    setArrived((current) => new Set(current).add(notification.id));
  });
  async function showArrived() {
    await queryClient.resetQueries({ queryKey: key });
    setArrived(new Set());
    top.current?.scrollIntoView({ block: 'start' });
    top.current?.focus();
  }

  const write = (change: (items: Notification[]) => Notification[]) =>
    queryClient.setQueryData<InfiniteData<Page>>(key, (data) =>
      data
        ? { ...data, pages: data.pages.map((page) => ({ ...page, items: change(page.items) })) }
        : data,
    );
  const refreshCounters = () =>
    void queryClient.invalidateQueries({ queryKey: getNotificationsControllerCountersQueryKey() });

  function open(notification: Notification) {
    write((current) =>
      current.map((item) => (item.id === notification.id ? { ...item, read: true } : item)),
    );
    void notificationsControllerRead(notification.id).then(refreshCounters, () => undefined);
  }

  async function remove(notification: Notification) {
    const previous = queryClient.getQueryData<InfiniteData<Page>>(key);
    write((current) => current.filter((item) => item.id !== notification.id));
    try {
      await notificationsControllerRemove(notification.id);
      announce(t('removed'));
      refreshCounters();
    } catch {
      queryClient.setQueryData(key, previous);
      notify.error(t('removeFailed'));
    }
  }

  function readAll() {
    write((current) => current.map((item) => ({ ...item, read: true })));
    markAll.mutate(undefined, {
      onSuccess: () => announce(t('allRead')),
      onError: () => {
        void queryClient.invalidateQueries({ queryKey: key });
        notify.error(t('allReadFailed'));
      },
    });
  }

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

  const unread = counters?.notifications ?? items.filter((item) => !item.read).length;
  return (
    <div className="grid grid-cols-1 gap-4">
      <div
        aria-live="polite"
        className="pointer-events-none sticky top-[calc(var(--header-height)+0.75rem)] z-(--z-sticky) flex h-0 justify-center"
      >
        {arrived.size > 0 ? (
          <button
            type="button"
            onClick={() => void showArrived()}
            className="pill-in pointer-events-auto inline-flex min-h-11 items-center gap-2 rounded-full bg-accent px-4 text-sm font-medium text-on-accent shadow-md outline-none hover:bg-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            <ArrowUp aria-hidden className="size-4" />
            {t(`newPill.${plural(arrived.size)}`, { count: arrived.size })}
          </button>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <FilterButtons
          label={t('filters.label')}
          value={filter}
          onValueChange={(next) => {
            setArrived(new Set());
            void setFilter(next === 'all' ? null : next);
          }}
          options={NOTIFICATION_FILTERS.map((value) => ({ value, label: t(`filters.${value}`) }))}
        />
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            disabledReason={unread === 0 ? t('nothingUnread') : undefined}
            onClick={readAll}
          >
            <CheckCheck aria-hidden />
            {t('readAll')}
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href={routes.settingsNotifications}>{t('preferences')}</Link>
          </Button>
        </div>
      </div>
      <Card padding="sm" className="grid gap-1" data-card="">
        <div ref={top} tabIndex={-1} className="outline-none" />
        {list.isPending ? (
          <Loading className="grid gap-1">
            <ItemSkeleton />
            <ItemSkeleton />
            <ItemSkeleton />
          </Loading>
        ) : list.isError ? (
          <ErrorState
            size="inline"
            title={t('error')}
            retrying={list.isRefetching}
            onRetry={() => void list.refetch()}
          />
        ) : items.length === 0 ? (
          <EmptyState
            size="inline"
            icon={<Bell />}
            title={t(`empty.${filter}.title`)}
            description={t(`empty.${filter}.body`)}
          />
        ) : (
          <ul aria-label={t(`filters.${filter}`)} className="grid gap-1">
            {items.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onOpen={open}
                onRemove={(item) => void remove(item)}
              />
            ))}
          </ul>
        )}
        {list.hasNextPage ? (
          <div ref={end} className="flex justify-center py-2">
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
      </Card>
    </div>
  );
}
