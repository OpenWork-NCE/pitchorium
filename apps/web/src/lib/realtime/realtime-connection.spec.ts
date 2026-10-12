// @vitest-environment jsdom
import { QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

/** A socket of Socket.IO reduced to what the connection uses. */
class FakeSocket {
  connected = false;
  active = true;
  disconnect = vi.fn(() => {
    this.connected = false;
    this.active = false;
  });
  private handlers = new Map<string, ((...args: unknown[]) => void)[]>();
  on(event: string, handler: (...args: unknown[]) => void) {
    this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler]);
    return this;
  }
  once(event: string, handler: (...args: unknown[]) => void) {
    return this.on(event, handler);
  }
  off(event: string) {
    this.handlers.delete(event);
    return this;
  }
  any: ((event: string, payload: unknown) => void) | undefined;
  onAny(listener: (event: string, payload: unknown) => void) {
    this.any = listener;
    return this;
  }
  offAny() {
    return this;
  }
  emit(event: string) {
    for (const handler of this.handlers.get(event) ?? []) handler();
  }
}

const sockets = vi.hoisted(() => [] as unknown[]);
vi.mock('socket.io-client', () => ({
  io: () => {
    const socket = new FakeSocket();
    sockets.push(socket);
    return socket;
  },
}));
vi.mock('@/lib/public-env', () => ({ publicEnv: { apiUrl: 'http://api.test' } }));

/** The handlers of the events, as realtime-handlers.ts builds them, recording what they get. */
const handled = vi.hoisted(() => [] as [string, unknown][]);
const built = vi.hoisted(() => ({ count: 0 }));
vi.mock('./realtime-handlers', () => ({
  realtimeHandlers: () => {
    built.count += 1;
    const record = (event: string) => (payload: unknown) => handled.push([event, payload]);
    return {
      'messaging:message': record('messaging:message'),
      'notifications:notification': record('notifications:notification'),
      counters: record('counters'),
    };
  },
}));

// After the mocks, which Vitest hoists above every import.
import { connect } from './realtime-connection';

afterEach(() => {
  sockets.length = 0;
  handled.length = 0;
  built.count = 0;
});

describe('realtime connection', () => {
  it('closes an established socket at once', () => {
    const close = connect(new QueryClient());
    const socket = sockets[0] as FakeSocket;
    socket.connected = true;
    close();
    expect(socket.disconnect).toHaveBeenCalledOnce();
  });

  it('closes a socket still connecting once its attempt ends, not before', () => {
    const close = connect(new QueryClient());
    const socket = sockets[0] as FakeSocket;
    close();
    expect(socket.disconnect).not.toHaveBeenCalled();
    socket.emit('connect');
    expect(socket.disconnect).toHaveBeenCalledOnce();
  });

  // The handlers carry Zod and the schemas: fetched ten seconds after the connection, to keep
  // them off the start of the page (ADR 0163), but at once by the first event (ADR 0168).
  it('handles an event of the first seconds at once, without waiting for the preload', async () => {
    const close = connect(new QueryClient());
    const socket = sockets[0] as FakeSocket;
    socket.any?.('notifications:notification', { id: 'n1' });
    await vi.waitFor(
      () => expect(handled).toEqual([['notifications:notification', { id: 'n1' }]]),
      {
        timeout: 500,
      },
    );
    close();
  });

  it('handles the events received while the handlers load in their order, once', async () => {
    const close = connect(new QueryClient());
    const socket = sockets[0] as FakeSocket;
    socket.any?.('messaging:message', { sequence: 1 });
    socket.any?.('notifications:notification', { id: 'n1' });
    socket.any?.('messaging:message', { sequence: 2 });
    await vi.waitFor(() => expect(handled).toHaveLength(3), { timeout: 500 });
    socket.any?.('counters', { counters: {} });
    await vi.waitFor(() => expect(handled).toHaveLength(4), { timeout: 500 });
    expect(handled).toEqual([
      ['messaging:message', { sequence: 1 }],
      ['notifications:notification', { id: 'n1' }],
      ['messaging:message', { sequence: 2 }],
      ['counters', { counters: {} }],
    ]);
    expect(built.count).toBe(1);
    close();
  });

  it('ignores an event the handlers do not know, and goes on with the next', async () => {
    const close = connect(new QueryClient());
    const socket = sockets[0] as FakeSocket;
    socket.any?.('unknown:event', {});
    socket.any?.('messaging:message', { sequence: 3 });
    await vi.waitFor(() => expect(handled).toEqual([['messaging:message', { sequence: 3 }]]), {
      timeout: 500,
    });
    close();
  });
});
