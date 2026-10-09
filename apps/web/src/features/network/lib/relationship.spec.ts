import type { Relationship } from '@pitchorium/contracts';
import { describe, expect, it } from 'vitest';
import { afterAction } from './relationship';

const stranger: Relationship = {
  degree: 'second',
  mutualConnections: { count: 3, capped: false },
  connection: 'none',
  requestId: null,
  following: false,
  followedBy: false,
  blocked: false,
  counts: { followers: 10, connections: 4 },
};

describe('afterAction', () => {
  it('shows a sent request, then its withdrawal', () => {
    const sent = afterAction(stranger, { kind: 'request', requestId: 'request-1' });
    expect(sent).toMatchObject({ connection: 'request_sent', requestId: 'request-1' });
    expect(afterAction(sent, { kind: 'withdraw' })).toMatchObject({
      connection: 'none',
      requestId: null,
    });
  });

  it('connects on an accepted request, both following, the counts one higher', () => {
    const received = { ...stranger, connection: 'request_received' as const, requestId: 'r' };
    expect(afterAction(received, { kind: 'accept' })).toEqual({
      ...stranger,
      degree: 'first',
      connection: 'connected',
      requestId: null,
      following: true,
      followedBy: true,
      counts: { followers: 11, connections: 5 },
    });
  });

  it('counts a follow once, and keeps hidden counts hidden', () => {
    const followed = afterAction(stranger, { kind: 'follow' });
    expect(followed.counts).toEqual({ followers: 11, connections: 4 });
    expect(afterAction(followed, { kind: 'follow' })).toBe(followed);
    expect(afterAction(followed, { kind: 'unfollow' }).counts).toEqual(stranger.counts);
    const hidden = { ...stranger, counts: null };
    expect(afterAction(hidden, { kind: 'follow' })).toMatchObject({
      following: true,
      counts: null,
    });
  });

  it('removes a connection without a negative count', () => {
    const connected = {
      ...stranger,
      connection: 'connected' as const,
      counts: { followers: 0, connections: 0 },
    };
    expect(afterAction(connected, { kind: 'remove' })).toMatchObject({
      connection: 'none',
      counts: { followers: 0, connections: 0 },
    });
  });
});
