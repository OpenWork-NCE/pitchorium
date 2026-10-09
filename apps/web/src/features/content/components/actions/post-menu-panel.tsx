'use client';

import {
  postsControllerDelete,
  postsControllerHide,
  postsControllerSave,
  postsControllerUnhide,
  postsControllerUnsave,
  postsControllerUpdate,
} from '@pitchorium/api-client';
import type { Post } from '@pitchorium/contracts';
import {
  BarChart3,
  Bookmark,
  BookmarkMinus,
  EyeOff,
  Link2,
  MessageSquareOff,
  MessageSquareText,
  MoreHorizontal,
  Pencil,
  Share2,
  Trash2,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import {
  AlertDialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  IconButton,
  notify,
} from '@/components/ui';
import { routes } from '@/config/routes';
import { useProblemText } from './use-problem-text';

const loadStats = () => import('./post-stats');
const PostStats = lazy(loadStats);
const loadEditor = () => import('../composer/composer-dialog');
const ComposerDialog = lazy(loadEditor);

export interface PostMenuProps {
  /** Open at once: the reader asked before the panel was loaded. */
  defaultOpen?: boolean;
  /** The trigger takes the focus the plain button had. */
  focusTrigger?: boolean;
  post: Post;
  /** The publication changed (saved, edited, comments turned off): the card shows the new one. */
  onChange: (post: Post) => void;
  /** Hidden from the feed of the reader, or deleted: it leaves the list; null brings it back. */
  onRemove?: (reason: 'hidden' | 'deleted' | null) => void;
}

/**
 * The panel of « Plus d'actions » of a publication (loaded with its first use, PostMenu): save, hide from one's feed (undone from the toast), copy
 * its address, share it (Web Share on a phone); for its author, edit it, turn its comments off or
 * on, read its statistics, delete it after a confirmation. Message and report come with their
 * prompts (PROMPT FRONT 6 and 8).
 */
export function PostMenuPanel({
  post,
  onChange,
  onRemove,
  defaultOpen = false,
  focusTrigger = false,
}: PostMenuProps) {
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (focusTrigger) trigger.current?.focus();
  }, [focusTrigger]);
  const t = useTranslations('web.content.actions');
  const locale = useLocale();
  const problem = useProblemText();
  const [dialog, setDialog] = useState<'delete' | 'stats' | 'edit' | null>(null);
  // The origin of the page: the menu opens in the browser only.
  const address = () =>
    new URL(`/${locale}${routes.post(post.id)}`, window.location.origin).toString();
  const canShare = typeof navigator !== 'undefined' && 'share' in navigator;

  async function save() {
    const saved = !post.saved;
    onChange({ ...post, saved });
    try {
      await (saved ? postsControllerSave(post.id) : postsControllerUnsave(post.id));
      notify.success(saved ? t('saved') : t('unsaved'));
    } catch (error) {
      onChange(post);
      notify.error(problem(error));
    }
  }

  async function hide() {
    onRemove?.('hidden');
    try {
      await postsControllerHide(post.id);
      notify.undoable(t('hidden'), {
        label: t('undo'),
        onUndo: () => {
          onRemove?.(null);
          postsControllerUnhide(post.id).catch((error: unknown) => notify.error(problem(error)));
        },
      });
    } catch (error) {
      onRemove?.(null);
      notify.error(problem(error));
    }
  }

  async function toggleComments() {
    try {
      onChange(await postsControllerUpdate(post.id, { commentsDisabled: !post.commentsDisabled }));
    } catch (error) {
      notify.error(problem(error));
    }
  }

  return (
    <>
      <DropdownMenu defaultOpen={defaultOpen}>
        <DropdownMenuTrigger asChild>
          <IconButton
            ref={trigger}
            label={t('more')}
            icon={<MoreHorizontal />}
            size="sm"
            onPointerEnter={() => void loadStats()}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={() => void save()}>
            {post.saved ? <BookmarkMinus aria-hidden /> : <Bookmark aria-hidden />}
            {post.saved ? t('unsave') : t('save')}
          </DropdownMenuItem>
          {post.viewerIsAuthor ? null : (
            <DropdownMenuItem onSelect={() => void hide()}>
              <EyeOff aria-hidden />
              {t('hide')}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onSelect={() =>
              void navigator.clipboard.writeText(address()).then(
                () => notify.success(t('copied')),
                () => undefined,
              )
            }
          >
            <Link2 aria-hidden />
            {t('copyLink')}
          </DropdownMenuItem>
          {canShare ? (
            <DropdownMenuItem
              onSelect={() => void navigator.share({ url: address() }).catch(() => undefined)}
            >
              <Share2 aria-hidden />
              {t('share')}
            </DropdownMenuItem>
          ) : null}
          {post.viewerIsAuthor ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => setDialog('edit')}
                onPointerEnter={() => void loadEditor()}
              >
                <Pencil aria-hidden />
                {t('edit')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void toggleComments()}>
                {post.commentsDisabled ? (
                  <MessageSquareText aria-hidden />
                ) : (
                  <MessageSquareOff aria-hidden />
                )}
                {post.commentsDisabled ? t('enableComments') : t('disableComments')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setDialog('stats')}>
                <BarChart3 aria-hidden />
                {t('stats')}
              </DropdownMenuItem>
              <DropdownMenuItem tone="danger" onSelect={() => setDialog('delete')}>
                <Trash2 aria-hidden />
                {t('delete')}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {post.viewerIsAuthor ? (
        <AlertDialog
          open={dialog === 'delete'}
          onOpenChange={(open) => setDialog(open ? 'delete' : null)}
          title={t('deleteTitle')}
          description={t('deleteBody')}
          confirmLabel={t('deleteConfirm')}
          onConfirm={async () => {
            try {
              await postsControllerDelete(post.id);
              onRemove?.('deleted');
              notify.success(t('deleted'));
            } catch (error) {
              notify.error(problem(error));
            }
          }}
        />
      ) : null}
      {dialog === 'stats' ? (
        <Suspense fallback={null}>
          <PostStats postId={post.id} onClose={() => setDialog(null)} />
        </Suspense>
      ) : null}
      {dialog === 'edit' ? (
        <Suspense fallback={null}>
          <ComposerDialog
            open
            onOpenChange={(open) => !open && setDialog(null)}
            editing={post}
            onPublished={(updated) => {
              onChange(updated);
              setDialog(null);
            }}
          />
        </Suspense>
      ) : null}
    </>
  );
}
