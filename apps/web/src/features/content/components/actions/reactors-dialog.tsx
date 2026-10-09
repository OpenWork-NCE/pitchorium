'use client';

import { postsControllerReactors } from '@pitchorium/api-client';
import type { ReactionSummary, ReactionType, Reactor } from '@pitchorium/contracts';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  Avatar,
  Button,
  Dialog,
  DialogContent,
  ErrorState,
  Loading,
  Skeleton,
  Tabs,
  TabsPanel,
} from '@/components/ui';
import { routes } from '@/config/routes';
import { Link } from '@/i18n/navigation';
import { REACTIONS } from '../../lib/reactions';
import { REACTION_ICONS } from '../reaction-summary';

type Tab = ReactionType | 'all';

/**
 * Who reacted to a publication (§10.3), in a dialog with a tab per reaction given (and all of
 * them), newest first, page by page; each name leads to the member.
 */
export default function ReactorsDialog({
  postId,
  summary,
  onClose,
}: {
  postId: string;
  summary: ReactionSummary;
  onClose: () => void;
}) {
  const t = useTranslations('web.content.reactionsDialog');
  const names = useTranslations('reference.reactionTypes');
  const more = useTranslations('web.ui.pagination');
  const [tab, setTab] = useState<Tab>('all');
  const tabs: Tab[] = ['all', ...REACTIONS.filter((type) => summary.counts[type] > 0)];
  const reactors = useInfiniteQuery({
    queryKey: ['content', 'reactors', postId, tab],
    queryFn: ({ pageParam, signal }) =>
      postsControllerReactors(
        postId,
        {
          limit: 20,
          ...(tab === 'all' ? {} : { type: tab }),
          ...(pageParam ? { cursor: pageParam } : {}),
        },
        { signal },
      ) as Promise<{ items: Reactor[]; nextCursor: string | null }>,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  const items = reactors.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent title={t('title')} size="sm">
        <Tabs
          value={tab}
          onValueChange={setTab}
          label={t('title')}
          tabs={tabs.map((value) => {
            const Icon = value === 'all' ? null : REACTION_ICONS[value];
            return {
              value,
              label: (
                <>
                  {Icon ? <Icon aria-hidden className="size-4" /> : null}
                  {value === 'all' ? t('all') : names(value)}
                </>
              ),
              count: value === 'all' ? summary.total : summary.counts[value],
            };
          })}
        >
          <TabsPanel value={tab}>
            <div className="grid max-h-[50dvh] gap-1 overflow-y-auto">
              {reactors.isPending ? (
                <Loading className="grid gap-3">
                  {[0, 1, 2].map((index) => (
                    <Skeleton key={index} className="h-11 w-full" />
                  ))}
                </Loading>
              ) : reactors.isError ? (
                <ErrorState
                  size="inline"
                  title={t('error')}
                  onRetry={() => void reactors.refetch()}
                />
              ) : items.length === 0 ? (
                <p className="text-sm text-muted">{t('empty')}</p>
              ) : (
                <ul className="grid gap-1">
                  {items.map((reactor) => {
                    const Icon = REACTION_ICONS[reactor.type];
                    return (
                      <li
                        key={reactor.member.handle}
                        className="flex items-center gap-3 rounded-md px-1 py-2"
                      >
                        <span className="relative">
                          <Avatar
                            name={reactor.member.displayName}
                            src={reactor.member.avatarUrl}
                            size="sm"
                            decorative
                          />
                          <span className="absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full bg-accent-subtle text-on-accent-subtle ring-2 ring-surface-elevated">
                            <Icon aria-hidden className="size-3" />
                          </span>
                        </span>
                        <span className="grid min-w-0">
                          <Link
                            href={routes.member(reactor.member.handle)}
                            prefetch={false}
                            className="truncate font-medium hover:underline"
                          >
                            {reactor.member.displayName}
                          </Link>
                          <span className="sr-only">{names(reactor.type)}</span>
                          {reactor.member.headline ? (
                            <span className="truncate text-xs text-muted">
                              {reactor.member.headline}
                            </span>
                          ) : null}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
              {reactors.hasNextPage ? (
                <Button
                  variant="ghost"
                  size="sm"
                  loading={reactors.isFetchingNextPage}
                  onClick={() => void reactors.fetchNextPage()}
                >
                  {more('more')}
                </Button>
              ) : null}
            </div>
          </TabsPanel>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
