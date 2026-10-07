import { DiscoveryService } from '@nestjs/core';
import type { OutboxEnvelope } from './outbox-envelope';

export interface DomainEventHandlerOptions {
  /** Stable identifier used to deduplicate deliveries. Renaming it replays past events. */
  name: string;
  eventTypes: readonly string[];
}

/** Marks a provider as a handler of domain events relayed from the outbox (worker only). */
export const DomainEventHandler = DiscoveryService.createDecorator<DomainEventHandlerOptions>();

export interface DomainEventSubscriber {
  handle(event: OutboxEnvelope): Promise<void>;
}
