'use client';

import type { Message } from '@pitchorium/contracts';
import {
  type Mutation,
  MutationObserver,
  useMutationState,
  useQueryClient,
} from '@tanstack/react-query';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { useWithPrerequisites } from '@/features/access';
import {
  type Intent,
  type MessageInput,
  PERSISTED_MUTATIONS,
} from '@/lib/query/persisted-mutations';
import { newClientMessageId, type PendingMessage, type SendState } from '../lib/thread';
import { problemCode } from './use-messaging-problem';

/** What the reader writes: a text, files already sent, a publication shared. */
export interface MessageContent {
  body: string;
  attachments: { mediaId: string; text: string; previewUrl: string | null }[];
  sharedPostId?: string | undefined;
}

type SendMutation = Mutation<Message, unknown, Intent<MessageInput>>;

function stateOf(mutation: SendMutation): SendState & { data: Message | undefined } {
  const variables = mutation.state.variables;
  const body = variables?.input.body;
  return {
    conversationId: variables?.input.conversationId ?? '',
    clientMessageId: body?.clientMessageId ?? '',
    body: body?.body ?? '',
    attachments: variables?.input.display?.attachments ?? [],
    sharedPostId: body?.sharedPostId ?? null,
    submittedAt: mutation.state.submittedAt,
    status: mutation.state.status,
    isPaused: mutation.state.isPaused,
    code: problemCode(mutation.state.error),
    data: mutation.state.data,
  };
}

const sameMessage = (mutation: Mutation, clientMessageId: string) =>
  (mutation.state.variables as Intent<MessageInput> | undefined)?.input.body.clientMessageId ===
  clientMessageId;

/**
 * Sends a message optimistically (§10.4, ADR 0056, ADR 0102): the message shows at once from
 * the queue of sends with its client id, a send made offline waits for the network (and
 * survives the closing of the tab), the api deduplicates a send replayed with the same client
 * id and key. A refused send stays shown with its reason, to be sent again or taken back; the
 * stored message replaces the optimistic one by its client id, whatever brings it first (the
 * answer of the api, the realtime event, a reload).
 */
export function useSendMessage(conversationId: string, merge: (messages: Message[]) => void) {
  const queryClient = useQueryClient();
  const withPrerequisites = useWithPrerequisites();
  const queued = useMutationState({
    filters: { mutationKey: PERSISTED_MUTATIONS.message.mutationKey },
    select: (mutation) => stateOf(mutation as SendMutation),
  });
  // The sends restored from the device may arrive before the thread hydrates: shown once mounted,
  // so that the first render equals the one of the server.
  const hydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const sends = hydrated ? queued : [];

  // A send restored after a reload has no callback of its own: its stored message joins here.
  const stored = sends.flatMap((send) =>
    send.conversationId === conversationId && send.data ? [send.data] : [],
  );
  const storedKey = stored.map((message) => message.id).join();
  useEffect(() => {
    if (stored.length > 0) merge(stored);
    // The list is compared by its identifiers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storedKey, merge]);

  const run = useCallback(
    (intent: Intent<MessageInput>) =>
      withPrerequisites(() =>
        new MutationObserver<Message, unknown, Intent<MessageInput>>(queryClient, {
          ...PERSISTED_MUTATIONS.message,
          mutationFn: PERSISTED_MUTATIONS.message.mutationFn,
          // One conversation sends in the order of writing.
          scope: { id: `message:${intent.input.conversationId}` },
        }).mutate(intent),
      ).then(
        (message) => merge([message]),
        () => undefined,
      ),
    [queryClient, withPrerequisites, merge],
  );

  const send = useCallback(
    (content: MessageContent) =>
      run({
        key: crypto.randomUUID(),
        input: {
          conversationId,
          body: {
            clientMessageId: newClientMessageId(),
            body: content.body,
            attachmentIds: content.attachments.map((attachment) => attachment.mediaId),
            attachmentTexts: content.attachments.map((attachment) => attachment.text),
            ...(content.sharedPostId ? { sharedPostId: content.sharedPostId } : {}),
          },
          display: { attachments: content.attachments },
        },
      }),
    [conversationId, run],
  );

  const find = (clientMessageId: string) =>
    queryClient
      .getMutationCache()
      .getAll()
      .find((mutation) => sameMessage(mutation, clientMessageId));

  /** Sends a refused message again, with the same client id and key (never twice). */
  const retry = (pending: PendingMessage) => {
    const mutation = find(pending.clientMessageId);
    const variables = mutation?.state.variables as Intent<MessageInput> | undefined;
    if (!mutation || !variables) return;
    queryClient.getMutationCache().remove(mutation);
    void run(variables);
  };

  /** Takes a refused message back: it leaves the thread. */
  const discard = (pending: PendingMessage) => {
    const mutation = find(pending.clientMessageId);
    if (mutation) queryClient.getMutationCache().remove(mutation);
  };

  return { sends, send, retry, discard };
}
