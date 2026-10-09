'use client';

import {
  postsControllerMemberPosts,
  postsControllerOrganizationPosts,
} from '@pitchorium/api-client';
import type { Post } from '@pitchorium/contracts';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Pagination } from '@/components/ui';
import { MemberPost } from './member-post';

type Page = { items: Post[]; nextCursor: string | null };

/**
 * « Activité » of a member or an organization read by a member: their publications as the api
 * lets the reader see them, each with its actions, page by page. Loaded on demand by the page
 * (a visitor gets the list rendered by the server).
 */
export default function MemberActivity({
  author,
  initial,
}: {
  author: { kind: 'member'; handle: string } | { kind: 'organization'; slug: string };
  initial: Page;
}) {
  const t = useTranslations('web.activity');
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());
  const activity = useInfiniteQuery({
    queryKey: [
      'content',
      'activity',
      author.kind,
      author.kind === 'member' ? author.handle : author.slug,
    ],
    queryFn: ({ pageParam, signal }) => {
      const params = { limit: 10, ...(pageParam ? { cursor: pageParam } : {}) };
      return author.kind === 'member'
        ? postsControllerMemberPosts(author.handle, params, { signal })
        : postsControllerOrganizationPosts(author.slug, params, { signal });
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    initialData: { pages: [initial], pageParams: [undefined] },
  });
  const posts = (activity.data?.pages ?? [])
    .flatMap((page) => page.items)
    .filter((post) => !removed.has(post.id));
  return (
    <div className="grid gap-4">
      {posts.length === 0 ? <p className="text-sm text-muted">{t('empty')}</p> : null}
      <ul className="grid gap-4">
        {posts.map((post) => (
          <li key={post.id}>
            <MemberPost
              post={post}
              onRemove={(reason) =>
                setRemoved((current) => {
                  const next = new Set(current);
                  if (reason) next.add(post.id);
                  else next.delete(post.id);
                  return next;
                })
              }
            />
          </li>
        ))}
      </ul>
      {activity.hasNextPage ? (
        <Pagination
          hasMore
          loading={activity.isFetchingNextPage}
          onLoadMore={() => void activity.fetchNextPage()}
          shown={posts.length}
        />
      ) : null}
    </div>
  );
}
