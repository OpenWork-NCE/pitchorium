import {
  postsControllerMemberPosts,
  postsControllerOrganizationPosts,
  postsControllerPublicMemberPosts,
  postsControllerPublicOrganizationPosts,
  projectsControllerPosts,
  projectsControllerPublicPosts,
} from '@pitchorium/api-client';
import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { Heading } from '@/components/ui';
import { configureServerApi } from '@/lib/api/server';
import { PostCard } from '../post-card';
import { LazyMemberActivity } from './lazy-member-activity';
import { VisitorActivityMore } from './visitor-activity-more';
import type { ActivityAuthor } from './visitor-activity-pages';

/**
 * « Activité » of the page of a member or an organization (§10.1, §10.7): their publications,
 * newest first, as the api lets the reader see them (ADR 0113). A visitor gets them rendered by
 * the server, the next ones on demand; a member gets them with their actions, loaded on demand.
 * Nothing when the api gives nothing (a list closed to the reader).
 */
export async function ActivitySection({
  author,
  signedIn,
  title,
  hideWhenEmpty = false,
}: {
  author: ActivityAuthor;
  signedIn: boolean;
  /** Title of the section, « Activité » by default (« Publications rattachées » of a project). */
  title?: ReactNode;
  /** Nothing at all without any publication (a project without attached publications). */
  hideWhenEmpty?: boolean;
}) {
  const t = await getTranslations('web.activity');
  configureServerApi();
  const params = { limit: 10 };
  const options = { cache: 'no-store' } as const;
  const page = await (
    author.kind === 'member'
      ? signedIn
        ? postsControllerMemberPosts(author.handle, params, options)
        : postsControllerPublicMemberPosts(author.handle, params, options)
      : author.kind === 'organization'
        ? signedIn
          ? postsControllerOrganizationPosts(author.slug, params, options)
          : postsControllerPublicOrganizationPosts(author.slug, params, options)
        : signedIn
          ? projectsControllerPosts(author.projectId, params, options)
          : projectsControllerPublicPosts(author.projectId, params, options)
  ).catch(() => null);
  if (!page || (hideWhenEmpty && page.items.length === 0)) return null;
  return (
    <section aria-labelledby="activity-title" className="grid gap-4">
      <Heading level={2} size="section" id="activity-title">
        {title ?? t('title')}
      </Heading>
      {signedIn ? (
        <LazyMemberActivity author={author} initial={page} />
      ) : page.items.length === 0 ? (
        <p className="text-sm text-muted">{t('empty')}</p>
      ) : (
        <div className="grid gap-4">
          <ul className="grid gap-4">
            {page.items.map((post) => (
              <li key={post.id}>
                <PostCard post={post} signedIn={false} />
              </li>
            ))}
          </ul>
          <VisitorActivityMore author={author} cursor={page.nextCursor} />
        </div>
      )}
    </section>
  );
}
