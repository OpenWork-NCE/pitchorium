import { DomainEvent, type DomainEventProps } from '../../../platform/kernel';

/**
 * Notifications of one source event created, or grown by a grouped event, for a batch of
 * recipients (at most NOTIFICATIONS_FANOUT_BATCH_SIZE). Internal: one delivery job pushes them
 * and sends their immediate emails together (ADR 0064).
 */
export class NotificationBatchCreated extends DomainEvent<{
  type: string;
  created: string[];
  grown: string[];
}> {
  static readonly TYPE = 'notifications.batch.created.v1';
  readonly type = NotificationBatchCreated.TYPE;
  readonly aggregateType = 'notification_batch';
  constructor(props: DomainEventProps<NotificationBatchCreated['payload']>) {
    super(props);
  }
}

/**
 * Emails of one kind left together: `notification` (a batch of immediate emails), `digest` or
 * `unread_messages` (one recipient). Version 2 groups the recipients of a batch (ADR 0064).
 */
export class EmailSent extends DomainEvent<{
  kind: string;
  recipientIds: string[];
  items: number;
}> {
  static readonly TYPE = 'notifications.email.sent.v2';
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
