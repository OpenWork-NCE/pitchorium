'use client';

import {
  commentsControllerDelete,
  commentsControllerList,
  commentsControllerReact,
  commentsControllerReplies,
  commentsControllerUnreact,
  commentsControllerUpdate,
} from '@pitchorium/api-client';
import type { Comment, ReactionSummary } from '@pitchorium/contracts';
import {
  type InfiniteData,
  MutationObserver,
  useInfiniteQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { MessageSquareOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  AlertDialog,
  Avatar,
  Button,
  ErrorState,
  Loading,
  notify,
  RelativeTime,
  Skeleton,
} from '@/components/ui';
import { useWithPrerequisites } from '@/features/access';
import { MemberHoverCard } from '@/features/profiles';
import {
  type CommentInput,
  type Intent,
  PERSISTED_MUTATIONS,
} from '@/lib/query/persisted-mutations';
import { usePlural } from '@/lib/i18n/plural';
import { ReactionControl } from '../actions/reaction-control';
import { useProblemText } from '../actions/use-problem-text';
import { PostText } from '../post/post-text';
import { ReactionSummary as Summary } from '../reaction-summary';
import { CommentComposer } from './comment-composer';

const PAGE = 10;
type Page = { items: Comment[]; nextCursor: string | null };

const commentsKey = (postId: string) => ['content', 'comments', postId] as const;
const repliesKey = (commentId: string) => ['content', 'replies', commentId] as const;

/** Adds a comment at the end of a list read page by page. */
function appended(data: InfiniteData<Page> | undefined, comment: Comment) {
  if (!data) return data;
  const pages = [...data.pages];
  const last = pages.at(-1)!;
  pages[pages.length - 1] = { ...last, items: [...last.items, comment] };
  return { ...data, pages };
}

/** Changes one comment wherever it is in the list (null: removes it). */
function changed(
  data: InfiniteData<Page> | undefined,
  id: string,
  next: ((comment: Comment) => Comment) | null,
) {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.flatMap((comment) =>
        comment.id !== id ? [comment] : next ? [next(comment)] : [],
      ),
    })),
  };
}

/**
 * Comments of a publication (§10.3): oldest first, page by page (« charger plus »), each with its
 * replies on one level, opened on demand; written with mentions, changed by their author,
 * deleted by their author or by the author of the publication after a confirmation, reacted to.
 * A comment made offline waits for the network and survives the closing of the tab (ADR 0102).
 */
export function CommentThread({
  postId,
  commentsDisabled,
  onCountChange,
}: {
  postId: string;
  commentsDisabled: boolean;
  /** Comments added or deleted here, for the count of the publication. */
  onCountChange: (delta: number) => void;
}) {
  const t = useTranslations('web.content.commentsThread');
  const queryClient = useQueryClient();
  const withPrerequisites = useWithPrerequisites();
  const problem = useProblemText();
  const list = useInfiniteQuery({
    queryKey: commentsKey(postId),
    queryFn: ({ pageParam, signal }) =>
      commentsControllerList(
        postId,
        { limit: PAGE, ...(pageParam ? { cursor: pageParam } : {}) },
        { signal },
      ) as Promise<Page>,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });

  const send = (text: string, parentId?: string) =>
    withPrerequisites(() =>
      new MutationObserver<Comment, unknown, Intent<CommentInput>>(queryClient, {
        ...PERSISTED_MUTATIONS.comment,
        mutationFn: PERSISTED_MUTATIONS.comment.mutationFn,
        scope: { id: `comment:${postId}` },
      }).mutate({
        input: { postId, body: parentId ? { text, parentId } : { text } },
        key: crypto.randomUUID(),
      }),
    ).then(
      (comment) => {
        queryClient.setQueryData<InfiniteData<Page>>(
          parentId ? repliesKey(parentId) : commentsKey(postId),
          (data) => appended(data, comment),
        );
        if (parentId) {
          queryClient.setQueryData<InfiniteData<Page>>(commentsKey(postId), (data) =>
            changed(data, parentId, (parent) => ({ ...parent, replyCount: parent.replyCount + 1 })),
          );
        }
        onCountChange(1);
      },
      (error: unknown) => {
        notify.error(problem(error));
        throw error;
      },
    );

  const comments = list.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <section aria-label={t('title')} className="grid gap-4 border-t border-border pt-4">
      {list.isPending ? (
        <Loading className="grid gap-3">
          <CommentSkeleton />
          <CommentSkeleton />
        </Loading>
      ) : list.isError ? (
        <ErrorState
          size="inline"
          title={t('error')}
          retrying={list.isRefetching}
          onRetry={() => void list.refetch()}
        />
      ) : comments.length === 0 ? (
        <p className="text-sm text-muted">{t('empty')}</p>
      ) : (
        <ul className="grid gap-4">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              commentsDisabled={commentsDisabled}
              listKey={commentsKey(postId)}
              onReply={(text) => send(text, comment.id)}
              onDeleted={() => onCountChange(-(1 + comment.replyCount))}
            />
          ))}
        </ul>
      )}
      {list.hasNextPage ? (
        <Button
          variant="ghost"
          size="sm"
          className="justify-self-start"
          loading={list.isFetchingNextPage}
          onClick={() => void list.fetchNextPage()}
        >
          {t('more')}
        </Button>
      ) : null}
      {commentsDisabled ? (
        <p className="flex items-center gap-2 text-sm text-muted">
          <MessageSquareOff aria-hidden className="size-4" />
          {t('disabled')}
        </p>
      ) : (
        <CommentComposer
          label={t('label')}
          submitLabel={t('send')}
          onSubmit={(text) => send(text)}
        />
      )}
    </section>
  );
}

