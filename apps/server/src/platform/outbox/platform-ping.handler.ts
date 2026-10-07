import { Injectable, Logger } from '@nestjs/common';
import { DomainEventHandler, type DomainEventSubscriber } from './domain-event-handler';
import type { OutboxEnvelope } from './outbox-envelope';

export const PLATFORM_PING_EVENT_TYPE = 'platform.ping.v1';

/** Technical handler used to check the outbox chain end to end (see scripts/emit-ping-event.mts). */
@Injectable()
@DomainEventHandler({ name: 'platform.ping-logger', eventTypes: [PLATFORM_PING_EVENT_TYPE] })
export class PlatformPingHandler implements DomainEventSubscriber {
  private readonly logger = new Logger(PlatformPingHandler.name);

  handle(event: OutboxEnvelope): Promise<void> {
    this.logger.log(`Relayed domain event ${event.type} ${event.id}`);
    return Promise.resolve();
  }
}
