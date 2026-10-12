'use client';

import type { Conversation, Message, MessagePage } from '@pitchorium/contracts';
import { ArrowLeft, BellOff, ShieldOff } from 'lucide-react';
import { useLocale, useTimeZone, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { Avatar, AvatarGroup, Button, EmptyState, ErrorState, IconButton } from '@/components/ui';
import * as routes from '@/config/paths';
import { useCurrentMember } from '@/features/identity';
import { Link } from '@/i18n/navigation';
import { formatNames } from '@/lib/format/list';
import { useConversation } from '../hooks/use-conversation';
import { isNotFound } from '../hooks/use-messaging-problem';
import { useSendMessage } from '../hooks/use-send-message';
import { useThread } from '../hooks/use-thread';
import { pendingMessages } from '../lib/thread';
import { threadRows } from '../lib/thread-rows';
import { ConversationMenu } from './conversation-menu';

/**
 * The answer to a request, or its wait: painted by the server, so loaded with the page. Loaded on
 * demand, a click on Accept before its code arrived went nowhere (no request sent; trace of the
 * diagnosis, FRONT 8A).
 */
import RequestBanner from './request-banner';

import { MessageActions } from './message-actions';
import { LazyMessageComposer } from './lazy-composer';
import { ThreadScroller } from './thread-scroller';
import { TypingIndicator } from './typing-indicator';
import { useAccess } from '@/features/access';

interface ConversationViewProps {
  conversationId: string;
  initialConversation: Conversation | null;
  initialMessages: MessagePage | null;
}

/** The names of the other participants, in a sentence (« Ama, Kofi et Awa »). */
export function namesOf(conversation: Conversation, locale: string, fallback: string): string {
  const names = conversation.participants
    .filter((participant) => !participant.left)
    .map((participant) => participant.member.displayName);
  return names.length > 0 ? formatNames(names, locale) : fallback;
}

/**
 * An open conversation (§10.4): its participants, its thread kept by the realtime channel (sent
 * optimistically, read receipts, typing), the answer to a request received, the wait of a request
 * sent, the reason nothing can be sent, and its actions. A conversation that no longer shows
 * (a block, a declined request) gives a neutral explanation, never the reason.
 */
export function ConversationView({
  conversationId,
  initialConversation,
  initialMessages,
}: ConversationViewProps) {
  const t = useTranslations('web.messaging');
  const member = useCurrentMember();
  const timeZone = useTimeZone() ?? 'UTC';
  const locale = useLocale();
  const view = useConversation(conversationId, initialConversation);
  const { thread, query, loadOlder, loadingOlder, merge } = useThread(
    conversationId,
    initialMessages,
  );
  const sending = useSendMessage(conversationId, merge);
  // A suspended account reads its conversations but writes no more: the api says why.
  const participate = useAccess('messaging.conversation.participate');
  // Messages of the others translated at the reader's request, by their id (§8.3).
  const [translated, setTranslated] = useState<ReadonlySet<string>>(new Set());

  const pending = pendingMessages(sending.sends, conversationId, thread.messages);
  // Compared by their state: the queue of sends gives new objects at each render.
  const pendingKey = JSON.stringify(pending);
  const rows = useMemo(
    () => threadRows(thread.messages, JSON.parse(pendingKey) as typeof pending, timeZone),
    [thread.messages, pendingKey, timeZone],
  );

  const conversation = view.conversation;
  // Not found for the reader (a block, a declined request): a neutral page, never the reason.
  const gone = isNotFound(view.query.error) || isNotFound(query.error);
  if (gone) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <EmptyState
          icon={<ShieldOff />}
          title={t('thread.gone')}
          description={t('thread.goneBody')}
          action={
            <Button asChild variant="secondary">
              <Link href={routes.messages}>{t('thread.back')}</Link>
            </Button>
          }
        />
      </div>
    );
  }
  if (!conversation) {
    return view.query.isError ? (
      <ErrorState
        title={t('thread.error')}
        onRetry={() => void view.query.refetch()}
        retrying={view.query.isRefetching}
      />
    ) : null;
  }

  const others = conversation.participants.filter((participant) => !participant.left);
  const names = namesOf(conversation, locale, t('someone'));
  const direct = conversation.kind === 'direct' ? others[0]?.member : undefined;
  const group = conversation.kind === 'group';
  const disabledReason = !participate.allowed
    ? participate.reason
    : conversation.requestState === 'sent'
      ? t('request.sentShort')
      : conversation.canSend
        ? undefined
        : t('cannotSend');

  const lastStored = thread.messages.at(-1);
  return (
    <section
      aria-labelledby={`conversation-${conversationId}`}
      className="flex h-full min-h-0 flex-col"
    >
      <header className="flex items-center gap-3 border-b border-border px-3 py-2.5 sm:px-4">
        <IconButton
          className="lg:hidden"
          label={t('thread.back')}
          icon={<ArrowLeft />}
          link={<Link href={routes.messages} />}
        />
        {group ? (
          <AvatarGroup
            size="sm"
            max={3}
            label={names}
            people={others.map((participant) => ({
              name: participant.member.displayName,
              src: participant.member.avatarUrl,
            }))}
          />
        ) : (
          <Avatar name={names} src={direct?.avatarUrl ?? null} size="md" decorative />
        )}
        <div className="grid min-w-0 flex-1">
          <h2
            id={`conversation-${conversationId}`}
            className="truncate text-base font-semibold text-foreground"
          >
            {direct ? (
              <Link href={routes.member(direct.handle)} className="hover:underline">
                {direct.displayName}
              </Link>
            ) : (
              names
            )}
          </h2>
          <p className="flex items-center gap-1.5 truncate text-xs text-muted">
            {conversation.muted ? (
              <>
                <BellOff aria-hidden className="size-3.5" />
                <span>{t('list.muted')}</span>
                <span aria-hidden>·</span>
              </>
            ) : null}
            <span className="truncate">{group ? t('thread.group') : (direct?.headline ?? '')}</span>
          </p>
        </div>
        <ConversationMenu conversation={conversation} update={view.update} leave={view.leave} />
      </header>

      {conversation.requestState === 'none' ? null : (
        <RequestBanner
          state={conversation.requestState}
          names={names}
          accept={view.accept}
          decline={view.decline}
        />
      )}

      <ThreadScroller
        rows={rows}
        context={{
          participants: conversation.participants,
          group,
          lastSentId: thread.messages.findLast((message) => message.mine)?.id ?? null,
          dayHeadingLevel: 3,
          renderActions: (message: Message) =>
            message.deleted ? null : (
              <MessageActions
                message={message}
                onChange={(changed) => merge([changed])}
                onTranslate={() => setTranslated((current) => new Set(current).add(message.id))}
              />
            ),
          translated,
          onRetry: sending.retry,
          onDiscard: sending.discard,
        }}
        hasOlder={thread.hasOlder}
        loadingOlder={loadingOlder}
        onLoadOlder={() => void loadOlder()}
        onSeeEnd={() => {
          if (lastStored && conversation.requestState !== 'received') {
            view.markRead(lastStored.sequence);
          }
        }}
        footer={
          <TypingIndicator
            names={view.typing.map(
              (handle) =>
                conversation.participants.find(
                  (participant) => participant.member.handle === handle,
                )?.member.displayName ?? t('someone'),
            )}
          />
        }
      />

      <div className="border-t border-border p-3">
        <LazyMessageComposer
          onSend={(content) => void sending.send(content)}
          disabledReason={disabledReason}
          draft={{ memberId: member.user.id, conversationId }}
          onTyping={view.signalTyping}
        />
      </div>
    </section>
  );
}