function CommentSkeleton() {
  return (
    <div className="flex gap-3">
      <Skeleton className="size-8 rounded-full" />
      <div className="grid flex-1 gap-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-full" />
      </div>
    </div>
  );
}

/** A comment, its reaction, its replies (one level), its edition and its deletion. */
function CommentItem({
  comment,
  commentsDisabled,
  listKey,
  reply = true,
  onReply,
  onDeleted,
}: {
  comment: Comment;
  commentsDisabled: boolean;
  /** Key of the list it is in, to change it there. */
  listKey: readonly unknown[];
  /** Replies only to a top-level comment. */
  reply?: boolean;
  onReply: (text: string) => Promise<void>;
  onDeleted: () => void;
}) {
  const t = useTranslations('web.content.commentsThread');
  const plural = usePlural();
  const queryClient = useQueryClient();
  const problem = useProblemText();
  const [editing, setEditing] = useState(false);
  const [replying, setReplying] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [summary, setSummary] = useState<ReactionSummary>(comment.reactions);
  const update = (next: (current: Comment) => Comment | null) =>
    queryClient.setQueryData<InfiniteData<Page>>(listKey, (data) => {
      const replaced = next(comment);
      return changed(data, comment.id, replaced ? () => replaced : null);
    });

  return (
    <li className="grid gap-2">
      <article
        aria-label={t('commentBy', { name: comment.author.displayName })}
        className="flex gap-3"
      >
        <Avatar
          name={comment.author.displayName}
          src={comment.author.avatarUrl}
          size="sm"
          decorative
        />
        <div className="grid min-w-0 flex-1 gap-1">
          <div className="grid gap-1 rounded-lg bg-surface-sunken px-3 py-2">
            <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
              <MemberHoverCard
                member={comment.author}
                signedIn
                className="font-semibold text-foreground hover:underline"
              />
              <span className="text-xs text-muted">
                <RelativeTime date={comment.createdAt} />
                {comment.editedAt ? ` · ${t('edited')}` : ''}
              </span>
            </p>
            {editing ? (
              <CommentComposer
                label={t('edit')}
                submitLabel={t('save')}
                initial={comment.text}
                focusOnMount
                onCancel={() => setEditing(false)}
                onSubmit={async (text) => {
                  try {
                    const saved = await commentsControllerUpdate(comment.id, { text });
                    update(() => saved);
                    setEditing(false);
                  } catch (error) {
                    notify.error(problem(error));
                    throw error;
                  }
                }}
              />
            ) : (
              <div className="text-sm">
                <PostText text={comment.text} mentions={comment.mentions} />
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1 text-xs">
            <ReactionControl
              size="xs"
              summary={summary}
              onChange={setSummary}
              send={(next) =>
                next
                  ? commentsControllerReact(comment.id, { type: next })
                  : commentsControllerUnreact(comment.id)
              }
            />
            <Summary reactions={summary} className="text-xs text-muted" />
            {reply && !commentsDisabled ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={() => setReplying(true)}
              >
                {t('reply')}
              </Button>
            ) : null}
            {comment.viewerIsAuthor && !editing ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={() => setEditing(true)}
              >
                {t('edit')}
              </Button>
            ) : null}
            {comment.viewerCanDelete ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs text-danger"
                  onClick={() => setDeleting(true)}
                >
                  {t('delete')}
                </Button>
                <AlertDialog
                  open={deleting}
                  onOpenChange={setDeleting}
                  title={t('deleteTitle')}
                  description={t('deleteBody')}
                  confirmLabel={t('deleteConfirm')}
                  onConfirm={async () => {
                    try {
                      await commentsControllerDelete(comment.id);
                      update(() => null);
                      onDeleted();
                      notify.success(t('deleted'));
                    } catch (error) {
                      notify.error(problem(error));
                    }
                  }}
                />
              </>
            ) : null}
          </div>
          {reply && comment.replyCount > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 justify-self-start px-2 text-xs"
              aria-expanded={showReplies}
              onClick={() => setShowReplies((open) => !open)}
            >
              {showReplies
                ? t('hideReplies')
                : t(`showReplies.${plural(comment.replyCount)}`, { count: comment.replyCount })}
            </Button>
          ) : null}
          {reply && (showReplies || replying) ? (
            <Replies
              commentId={comment.id}
              commentsDisabled={commentsDisabled}
              enabled={showReplies}
              onDeleted={() =>
                update((current) => ({
                  ...current,
                  replyCount: Math.max(0, current.replyCount - 1),
                }))
              }
            />
          ) : null}
          {replying ? (
            <CommentComposer
              label={t('replyLabel', { name: comment.author.displayName })}
              submitLabel={t('send')}
              focusOnMount
              initial={`@${comment.author.handle} `}
              onCancel={() => setReplying(false)}
              onSubmit={async (text) => {
                await onReply(text);
                setReplying(false);
                setShowReplies(true);
              }}
            />
          ) : null}
        </div>
      </article>
    </li>
  );
}

