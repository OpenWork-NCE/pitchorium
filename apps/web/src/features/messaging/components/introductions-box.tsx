'use client';

import {
  getMessagingControllerListIntroductionsQueryKey,
  messagingControllerListIntroductions,
} from '@pitchorium/api-client';
import type { CursorPage, Introduction } from '@pitchorium/contracts';
import { type InfiniteData, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { Handshake } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button, EmptyState, ErrorState, Loading, Skeleton } from '@/components/ui';
import { routes } from '@/config/routes';
import { Link } from '@/i18n/navigation';
import { answerOf, IntroductionCard } from './introduction-card';

type Page = CursorPage<Introduction>;

/**
 * The introductions of the member (§10.4): those waiting for their answer first, then the
 * others (proposed by them, concluded, declined), page after page.
 */
export function IntroductionsBox({ initial }: { initial: Page | null }) {
  const t = useTranslations('web.messaging.introductions');
  const queryClient = useQueryClient();
  const key = getMessagingControllerListIntroductionsQueryKey({ limit: 20 });
  const list = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam, signal }) =>
      messagingControllerListIntroductions(
        { limit: 20, ...(pageParam ? { cursor: pageParam } : {}) },
        { signal },
      ) as Promise<Page>,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    ...(initial ? { initialData: { pages: [initial], pageParams: [undefined] } } : {}),
  });
  const items = list.data?.pages.flatMap((page) => page.items) ?? [];
  const waiting = items.filter((item) => item.status === 'pending' && answerOf(item) === 'pending');
  const others = items.filter((item) => !waiting.includes(item));
  const replace = (changed: Introduction) =>
    queryClient.setQueryData<InfiniteData<Page>>(key, (data) =>
      data
        ? {
            ...data,
            pages: data.pages.map((page) => ({
              ...page,
              items: page.items.map((item) => (item.id === changed.id ? changed : item)),
            })),
          }
        : data,
    );

  if (list.isPending) {
    return (
      <Loading className="grid gap-4">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </Loading>
    );
  }
  if (list.isError) {
    return (
      <ErrorState
        title={t('error')}
        retrying={list.isRefetching}
        onRetry={() => void list.refetch()}
      />
    );
  }
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Handshake />}
        title={t('empty')}
        description={t('emptyBody')}
        action={
          <Button asChild variant="secondary">
            <Link href={routes.network}>{t('emptyAction')}</Link>
          </Button>
        }
      />
    );
  }
  return (
    <div className="grid gap-8">
      {waiting.length > 0 ? (
        <section aria-labelledby="introductions-waiting" className="grid gap-4">
          <h2 id="introductions-waiting" className="font-display text-2xl font-extrabold">
            {t('waiting')}
          </h2>
          <ul className="grid gap-4">
            {waiting.map((introduction) => (
              <li key={introduction.id}>
                <IntroductionCard introduction={introduction} onChange={replace} headingLevel={3} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {others.length > 0 ? (
        <section aria-labelledby="introductions-others" className="grid gap-4">
          <h2 id="introductions-others" className="font-display text-2xl font-extrabold">
            {t('others')}
          </h2>
          <ul className="grid gap-4">
            {others.map((introduction) => (
              <li key={introduction.id}>
                <IntroductionCard introduction={introduction} onChange={replace} headingLevel={3} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {list.hasNextPage ? (
        <Button
          variant="ghost"
          className="justify-self-center"
          loading={list.isFetchingNextPage}
          loadingLabel={t('loadingMore')}
          onClick={() => void list.fetchNextPage()}
        >
          {t('more')}
        </Button>
      ) : null}
    </div>
  );
}
