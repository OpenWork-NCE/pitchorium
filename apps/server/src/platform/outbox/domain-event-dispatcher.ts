import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { InboxService } from '../inbox';
import { DomainEventHandler, type DomainEventSubscriber } from './domain-event-handler';
import type { OutboxEnvelope } from './outbox-envelope';

interface RegisteredHandler {
  name: string;
  instance: DomainEventSubscriber;
}

/**
 * Registry of domain event handlers. Each (handler, event) pair runs at most once thanks to the
 * inbox, so a job retried after a partial failure only re-runs the handlers that failed.
 */
@Injectable()
export class DomainEventDispatcher implements OnModuleInit {
  private readonly logger = new Logger(DomainEventDispatcher.name);
  private readonly handlers = new Map<string, RegisteredHandler[]>();

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly inbox: InboxService,
  ) {}

  onModuleInit(): void {
    const names = new Set<string>();
    for (const wrapper of this.discovery.getProviders({ metadataKey: DomainEventHandler.KEY })) {
      const options = this.discovery.getMetadataByDecorator(DomainEventHandler, wrapper);
      if (!options) continue;
      if (names.has(options.name)) {
        throw new Error(`Duplicate domain event handler name: ${options.name}`);
      }
      names.add(options.name);
      this.register(options.name, options.eventTypes, wrapper.instance as DomainEventSubscriber);
    }
  }

  register(name: string, eventTypes: readonly string[], instance: DomainEventSubscriber): void {
    for (const type of eventTypes) {
      const list = this.handlers.get(type) ?? [];
      list.push({ name, instance });
      this.handlers.set(type, list);
    }
  }

  handlersFor(type: string): readonly string[] {
    return (this.handlers.get(type) ?? []).map((handler) => handler.name);
  }

  async dispatch(event: OutboxEnvelope): Promise<void> {
    const handlers = this.handlers.get(event.type) ?? [];
    if (handlers.length === 0) {
      this.logger.debug(`No handler for ${event.type} (${event.id})`);
      return;
    }
    for (const handler of handlers) {
      await this.inbox.process(`outbox:${handler.name}`, event.id, () =>
        handler.instance.handle(event),
      );
    }
  }
}
