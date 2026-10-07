import { Injectable } from '@nestjs/common';
import type { Socket } from 'socket.io';
import { TrustedOrigins } from '../../../platform/http';
import {
  RealtimeHandshakeGuard,
  type SocketPrincipal,
  SYSTEM_NAMESPACE,
} from '../../../platform/realtime';
import { SessionAuthenticator } from '../../identity';

/** Namespaces open to anonymous connections; every other namespace is for members. */
const PUBLIC_NAMESPACES: ReadonlySet<string> = new Set([SYSTEM_NAMESPACE]);

/**
 * Socket.IO handshake authentication: the session cookie must be valid and the Origin trusted
 * (cross-site WebSocket hijacking). The principal is stored in `socket.data.principal`.
 */
@Injectable()
export class SessionHandshakeGuard extends RealtimeHandshakeGuard {
  constructor(
    private readonly sessions: SessionAuthenticator,
    private readonly origins: TrustedOrigins,
  ) {
    super();
  }

  async authorize(socket: Socket): Promise<boolean> {
    if (PUBLIC_NAMESPACES.has(socket.nsp.name)) return true;
    const { headers } = socket.handshake;
    if (!this.origins.allows(headers)) return false;
    const session = await this.sessions.authenticate(headers);
    if (!session) return false;
    (socket.data as { principal?: SocketPrincipal }).principal = {
      userId: session.user.id,
      sessionId: session.sessionId,
    };
    return true;
  }
}