/** The replies of a comment, read when opened. */
function Replies({
  commentId,
  commentsDisabled,
  enabled,
  onDeleted,
}: {
  commentId: string;
  commentsDisabled: boolean;
  enabled: boolean;
  onDeleted: () => void;
}) {
  const t = useTranslations('web.content.commentsThread');
  const replies = useInfiniteQuery({
    queryKey: repliesKey(commentId),
    queryFn: ({ pageParam, signal }) =>
      commentsControllerReplies(
        commentId,
        { limit: PAGE, ...(pageParam ? { cursor: pageParam } : {}) },
        { signal },
      ) as Promise<Page>,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled,
  });
  const items = replies.data?.pages.flatMap((page) => page.items) ?? [];
  if (!enabled) return null;
  if (replies.isPending) {
    return (
      <Loading className="ml-2 grid gap-3 border-l border-border pl-3">
        <CommentSkeleton />
      </Loading>
    );
  }
  return (
    <div className="ml-2 grid gap-3 border-l border-border pl-3">
      <ul className="grid gap-3">
        {items.map((item) => (
          <CommentItem
            key={item.id}
            comment={item}
            commentsDisabled={commentsDisabled}
            listKey={repliesKey(commentId)}
            reply={false}
            onReply={() => Promise.resolve()}
            onDeleted={onDeleted}
          />
        ))}
      </ul>
      {replies.hasNextPage ? (
        <Button
          variant="ghost"
          size="sm"
          className="justify-self-start text-xs"
          loading={replies.isFetchingNextPage}
          onClick={() => void replies.fetchNextPage()}
        >
          {t('moreReplies')}
        </Button>
      ) : null}
    </div>
  );
}
