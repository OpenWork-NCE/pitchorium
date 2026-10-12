'use client';

import type { Message } from '@pitchorium/contracts';
import { AlertCircle, Check, CheckCheck, Clock, CloudOff } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { lazy, type ReactNode, Suspense } from 'react';
import { IconSwap } from '@/components/motion';
import { Avatar, Button, Notice } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import * as routes from '@/config/paths';
import { cn } from '@/lib/cn';
import type { PendingMessage, Receipt } from '../lib/thread';
import type { ThreadItem } from '../lib/thread-rows';
import { Translated } from '@/features/localization';

/** The viewer and the document of the publications load with a message that has files. */
const Attachments = lazy(() => import('./message-attachments'));

/** Corners of a bubble in its group: tighter on the side of the author inside a group. */
function corners(mine: boolean, first: boolean, last: boolean): string {
  return mine
    ? cn(!first && 'rounded-tr-md', !last && 'rounded-br-md')
    : cn(!first && 'rounded-tl-md', !last && 'rounded-bl-md');
}

/**
 * A publication shared in a message (§10.3), as its reader may see it now: the api checks the
 * audience at each read, and a reader out of it gets a neutral mention, never the content.
 */
function SharedPost({ message }: { message: Message }) {
  const t = useTranslations('web.messaging');
  const shared = message.sharedPost;
  if (!shared) return null;
  const post = shared.post;
  if (!post) {
    return (
      <p className="w-full max-w-sm rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted">
        {t('sharedUnavailable')}
      </p>
    );
  }
  const organization = post.author.type === 'organization' ? post.author.organization : null;
  const name =
    post.author.type === 'member' ? post.author.member.displayName : post.author.organization.name;
  const picture =
    post.author.type === 'member' ? post.author.member.avatarUrl : post.author.organization.logoUrl;
  return (
    <Link
      href={routes.post(shared.postId)}
      className="grid w-full max-w-sm gap-2 rounded-xl border border-border bg-surface p-3 text-foreground outline-none hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-focus"
    >
      <span className="flex items-center gap-2 text-sm font-medium">
        <Avatar
          name={name}
          src={picture}
          size="xs"
          shape={organization ? 'square' : 'circle'}
          decorative
        />
        {t('sharedPost', { name })}
      </span>
      {post.text ? <span className="line-clamp-3 text-sm text-pretty">{post.text}</span> : null}
      <span className="text-xs font-medium text-accent">{t('openPost')}</span>
    </Link>
  );
}

/** Where a message of the reader stands, by an icon that swaps with the state. */
export function SendState({
  state,
  label,
}: {
  state: 'sending' | 'waiting' | 'failed' | Receipt;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1" data-send-state={state}>
      <IconSwap
        state={state}
        className="size-4"
        icons={{
          sending: <Clock className="size-4" />,
          waiting: <CloudOff className="size-4" />,
          failed: <AlertCircle className="size-4 text-danger" />,
          sent: <Check className="size-4" />,
          read: <CheckCheck className="size-4" />,
        }}
      />
      {label}
    </span>
  );
}

interface MessageBubbleProps {
  item: ThreadItem;
  mine: boolean;
  first: boolean;
  last: boolean;
  /** The time, the receipt or the state of a send, under the last message of a group. */
  meta: ReactNode;
  /**
   * Actions of a message, shown on hover and focus: of the reader (edit, delete), or of another
   * participant (translate, report).
   */
  actions?: ReactNode;
  /** Translated at the reader's request: the translation in place of the text (§8.3). */
  translated?: boolean;
  /** Retry and remove a refused send. */
  onRetry?: (pending: PendingMessage) => void;
  onDiscard?: (pending: PendingMessage) => void;
  /** A message that arrived after the opening: it fades in and rises (motion.md). */
  fresh: boolean;
}

/**
 * A message of a thread (§10.4): its text (« modifié » once edited), its files in the viewer of
 * the publications, the publication it shares, a tombstone once deleted, the notice of the
 * moderation for a message hidden, and for a message being sent its state and, once refused,
 * a new attempt or its removal.
 */
