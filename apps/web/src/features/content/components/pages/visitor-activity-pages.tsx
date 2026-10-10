'use client';

import {
  postsControllerPublicMemberPosts,
  postsControllerPublicOrganizationPosts,
  projectsControllerPublicPosts,
} from '@pitchorium/api-client';
import type { Post } from '@pitchorium/contracts';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui';
import { configureBrowserApi } from '@/lib/api/browser';
import { PostCard } from '../post-card';

configureBrowserApi();

export type ActivityAuthor =
  | { kind: 'member'; handle: string }
  | { kind: 'organization'; slug: string }
  /** The publications attached to a project by its team (§10.3). */
  | { kind: 'project'; projectId: string };

/** The key of an author in the cache: its kind and its identifier. */
export function activityKeyOf(author: ActivityAuthor): string {
  return author.kind === 'member'
    ? author.handle
    : author.kind === 'organization'
      ? author.slug
      : author.projectId;
}

/** The next public publications of an activity, after a cursor (a plain request). */
export function nextActivityPage(author: ActivityAuthor, cursor: string) {
  const params = { limit: 10, cursor };
  return author.kind === 'member'
    ? postsControllerPublicMemberPosts(author.handle, params)
    : author.kind === 'organization'
      ? postsControllerPublicOrganizationPosts(author.slug, params)
      : projectsControllerPublicPosts(author.projectId, params);
}

/**
 * The next public publications of an activity read by a visitor, under the first ones the
 * server rendered (no TanStack Query in a visitor's page, ADR 0094). Loaded at the first
 * « Afficher plus » (VisitorActivityMore), with the page it read.
 */
export default function VisitorActivityPages({
  author,
  posts: first,
  cursor: next,
}: {
  author: ActivityAuthor;
  posts: Post[];
  cursor: string | null;
}) {
  const t = useTranslations('web.activity');
  const [posts, setPosts] = useState(first);
  const [cursor, setCursor] = useState(next);
  const [loading, setLoading] = useState(false);
  return (
    <>
      <ul className="grid gap-4">
        {posts.map((post) => (
          <li key={post.id}>
            <PostCard post={post} signedIn={false} />
          </li>
        ))}
      </ul>
      {cursor ? (
        <Button
          variant="outline"
          className="justify-self-center"
          loading={loading}
          onClick={() => {
            setLoading(true);
            void nextActivityPage(author, cursor)
              .then((page) => {
                setPosts((current) => [...current, ...page.items]);
                setCursor(page.nextCursor);
              })
              .catch(() => undefined)
              .finally(() => setLoading(false));
          }}
        >
          {t('more')}
        </Button>
      ) : null}
    </>
  );
}
