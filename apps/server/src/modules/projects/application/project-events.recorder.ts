import { Injectable } from '@nestjs/common';
import {
  Clock,
  type DomainEvent,
  type DomainEventProps,
  IdGenerator,
} from '../../../platform/kernel';
import { OutboxService } from '../../../platform/outbox';

type EventClass<E extends DomainEvent> = new (props: DomainEventProps<E['payload']>) => E;

/** Records project events in the outbox; callers must be inside a transaction. */
@Injectable()
export class ProjectEventsRecorder {
  constructor(
    private readonly outbox: OutboxService,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  record<E extends DomainEvent>(
    Event: EventClass<E>,
    projectId: string,
    payload: E['payload'],
  ): Promise<void> {
    return this.outbox.record(
      new Event({
        id: this.ids.next(),
        aggregateId: projectId,
        occurredAt: this.clock.now(),
        payload,
      }),
    );
  }
}
