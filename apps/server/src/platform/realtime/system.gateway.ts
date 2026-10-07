import { SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import { Clock } from '../kernel';

export const SYSTEM_NAMESPACE = '/system';

/** Technical namespace used to check the realtime chain: `ping` is answered with `pong`. */
@WebSocketGateway({ namespace: SYSTEM_NAMESPACE })
export class SystemGateway {
  constructor(private readonly clock: Clock) {}

  @SubscribeMessage('ping')
  ping(): { event: 'pong'; data: { at: string } } {
    return { event: 'pong', data: { at: this.clock.now().toISOString() } };
  }
}
