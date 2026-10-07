import { DomainEvent, type DomainEventProps } from '../../../platform/kernel';

/**
 * A notification was created, or grown by a grouped event (`created: false`). Internal: it
 * triggers the realtime push and the immediate email (ADR 0059).
 */
export class NotificationCreated extends DomainEvent<{
  recipientId: string;
  type: string;
  created: boolean;
}> {
  static readonly TYPE = 'notifications.notification.created.v1';
  readonly type = NotificationCreated.TYPE;
  readonly aggregateType = 'notification';
  constructor(props: DomainEventProps<NotificationCreated['payload']>) {
    super(props);
  }
}

/** An email left for a member: `notification`, `digest` or `unread_messages`. */
export class EmailSent extends DomainEvent<{ recipientId: string; kind: string; items: number }> {
  static readonly TYPE = 'notifications.email.sent.v1';
  readonly type = EmailSent.TYPE;
  readonly aggregateType = 'email';
  constructor(props: DomainEventProps<EmailSent['payload']>) {
    super(props);
  }
}

/** The email provider reported a permanent bounce: the address is suppressed (ADR 0062). */
export class EmailBounced extends DomainEvent<{
  recipientId: string | null;
  providerEventId: string;
}> {
  static readonly TYPE = 'notifications.email.bounced.v1';
  readonly type = EmailBounced.TYPE;
  readonly aggregateType = 'email';
  constructor(props: DomainEventProps<EmailBounced['payload']>) {
    super(props);
  }
}

/** The recipient marked an email as spam: the address is suppressed (ADR 0062). */
export class EmailComplained extends DomainEvent<{
  recipientId: string | null;
  providerEventId: string;
}> {
  static readonly TYPE = 'notifications.email.complained.v1';
  readonly type = EmailComplained.TYPE;
  readonly aggregateType = 'email';
  constructor(props: DomainEventProps<EmailComplained['payload']>) {
    super(props);
  }
}
