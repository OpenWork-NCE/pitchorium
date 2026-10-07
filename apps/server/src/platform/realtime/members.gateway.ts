import { Logger } from '@nestjs/common';
import { type OnGatewayConnection, WebSocketGateway } from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import { MEMBERS_NAMESPACE, userRoom } from './realtime-publisher';

/** Principal stored on the socket by the handshake guard of the access module. */
export interface SocketPrincipal {
  userId: string;
  sessionId: string;
}

export function socketPrincipal(socket: Socket): SocketPrincipal | null {
  return (socket.data as { principal?: SocketPrincipal }).principal ?? null;
}

/**
 * Members namespace: each authenticated socket joins the room of its member, which the
 * RealtimePublisher targets. Modules add their own events through gateways on this namespace.
 */
@WebSocketGateway({ namespace: MEMBERS_NAMESPACE })
export class MembersGateway implements OnGatewayConnection {
  private readonly logger = new Logger(MembersGateway.name);

  async handleConnection(socket: Socket): Promise<void> {
    const principal = socketPrincipal(socket);
    if (!principal) {
      this.logger.warn('Socket without principal on the members namespace');
      socket.disconnect(true);
      return;
    }
    await socket.join(userRoom(principal.userId));
  }
}
