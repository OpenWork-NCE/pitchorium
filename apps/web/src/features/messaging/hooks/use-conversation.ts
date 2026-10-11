'use client';

import {
  getMessagingControllerGetQueryKey,
  getMessagingControllerListQueryKey,
  getNotificationsControllerCountersQueryKey,
  messagingControllerAccept,
  messagingControllerDecline,
  messagingControllerGet,
  messagingControllerLeave,
  messagingControllerRead,
  messagingControllerUpdate,
} from '@pitchorium/api-client';
import type {
  Conversation,
  ServerReadEvent,
  ServerTypingEvent,
  UpdateConversationRequest,
} from '@pitchorium/contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { emitRealtime, REALTIME_EVENTS } from '@/lib/realtime/realtime-bus';
import { useRealtime } from '@/lib/realtime/use-realtime';
import { advanceRead } from '../lib/thread';

/** A typing indicator fades this long after the last signal of the other participant. */
export const TYPING_VISIBLE_MS = 5_000;
/** The member's own typing is signalled at most once in this delay. */
export const TYPING_THROTTLE_MS = 3_000;

/**
 * An open conversation (§10.4): its state read by the server first, then kept by the realtime
 * channel (read receipts move forward, a change of state reads it again), the members typing,
 * and the gestures of the member on it (archive, mute, mark unread, leave a group, answer a
 * request). The lists and the counters are read again after each gesture.
 */
export function useConversation(conversationId: string, initial: Conversation | null) {
  const queryClient = useQueryClient();
  const key = getMessagingControllerGetQueryKey(conversationId);
  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) =>
      messagingControllerGet(conversationId, { signal }) as Promise<Conversation>,
    ...(initial ? { initialData: initial } : {}),
  });
  const [typing, setTyping] = useState<string[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: key });
    void queryClient.invalidateQueries({ queryKey: getMessagingControllerListQueryKey() });
    void queryClient.invalidateQueries({
      queryKey: getNotificationsControllerCountersQueryKey(),
    });
  };

  useRealtime<ServerReadEvent>(REALTIME_EVENTS.read, (event) => {
    if (event.conversationId !== conversationId || event.mine || !event.handle) return;
    queryClient.setQueryData<Conversation>(key, (current) =>
      current
        ? {
            ...current,
            participants: current.participants.map((participant) =>
              participant.member.handle === event.handle
                ? advanceRead(participant, event.sequence)
                : participant,
            ),
          }
        : current,
    );
  });
  useRealtime<{ conversationId: string }>(REALTIME_EVENTS.conversation, (event) => {
    if (event.conversationId === conversationId) {
      void queryClient.invalidateQueries({ queryKey: key });
    }
  });
  useRealtime<ServerTypingEvent>(REALTIME_EVENTS.typing, (event) => {
    if (event.conversationId !== conversationId) return;
    clearTimeout(timers.current.get(event.handle));
    setTyping((current) => (current.includes(event.handle) ? current : [...current, event.handle]));
    timers.current.set(
      event.handle,
      setTimeout(() => {
        setTyping((current) => current.filter((handle) => handle !== event.handle));
      }, TYPING_VISIBLE_MS),
    );
  });
  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => clearTimeout(timer));
  }, []);

  const lastTyped = useRef(0);
  /** Signals that the member types, at most once in TYPING_THROTTLE_MS; never stored. */
  const signalTyping = () => {
    const now = Date.now();
    if (now - lastTyped.current < TYPING_THROTTLE_MS) return;
    lastTyped.current = now;
    emitRealtime(REALTIME_EVENTS.typing, { conversationId });
  };

  /** Moves the reading position of the member forward (never back), once per sequence. */
  const readUpTo = useRef(query.data?.lastReadSequence ?? 0);
  const markRead = (sequence: number) => {
    if (sequence <= readUpTo.current) return;
    readUpTo.current = sequence;
    void messagingControllerRead(conversationId, { sequence }).then(refresh, () => {
      readUpTo.current = 0;
    });
  };

  const update = async (change: UpdateConversationRequest) => {
    const updated = await messagingControllerUpdate(conversationId, change);
    queryClient.setQueryData(key, updated);
    refresh();
    return updated;
  };

  return {
    conversation: query.data ?? null,
    query,
    typing,
    signalTyping,
    markRead,
    update,
    leave: async () => {
      await messagingControllerLeave(conversationId);
      refresh();
    },
    accept: async () => {
      await messagingControllerAccept(conversationId);
      refresh();
    },
    decline: async () => {
      await messagingControllerDecline(conversationId);
      refresh();
    },
  };
}
