import type { ConversationParticipant, Message } from '@pitchorium/contracts';

/**
 * The messages of an open conversation, as the browser keeps them (§10.4, ADR 0056): one list
 * ordered by the sequence of the api, each message once. A pushed message is merged; a sequence
 * further than the next one says that messages were missed, read again from the last known one.
 * Pure, tested; the api stays the truth.
 */
export interface Thread {
  messages: Message[];
  /** Older messages remain before the first one held. */
  hasOlder: boolean;
}

/** Last sequence held, 0 for none. */
export function lastSequence(messages: readonly Message[]): number {
  return messages.at(-1)?.sequence ?? 0;
}

/** Merges messages into a list: a known one is replaced (edited, deleted), the order is kept. */
export function mergeMessages(
  current: readonly Message[],
  incoming: readonly Message[],
): Message[] {
  if (incoming.length === 0) return [...current];
  const bySequence = new Map(current.map((message) => [message.sequence, message]));
  for (const message of incoming) bySequence.set(message.sequence, message);
  return [...bySequence.values()].sort((a, b) => a.sequence - b.sequence);
}

/**
 * Where to read again from after a pushed message: the last sequence held when the message is
 * not the next one (a gap: messages missed while the channel was cut), null otherwise.
 */
export function gapBefore(messages: readonly Message[], incoming: Message): number | null {
  const last = lastSequence(messages);
  if (messages.length === 0 || incoming.sequence <= last + 1) return null;
  return last;
}

/** What a message sent by the reader shows under it: read by every other one, or sent. */
export type Receipt = 'read' | 'sent';

export function receiptOf(
  message: Pick<Message, 'sequence'>,
  others: readonly Pick<ConversationParticipant, 'lastReadSequence' | 'left'>[],
): Receipt {
  const present = others.filter((participant) => !participant.left);
  return present.length > 0 &&
    present.every((participant) => participant.lastReadSequence >= message.sequence)
    ? 'read'
    : 'sent';
}

/** A read receipt pushed by the api moves a reading position forward, never back. */
export function advanceRead<T extends Pick<ConversationParticipant, 'lastReadSequence'>>(
  participant: T,
  sequence: number,
): T {
  return sequence > participant.lastReadSequence
    ? { ...participant, lastReadSequence: sequence }
    : participant;
}

/** Where a message being sent stands. */
export type PendingStatus = 'sending' | 'waiting' | 'failed';

/** A message of the reader not yet stored by the api (an optimistic send). */
export interface PendingMessage {
  clientMessageId: string;
  body: string;
  attachments: { mediaId: string; text: string; previewUrl: string | null }[];
  sharedPostId: string | null;
  status: PendingStatus;
  /** Stable code of the refusal of the api, for a failed send. */
  code: string | null;
  createdAt: string;
}

/** What the queue of sends gives: the input of a send and the state of its mutation. */
export interface SendState {
  conversationId: string;
  clientMessageId: string;
  body: string;
  attachments: PendingMessage['attachments'];
  sharedPostId: string | null;
  submittedAt: number;
  status: 'idle' | 'pending' | 'success' | 'error';
  isPaused: boolean;
  code: string | null;
}

/**
 * The sends of a conversation still to show: neither stored (a message of the same client id
 * is held) nor succeeded. A paused send waits for the network; a failed one offers a new attempt
 * or its removal, which takes it back (the optimistic message leaves the thread).
 */
export function pendingMessages(
  sends: readonly SendState[],
  conversationId: string,
  held: readonly Message[],
): PendingMessage[] {
  const stored = new Set(held.map((message) => message.clientMessageId));
  return sends
    .filter(
      (send) =>
        send.conversationId === conversationId &&
        send.status !== 'success' &&
        !stored.has(send.clientMessageId),
    )
    .sort((a, b) => a.submittedAt - b.submittedAt)
    .map((send) => ({
      clientMessageId: send.clientMessageId,
      body: send.body,
      attachments: send.attachments,
      sharedPostId: send.sharedPostId,
      status: send.status === 'error' ? 'failed' : send.isPaused ? 'waiting' : 'sending',
      code: send.status === 'error' ? send.code : null,
      createdAt: new Date(send.submittedAt).toISOString(),
    }));
}

/** A client identifier of a message: 8 to 64 characters of `[A-Za-z0-9_-]` (contracts). */
export function newClientMessageId(): string {
  return `web-${crypto.randomUUID()}`;
}
