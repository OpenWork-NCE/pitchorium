import { DomainEvent, type DomainEventProps } from '../../../platform/kernel';

abstract class ExportEvent<P extends DomainEvent['payload']> extends DomainEvent<P> {
  readonly aggregateType = 'data_export';
}

abstract class ErasureEvent<P extends DomainEvent['payload']> extends DomainEvent<P> {
  readonly aggregateType = 'erasure';
}

export class ExportRequested extends ExportEvent<{ userId: string }> {
  static readonly TYPE = 'privacy.export.requested.v1';
  readonly type = ExportRequested.TYPE;
  constructor(props: DomainEventProps<ExportRequested['payload']>) {
    super(props);
  }
}

export class ExportReady extends ExportEvent<{ userId: string; expiresAt: string }> {
  static readonly TYPE = 'privacy.export.ready.v1';
  readonly type = ExportReady.TYPE;
  constructor(props: DomainEventProps<ExportReady['payload']>) {
    super(props);
  }
}

export class ErasureRequested extends ErasureEvent<{ userId: string; scheduledFor: string }> {
  static readonly TYPE = 'privacy.erasure.requested.v1';
  readonly type = ErasureRequested.TYPE;
  constructor(props: DomainEventProps<ErasureRequested['payload']>) {
    super(props);
  }
}

export class ErasureCanceled extends ErasureEvent<{ userId: string }> {
  static readonly TYPE = 'privacy.erasure.canceled.v1';
  readonly type = ErasureCanceled.TYPE;
  constructor(props: DomainEventProps<ErasureCanceled['payload']>) {
    super(props);
  }
}

/** Internal: the erasure comes soon, the member is reminded (notifications). */
export class ErasureReminderDue extends ErasureEvent<{ userId: string; scheduledFor: string }> {
  static readonly TYPE = 'privacy.erasure.reminder-due.v1';
  readonly type = ErasureReminderDue.TYPE;
  constructor(props: DomainEventProps<ErasureReminderDue['payload']>) {
    super(props);
  }
}

/** The account is erased: no member identifier, the request itself is pseudonymized. */
export class ErasureExecuted extends ErasureEvent<{ modules: string[] }> {
  static readonly TYPE = 'privacy.erasure.executed.v1';
  readonly type = ErasureExecuted.TYPE;
  constructor(props: DomainEventProps<ErasureExecuted['payload']>) {
    super(props);
  }
}
