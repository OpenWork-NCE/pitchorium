import { DomainEvent, type DomainEventProps } from '../../../platform/kernel';

/** Every event of the module has the event as aggregate; payloads hold ids and codes. */
abstract class EventAggregateEvent<P extends DomainEvent['payload']> extends DomainEvent<P> {
  readonly aggregateType = 'event';
}

export class EventCreated extends EventAggregateEvent<{
  organizerId: string;
  organizationId: string | null;
  projectId: string | null;
}> {
  static readonly TYPE = 'events.event.created.v1';
  readonly type = EventCreated.TYPE;
  constructor(props: DomainEventProps<EventCreated['payload']>) {
    super(props);
  }
}

export class EventPublished extends EventAggregateEvent<{
  organizerId: string;
  organizationId: string | null;
  startsAt: string;
}> {
  static readonly TYPE = 'events.event.published.v1';
  readonly type = EventPublished.TYPE;
  constructor(props: DomainEventProps<EventPublished['payload']>) {
    super(props);
  }
}

/** Lists the changed field names, never their values. */
export class EventUpdated extends EventAggregateEvent<{ fields: string[] }> {
  static readonly TYPE = 'events.event.updated.v1';
  readonly type = EventUpdated.TYPE;
  constructor(props: DomainEventProps<EventUpdated['payload']>) {
    super(props);
  }
}

export class EventCanceled extends EventAggregateEvent<{ by: string }> {
  static readonly TYPE = 'events.event.canceled.v1';
  readonly type = EventCanceled.TYPE;
  constructor(props: DomainEventProps<EventCanceled['payload']>) {
    super(props);
  }
}

/** The end has passed (scheduled task). */
export class EventCompleted extends EventAggregateEvent<Record<string, never>> {
  static readonly TYPE = 'events.event.completed.v1';
  readonly type = EventCompleted.TYPE;
  constructor(props: DomainEventProps<EventCompleted['payload']>) {
    super(props);
  }
}

/** A member registered: a seat (`registered`) or the waiting list (`waitlisted`). */
export class RegistrationCreated extends EventAggregateEvent<{ userId: string; status: string }> {
  static readonly TYPE = 'events.registration.created.v1';
  readonly type = RegistrationCreated.TYPE;
  constructor(props: DomainEventProps<RegistrationCreated['payload']>) {
    super(props);
  }
}

/** A member withdrew from a seat or from the waiting list. */
export class RegistrationCanceled extends EventAggregateEvent<{ userId: string; status: string }> {
  static readonly TYPE = 'events.registration.canceled.v1';
  readonly type = RegistrationCanceled.TYPE;
  constructor(props: DomainEventProps<RegistrationCanceled['payload']>) {
    super(props);
  }
}

/** A freed seat went to this member of the waiting list. */
export class RegistrationPromoted extends EventAggregateEvent<{ userId: string }> {
  static readonly TYPE = 'events.registration.promoted.v1';
  readonly type = RegistrationPromoted.TYPE;
  constructor(props: DomainEventProps<RegistrationPromoted['payload']>) {
    super(props);
  }
}
