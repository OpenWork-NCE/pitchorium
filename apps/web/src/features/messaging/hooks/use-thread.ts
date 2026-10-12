'use client';

import { messagingControllerMessages } from '@pitchorium/api-client';
import type { Message, MessagePage, ServerMessageEvent } from '@pitchorium/contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { LOCAL_EVENTS, REALTIME_EVENTS } from '@/lib/realtime/realtime-bus';
import { useRealtime } from '@/lib/realtime/use-realtime';
import { THREAD_PAGE_SIZE } from '../lib/limits';
import { gapBefore, lastSequence, mergeMessages, type Thread } from '../lib/thread';

export const threadKey = (conversationId: string) => ['messaging', 'thread', conversationId];

const toThread = (page: MessagePage): Thread => ({
  messages: page.items,
  hasOlder: page.hasMore,
});

/**
 * The messages of an open conversation (§10.4, ADR 0056, ADR 0146): the latest page read by the
 * server, older ones read on demand (scrolling up), a pushed message merged by its sequence, an
 * edit or a deletion replacing it, and what was missed read again by sequence after a gap or a
 * return of the channel (`local:resumed`), until nothing is left.
 */
export function useThread(conversationId: string, initial: MessagePage | null) {
  const queryClient = useQueryClient();
  const key = threadKey(conversationId);
  const query = useQuery({
    queryKey: key,
    queryFn: async ({ signal }) =>
      toThread(
        await messagingControllerMessages(conversationId, { limit: THREAD_PAGE_SIZE }, { signal }),
      ),
    ...(initial ? { initialData: toThread(initial) } : {}),
  });
  const [loadingOlder, setLoadingOlder] = useState(false);
  const syncing = useRef<Promise<void> | null>(null);

  const merge = useCallback(
    (messages: readonly Message[], hasOlder?: boolean) =>
      queryClient.setQueryData<Thread>(key, (current) => ({
        messages: mergeMessages(current?.messages ?? [], messages),
        hasOlder: hasOlder ?? current?.hasOlder ?? false,
      })),
    // The key is derived from the conversation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient, conversationId],
  );

  /** Reads what follows the last sequence held, page after page, once at a time. */
  const sync = useCallback(() => {
    syncing.current ??= (async () => {
      try {
        for (;;) {
          const held = queryClient.getQueryData<Thread>(key)?.messages ?? [];
          const page = await messagingControllerMessages(conversationId, {
            afterSequence: lastSequence(held),
            limit: THREAD_PAGE_SIZE,
          });
          merge(page.items);
          if (!page.hasMore) break;
        }
      } catch {
        // Read again at the next event or return of the channel.
      } finally {
        syncing.current = null;
      }
    })();
    return syncing.current;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient, conversationId, merge]);

  const loadOlder = useCallback(async () => {
    const thread = queryClient.getQueryData<Thread>(key);
    const first = thread?.messages[0];
    if (!thread?.hasOlder || !first || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const page = await messagingControllerMessages(conversationId, {
        beforeSequence: first.sequence,
        limit: THREAD_PAGE_SIZE,
      });
      merge(page.items, page.hasMore);
    } finally {
      setLoadingOlder(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient, conversationId, merge, loadingOlder]);

  useRealtime<ServerMessageEvent>(REALTIME_EVENTS.message, ({ message }) => {
    if (message.conversationId !== conversationId) return;
    const held = queryClient.getQueryData<Thread>(key)?.messages ?? [];
    if (gapBefore(held, message) !== null) void sync();
    else merge([message]);
  });
  useRealtime<ServerMessageEvent>(REALTIME_EVENTS.messageUpdated, ({ message }) => {
    if (message.conversationId === conversationId) merge([message]);
  });
  useRealtime(LOCAL_EVENTS.resumed, () => void sync());
  // Once it listens, the thread reads what follows its last message: an event pushed between
  // the render of the server and this subscription (the first seconds of the channel, ADR 0168)
  // is never lost.
  useEffect(() => {
    void sync();
  }, [sync]);

  return {
    thread: query.data ?? { messages: [], hasOlder: false },
    query,
    loadOlder,
    loadingOlder,
    merge,
  };
}
