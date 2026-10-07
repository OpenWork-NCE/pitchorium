import type { Socket } from 'socket.io';

/**
 * Extension point for WebSocket authentication. Every namespace runs this guard on the
 * handshake (see RedisIoAdapter). The default accepts anonymous connections; the access
 * module will provide an implementation that validates the session token.
 */
export abstract class RealtimeHandshakeGuard {
  abstract authorize(socket: Socket): Promise<boolean>;
}

export class AllowAnonymousHandshakeGuard extends RealtimeHandshakeGuard {
  authorize(): Promise<boolean> {
    return Promise.resolve(true);
  }
}
