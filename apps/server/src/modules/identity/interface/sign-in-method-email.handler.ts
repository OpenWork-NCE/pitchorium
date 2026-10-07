import { Injectable } from '@nestjs/common';
import type { SignInMethodChange } from '@pitchorium/emails';
import {
  DomainEventHandler,
  type DomainEventSubscriber,
  type OutboxEnvelope,
} from '../../../platform/outbox';
import { IdentityUserRepository } from '../application/identity-user.repository';
import { AccountLinked, AccountUnlinked, PasswordChanged } from '../domain/identity-events';
import { IdentityMailer } from '../infrastructure/identity-mailer';

/** Warns the user by email of every change of sign-in method (worker). */
@Injectable()
@DomainEventHandler({
  name: 'identity.sign-in-method-email',
  eventTypes: [AccountLinked.TYPE, AccountUnlinked.TYPE, PasswordChanged.TYPE],
})
export class SignInMethodEmailHandler implements DomainEventSubscriber {
  constructor(
    private readonly users: IdentityUserRepository,
    private readonly mailer: IdentityMailer,
  ) {}

  async handle(event: OutboxEnvelope): Promise<void> {
    const user = await this.users.findById(event.aggregateId);
    if (!user) return;
    const { change, provider } = this.describe(event);
    await this.mailer.sendSignInMethodChanged(
      { email: user.email, name: user.name, locale: user.locale },
      change,
      provider,
      new Date(event.occurredAt),
    );
  }

  private describe(event: OutboxEnvelope): { change: SignInMethodChange; provider: string } {
    const provider = typeof event.payload['provider'] === 'string' ? event.payload['provider'] : '';
    switch (event.type) {
      case AccountLinked.TYPE:
        return { change: 'linked', provider };
      case AccountUnlinked.TYPE:
        return { change: 'unlinked', provider };
      default:
        return {
          change: event.payload['reason'] === 'reset' ? 'password_reset' : 'password_changed',
          provider: 'credential',
        };
    }
  }
}