export function MessageBubble({
  item,
  mine,
  first,
  last,
  meta,
  actions,
  translated = false,
  onRetry,
  onDiscard,
  fresh,
}: MessageBubbleProps) {
  const t = useTranslations('web.messaging');
  const errors = useTranslations('errors');
  const format = useFormatter();
  const bubble = cn(
    'rounded-2xl px-4 py-2.5 text-sm text-pretty break-words whitespace-pre-line',
    mine ? 'bg-accent text-on-accent' : 'bg-message-received text-foreground',
    corners(mine, first, last),
  );

  if (item.state === 'pending') {
    const pending = item.message;
    return (
      <div
        className={cn('grid justify-items-end gap-1', fresh && 'message-in')}
        data-pending={pending.status}
      >
        {pending.body ? <p className={cn(bubble, 'opacity-80')}>{pending.body}</p> : null}
        {pending.attachments.length > 0 ? (
          <ul className="flex flex-wrap justify-end gap-2" aria-label={t('attachmentsLabel')}>
            {pending.attachments.map((attachment) => (
              <li
                key={attachment.mediaId}
                className="overflow-hidden rounded-lg border border-border bg-surface-sunken text-xs text-muted"
              >
                {attachment.previewUrl ? (
                  // A local preview (object URL) of a file being sent.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={attachment.previewUrl}
                    alt={attachment.text}
                    className="size-20 object-cover"
                  />
                ) : (
                  <span className="block max-w-40 truncate px-3 py-2">
                    {attachment.text || t('attachmentFile')}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : null}
        <p className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1 px-1 text-xs text-muted">
          <SendState state={pending.status} label={t(pending.status)} />
          {pending.status === 'failed' ? (
            <>
              {pending.code && errors.has(pending.code as never) ? (
                <span className="text-danger">{errors(pending.code as never)}</span>
              ) : null}
              <Button variant="link" size="sm" onClick={() => onRetry?.(pending)}>
                {t('retry')}
              </Button>
              <Button variant="link" size="sm" onClick={() => onDiscard?.(pending)}>
                {t('discard')}
              </Button>
            </>
          ) : null}
        </p>
      </div>
    );
  }

  const message = item.message;
  const hidden =
    message.body === null && !message.deleted && message.moderationStatus !== 'visible';
  return (
    <div
      className={cn(
        'group/message relative grid gap-1',
        mine ? 'justify-items-end' : 'justify-items-start',
        fresh && 'message-in',
      )}
      data-message-sequence={message.sequence}
    >
      {message.kind === 'introduction' ? (
        <p className="text-xs font-medium text-muted">{t('introductionNote')}</p>
      ) : null}
      {message.deleted ? (
        <p className={cn(bubble, 'italic opacity-80')}>{t('deleted')}</p>
      ) : hidden ? (
        <Notice kind="moderated" className="max-w-sm" />
      ) : (
        <>
          {message.body && translated && !mine ? (
            <div className={bubble}>
              <Translated source={{ type: 'message', id: message.id }} language={message.language}>
                <p>{message.body}</p>
              </Translated>
            </div>
          ) : message.body ? (
            <p className={bubble}>
              {message.body}
              {message.edited ? (
                <span className="ml-1 text-xs opacity-80">
                  <span aria-hidden>{t('edited')}</span>
                  <span className="sr-only">
                    {message.editedAt
                      ? t('editedAt', {
                          date: format.dateTime(new Date(message.editedAt), {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          }),
                        })
                      : t('edited')}
                  </span>
                </span>
              ) : null}
            </p>
          ) : null}
          {message.attachments.length > 0 ? (
            <Suspense
              fallback={
                <span className="block h-24 w-full max-w-sm rounded-xl bg-surface-sunken" />
              }
            >
              <Attachments message={message} />
            </Suspense>
          ) : null}
          <SharedPost message={message} />
        </>
      )}
      {actions ? (
        <div
          className={cn(
            'absolute top-0 opacity-0 transition-opacity group-focus-within/message:opacity-100 group-hover/message:opacity-100 pointer-coarse:opacity-100',
            mine ? 'right-full mr-1' : 'left-full ml-1',
          )}
        >
          {actions}
        </div>
      ) : null}
      {meta}
    </div>
  );
}
