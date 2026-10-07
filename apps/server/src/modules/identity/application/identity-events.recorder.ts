import { Injectable } from '@nestjs/common';
import {
  Clock,
  type DomainEvent,
  type DomainEventProps,
  IdGenerator,
} from '../../../platform/kernel';
import { OutboxService } from '../../../platform/outbox';
import {
  AccountDeletionRequested,
  AccountLinked,
  AccountUnlinked,
  EmailVerified,
  PasswordChanged,
  type PasswordChangeReason,
  type RegistrationMethod,
  SessionsRevoked,
  type SessionRevocationReason,
  type SessionRevocationScope,
  UserRegistered,
} from '../domain/identity-events';
import type { Locale } from '@pitchorium/contracts';

type EventClass<E extends DomainEvent> = new (props: DomainEventProps<E['payload']>) => E;

/** Records identity events in the outbox; callers must be inside a transaction. */
@Injectable()
export class IdentityEventsRecorder {
  constructor(
    private readonly outbox: OutboxService,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  userRegistered(
    userId: string,
    payload: { method: RegistrationMethod; locale: Locale; emailVerified: boolean },
  ): Promise<void> {
    return this.record(UserRegistered, userId, payload);
  }

  emailVerified(userId: string): Promise<void> {
    return this.record(EmailVerified, userId, {});
  }

  accountLinked(userId: string, provider: string): Promise<void> {
    return this.record(AccountLinked, userId, { provider });
  }

  accountUnlinked(userId: string, provider: string): Promise<void> {
    return this.record(AccountUnlinked, userId, { provider });
  }

  passwordChanged(userId: string, reason: PasswordChangeReason): Promise<void> {
    return this.record(PasswordChanged, userId, { reason });
  }

  sessionsRevoked(
    userId: string,
    scope: SessionRevocationScope,
    reason: SessionRevocationReason,
  ): Promise<void> {
    return this.record(SessionsRevoked, userId, { scope, reason });
  }

  accountDeletionRequested(userId: string): Promise<void> {
    return this.record(AccountDeletionRequested, userId, {});
  }

  private record<E extends DomainEvent>(
    Event: EventClass<E>,
    userId: string,
    payload: E['payload'],
  ): Promise<void> {
    return this.outbox.record(
      new Event({
        id: this.ids.next(),
        aggregateId: userId,
        occurredAt: this.clock.now(),
        payload,
      }),
    );
  }
}
