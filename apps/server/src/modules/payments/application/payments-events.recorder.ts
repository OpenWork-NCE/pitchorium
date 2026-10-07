import { Injectable } from '@nestjs/common';
import {
  Clock,
  type DomainEvent,
  type DomainEventProps,
  IdGenerator,
} from '../../../platform/kernel';
import { OutboxService } from '../../../platform/outbox';

type EventClass<E extends DomainEvent> = new (props: DomainEventProps<E['payload']>) => E;

/** Records payments events in the outbox; callers must be inside a transaction. */
@Injectable()
export class PaymentsEventsRecorder {
  constructor(
    private readonly outbox: OutboxService,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  record<E extends DomainEvent>(
    Event: EventClass<E>,
    aggregateId: string,
    payload: E['payload'],
  ): Promise<void> {
    return this.outbox.record(
      new Event({ id: this.ids.next(), aggregateId, occurredAt: this.clock.now(), payload }),
    );
  }
}
