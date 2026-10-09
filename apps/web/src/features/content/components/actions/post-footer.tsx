'use client';

import type { Post, ReactionSummary } from '@pitchorium/contracts';
import { MessageCircle, Repeat2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { lazy, Suspense, useState } from 'react';
import { Button } from '@/components/ui';
import { usePlural } from '@/lib/i18n/plural';
import { ReactionSummary as Summary } from '../reaction-summary';
import { ReactionControl } from './reaction-control';
import { usePostReaction } from './use-post-reaction';

const loadComments = () => import('../comments/comment-thread');
const CommentThread = lazy(() =>
  loadComments().then((module) => ({ default: module.CommentThread })),
);
const loadReactors = () => import('./reactors-dialog');
const ReactorsDialog = lazy(loadReactors);
const loadRepost = () => import('./repost-dialog');
const RepostDialog = lazy(loadRepost);

/**
 * Under a publication, for a member (§10.3): the summary of its reactions (who reacted, in a
 * dialog), its comments and reposts, then react, comment and repost. The comments open in place
 * (expanded on the page of the publication); their code loads with them.
 */
export function PostFooter({
  post,
  commentsOpen: initiallyOpen = false,
  onReposted,
}: {
  post: Post;
  /** Comments shown at once (page of the publication). */
  commentsOpen?: boolean;
  /** A repost was made from here: the feed may show it. */
  onReposted?: (post: Post) => void;
}) {
  const t = useTranslations('web.content');
  const actions = useTranslations('web.content.actions');
  const locale = useLocale();
  const plural = usePlural();
  const send = usePostReaction(post.id);
  const [summary, setSummary] = useState<ReactionSummary>(post.reactions);
  const [comments, setComments] = useState(post.commentCount);
  const [open, setOpen] = useState(initiallyOpen);
  const [dialog, setDialog] = useState<'reactors' | 'repost' | null>(null);
  const number = (value: number) => new Intl.NumberFormat(locale).format(value);
  const original = post.kind === 'repost' ? post.repostOf : post;

  return (
    <div className="grid gap-2">
      {summary.total > 0 || comments > 0 || post.repostCount > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted">
          {summary.total > 0 ? (
            <button
              type="button"
              onClick={() => setDialog('reactors')}
              onPointerEnter={() => void loadReactors()}
              className="rounded-xs outline-none hover:underline focus-visible:outline-2 focus-visible:outline-focus"
            >
              <Summary reactions={summary} />
            </button>
          ) : (
            <span />
          )}
          <span className="flex gap-3">
            {comments > 0 ? (
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpen((value) => !value)}
                onPointerEnter={() => void loadComments()}
                className="rounded-xs tabular-nums outline-none hover:underline focus-visible:outline-2 focus-visible:outline-focus"
              >
                {t(`comments.${plural(comments)}`, { count: number(comments) })}
              </button>
            ) : null}
            {post.repostCount > 0 ? (
              <span className="tabular-nums">
                {t(`reposts.${plural(post.repostCount)}`, { count: number(post.repostCount) })}
              </span>
            ) : null}
          </span>
        </div>
      ) : null}
      <div
        role="group"
        aria-label={actions('label')}
        className="-mx-2 flex flex-wrap items-center gap-1 border-t border-border pt-2"
      >
        <ReactionControl summary={summary} onChange={setSummary} send={send} />
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          onPointerEnter={() => void loadComments()}
        >
          <MessageCircle aria-hidden />
          {actions('comment')}
        </Button>
        {original ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDialog('repost')}
            onPointerEnter={() => void loadRepost()}
          >
            <Repeat2 aria-hidden />
            {actions('repost')}
          </Button>
        ) : null}
      </div>
      {open ? (
        <Suspense fallback={null}>
          <CommentThread
            postId={post.id}
            commentsDisabled={post.commentsDisabled}
            onCountChange={(delta) => setComments((count) => Math.max(0, count + delta))}
          />
        </Suspense>
      ) : null}
      {dialog === 'reactors' ? (
        <Suspense fallback={null}>
          <ReactorsDialog postId={post.id} summary={summary} onClose={() => setDialog(null)} />
        </Suspense>
      ) : null}
      {dialog === 'repost' && original ? (
        <Suspense fallback={null}>
          <RepostDialog
            original={original}
            onClose={() => setDialog(null)}
            onReposted={(repost) => onReposted?.(repost)}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
