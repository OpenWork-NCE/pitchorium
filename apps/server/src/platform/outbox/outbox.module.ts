import { Global, Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { QueueModule } from '../queue';
import { DomainEventDispatcher } from './domain-event-dispatcher';
import { DomainEventsProcessor } from './domain-events.processor';
import { OutboxRelayService } from './outbox-relay.service';
import { OutboxService } from './outbox.service';
import { PlatformPingHandler } from './platform-ping.handler';

/** Recording side, available in both processes. */
@Global()
@Module({ providers: [OutboxService], exports: [OutboxService] })
export class OutboxModule {}

/** Publishing and consuming side, worker only. */
@Module({
  imports: [DiscoveryModule, QueueModule],
  providers: [
    OutboxRelayService,
    DomainEventDispatcher,
    DomainEventsProcessor,
    PlatformPingHandler,
  ],
  exports: [DomainEventDispatcher, OutboxRelayService],
})
export class OutboxRelayModule {}
