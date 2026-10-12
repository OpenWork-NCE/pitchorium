import type { Message } from '@pitchorium/contracts';
import { describe, expect, it } from 'vitest';
import {
  advanceRead,
  gapBefore,
  mergeMessages,
  pendingMessages,
  receiptOf,
  type SendState,
} from './thread';

function message(sequence: number, body = `m${sequence}`): Message {
  return {
    id: `0199a0b0-0000-7000-8000-${String(sequence).padStart(12, '0')}`,
    conversationId: 'c',
    sequence,
    clientMessageId: `client-${sequence}`,
    kind: 'text',
    senderHandle: 'kofi',
    mine: false,
    body,
    language: null,
    attachments: [],
    sharedPost: null,
    edited: false,
    deleted: false,
    moderationStatus: 'visible',
    createdAt: new Date(sequence * 60_000).toISOString(),
    editedAt: null,
    editableUntil: null,
  };
}

function send(change: Partial<SendState>): SendState {
  return {
    conversationId: 'c',
    clientMessageId: 'web-1',
    body: 'Bonjour',
    attachments: [],
    sharedPostId: null,
    submittedAt: 1_000,
    status: 'pending',
    isPaused: false,
    code: null,
    ...change,
  };
}

describe('the thread of a conversation', () => {
  it('merges by sequence, each message once, an edited one replaced', () => {
    const merged = mergeMessages([message(1), message(2)], [message(3), message(2, 'modifié')]);
    expect(merged.map((m) => [m.sequence, m.body])).toEqual([
      [1, 'm1'],
      [2, 'modifié'],
      [3, 'm3'],
    ]);
  });

  it('syncs from the last sequence held when a pushed message skips some', () => {
    const held = [message(1), message(2)];
    expect(gapBefore(held, message(3))).toBeNull();
    // Messages 3 and 4 were missed while the channel was cut.
    expect(gapBefore(held, message(5))).toBe(2);
    expect(gapBefore(held, message(2))).toBeNull();
    expect(gapBefore([], message(7))).toBeNull();
  });

  it('shows a send at once, then lets the stored message take its place', () => {
    const sending = pendingMessages([send({})], 'c', [message(1)]);
    expect(sending).toMatchObject([{ clientMessageId: 'web-1', status: 'sending' }]);
    const stored = { ...message(2, 'Bonjour'), clientMessageId: 'web-1', mine: true };
    expect(pendingMessages([send({})], 'c', [message(1), stored])).toEqual([]);
    expect(pendingMessages([send({ status: 'success' })], 'c', [])).toEqual([]);
  });

  it('says a send waiting for the network, and a refused one with its code until removed', () => {
    expect(pendingMessages([send({ isPaused: true })], 'c', [])[0]?.status).toBe('waiting');
    const refused = send({ status: 'error', code: 'MESSAGING_CANNOT_SEND' });
    expect(pendingMessages([refused], 'c', [])[0]).toMatchObject({
      status: 'failed',
      code: 'MESSAGING_CANNOT_SEND',
    });
    // Removing the failed send takes the optimistic message back.
    expect(pendingMessages([], 'c', [])).toEqual([]);
    expect(pendingMessages([send({ conversationId: 'other' })], 'c', [])).toEqual([]);
  });

  it('marks a message read once every other present participant read it', () => {
    const others = [
      { lastReadSequence: 4, left: false },
      { lastReadSequence: 2, left: false },
    ];
    expect(receiptOf({ sequence: 3 }, others)).toBe('sent');
    expect(receiptOf({ sequence: 3 }, [others[0]!, { lastReadSequence: 2, left: true }])).toBe(
      'read',
    );
    expect(advanceRead({ lastReadSequence: 4 }, 3)).toEqual({ lastReadSequence: 4 });
    expect(advanceRead({ lastReadSequence: 4 }, 6)).toEqual({ lastReadSequence: 6 });
  });
});
