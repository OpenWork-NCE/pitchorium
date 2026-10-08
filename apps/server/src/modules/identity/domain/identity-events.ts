import type { Locale, SignInProvider } from '@pitchorium/contracts';
import { DomainEvent, type DomainEventProps } from '../../../platform/kernel';

export type RegistrationMethod = SignInProvider | 'magic_link';

export type PasswordChangeReason = 'changed' | 'reset';

export type SessionRevocationScope = 'one' | 'others' | 'all';

export type SessionRevocationReason =
  'user_request' | 'password_reset' | 'privilege_change' | 'suspension';

export class UserRegistered extends DomainEvent<{
  method: RegistrationMethod;
  locale: Locale;
  emailVerified: boolean;
}> {
  static readonly TYPE = 'identity.user.registered.v1';
  readonly type = UserRegistered.TYPE;
  readonly aggregateType = 'user';

  constructor(props: DomainEventProps<UserRegistered['payload']>) {
    super(props);
  }
}

export class EmailVerified extends DomainEvent<Record<string, never>> {
  static readonly TYPE = 'identity.user.email-verified.v1';
  readonly type = EmailVerified.TYPE;
  readonly aggregateType = 'user';

  constructor(props: DomainEventProps<EmailVerified['payload']>) {
    super(props);
  }
}

export class AccountLinked extends DomainEvent<{ provider: string }> {
  static readonly TYPE = 'identity.account.linked.v1';
  readonly type = AccountLinked.TYPE;
  readonly aggregateType = 'user';

  constructor(props: DomainEventProps<AccountLinked['payload']>) {
    super(props);
  }
}

export class AccountUnlinked extends DomainEvent<{ provider: string }> {
  static readonly TYPE = 'identity.account.unlinked.v1';
  readonly type = AccountUnlinked.TYPE;
  readonly aggregateType = 'user';

  constructor(props: DomainEventProps<AccountUnlinked['payload']>) {
    super(props);
  }
}

export class PasswordChanged extends DomainEvent<{ reason: PasswordChangeReason }> {
  static readonly TYPE = 'identity.user.password-changed.v1';
  readonly type = PasswordChanged.TYPE;
  readonly aggregateType = 'user';

  constructor(props: DomainEventProps<PasswordChanged['payload']>) {
    super(props);
  }
}

export class SessionsRevoked extends DomainEvent<{
  scope: SessionRevocationScope;
  reason: SessionRevocationReason;
}> {
  static readonly TYPE = 'identity.user.sessions-revoked.v1';
  readonly type = SessionsRevoked.TYPE;
  readonly aggregateType = 'user';

  constructor(props: DomainEventProps<SessionsRevoked['payload']>) {
    super(props);
  }
}

/** Prepared hook: the GDPR deletion itself is implemented by the privacy module later. */
export class AccountDeletionRequested extends DomainEvent<Record<string, never>> {
  static readonly TYPE = 'identity.user.deletion-requested.v1';
  readonly type = AccountDeletionRequested.TYPE;
  readonly aggregateType = 'user';

  constructor(props: DomainEventProps<AccountDeletionRequested['payload']>) {
    super(props);
  }
}
