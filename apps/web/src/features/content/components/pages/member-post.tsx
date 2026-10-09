'use client';

import type { Post } from '@pitchorium/contracts';
import { useLocale } from 'next-intl';
import { useState } from 'react';
import { routes } from '@/config/routes';
import { MemberHoverCard } from '@/features/profiles';
import { useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/cn';
import { PostFooter } from '../actions/post-footer';
import { PostMenu } from '../actions/post-menu';
import { useViewObserver } from '../feed/use-view-observer';
import { PostCard } from '../post-card';

/**
 * A publication read by a member outside the feed (its page, the saved ones, an activity): its
 * menu, its actions and its comments, the changes shown at once; seen, it is signalled.
 * Removed (deleted, unsaved, hidden), it leaves the list, or the page goes back to the feed.
 */
export function MemberPost({
  post: initial,
  full = false,
  commentsOpen = false,
  onRemove,
  className,
}: {
  post: Post;
  full?: boolean;
  commentsOpen?: boolean;
  /** The publication left (deleted, hidden); unset on its own page: back to the feed. */
  onRemove?: (reason: 'hidden' | 'deleted' | null) => void;
  className?: string;
}) {
  const [post, setPost] = useState(initial);
  const router = useRouter();
  const locale = useLocale();
  const watch = useViewObserver();
  return (
    <PostCard
      ref={watch(post.viewerIsAuthor ? null : post.id)}
      className={cn('rounded-xl', className)}
      post={post}
      signedIn
      full={full}
      featured={post.featured}
      returnTo={`/${locale}${routes.post(post.id)}`}
      name={
        post.author.type === 'member' ? (
          <MemberHoverCard
            member={post.author.member}
            signedIn
            className="truncate font-semibold text-foreground hover:underline"
          />
        ) : undefined
      }
      menu={
        <PostMenu
          post={post}
          onChange={setPost}
          onRemove={
            onRemove ??
            ((reason) => {
              if (reason) router.replace(routes.feed);
            })
          }
        />
      }
      footer={<PostFooter post={post} commentsOpen={commentsOpen} />}
    />
  );
}
