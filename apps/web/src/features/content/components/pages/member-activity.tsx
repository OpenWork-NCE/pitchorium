'use client';

import {
  postsControllerMemberPosts,
  postsControllerOrganizationPosts,
} from '@pitchorium/api-client';
import type { Post } from '@pitchorium/contracts';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Pagination } from '@/components/ui';
import { MemberPost } from './member-post';
import type { ActivityAuthor } from './visitor-activity-pages';

type Page = { items: Post[]; nextCursor: string | null };

/** The next publications of an activity read by a member, after a cursor. */
async function nextPage(author: ActivityAuthor, cursor: string): Promise<Page> {
  const params = { limit: 10, cursor };
  if (author.kind === 'member') return postsControllerMemberPosts(author.handle, params);
  if (author.kind === 'organization') return postsControllerOrganizationPosts(author.slug, params);
  const { projectsControllerPosts } = await import('./project-posts');
  return projectsControllerPosts(author.projectId, params);
}

/**
 * « Activité » of a member or an organization read by a member: their publications as the api
 * lets the reader see them, each with its actions, page by page. Loaded on demand by the page
 * (a visitor gets the list rendered by the server). The pages are kept in the component, not in
 * the cache of TanStack Query: its observer, otherwise copied into this chunk and into the member
 * shell, would weigh 6 kB more on the member view of a page (ADR 0094).
 */
export interface MemberActivityProps {
  author: ActivityAuthor;
  initial: Page;
}

export default function MemberActivity({ author, initial }: MemberActivityProps) {
  const t = useTranslations('web.activity');
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());
  const [pages, setPages] = useState({ posts: initial.items, cursor: initial.nextCursor });
  const [loading, setLoading] = useState(false);
  const posts = pages.posts.filter((post) => !removed.has(post.id));
  const loadMore = (cursor: string) => {
    setLoading(true);
    nextPage(author, cursor)
      .then((page) =>
        setPages((current) => ({
          posts: [...current.posts, ...page.items],
          cursor: page.nextCursor,
        })),
      )
      .catch(() => undefined)
      .finally(() => setLoading(false));
  };
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
      {pages.cursor ? (
        <Pagination
          hasMore
          loading={loading}
          onLoadMore={() => pages.cursor && loadMore(pages.cursor)}
          shown={posts.length}
        />
      ) : null}
    </div>
  );
}
