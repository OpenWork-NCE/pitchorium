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
  onAny() {
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

// After the mocks, which Vitest hoists above every import.
import { connect } from './realtime-connection';

afterEach(() => {
  sockets.length = 0;
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
});
