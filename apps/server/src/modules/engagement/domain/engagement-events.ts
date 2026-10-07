import { DomainEvent, type DomainEventProps } from '../../../platform/kernel';

/** Time entry events have the entry as aggregate; payloads hold ids and codes. */
abstract class TimeEntryEvent<P extends DomainEvent['payload']> extends DomainEvent<P> {
  readonly aggregateType = 'time_entry';
}

export class TimeEntryDeclared extends TimeEntryEvent<{
  contributorId: string;
  projectId: string | null;
  entrepreneurId: string | null;
  kind: string;
  minutes: number;
}> {
  static readonly TYPE = 'engagement.time-entry.declared.v1';
  readonly type = TimeEntryDeclared.TYPE;
  constructor(props: DomainEventProps<TimeEntryDeclared['payload']>) {
    super(props);
  }
}

export class TimeEntryConfirmed extends TimeEntryEvent<{ by: string; minutes: number }> {
  static readonly TYPE = 'engagement.time-entry.confirmed.v1';
  readonly type = TimeEntryConfirmed.TYPE;
  constructor(props: DomainEventProps<TimeEntryConfirmed['payload']>) {
    super(props);
  }
}

export class TimeEntryDisputed extends TimeEntryEvent<{ by: string }> {
  static readonly TYPE = 'engagement.time-entry.disputed.v1';
  readonly type = TimeEntryDisputed.TYPE;
  constructor(props: DomainEventProps<TimeEntryDisputed['payload']>) {
    super(props);
  }
}
