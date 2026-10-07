import { Injectable } from '@nestjs/common';
import type { LegalStatus, Locale } from '@pitchorium/contracts';
import { TransactionManager } from '../../../platform/database';
import type { SessionRevocationReason } from '../domain/identity-events';
import { ActiveLocalesService } from './active-locales.service';
import { IdentityEventsRecorder } from './identity-events.recorder';
import { type IdentityUser, IdentityUserRepository } from './identity-user.repository';
import { LegalService } from './legal.service';

/** Public facade of the identity module, for the other modules. */
@Injectable()
export class IdentityFacade {
  constructor(
    private readonly users: IdentityUserRepository,
    private readonly locales: ActiveLocalesService,
    private readonly legal: LegalService,
    private readonly events: IdentityEventsRecorder,
    private readonly transactions: TransactionManager,
  ) {}

  findUser(userId: string): Promise<IdentityUser | null> {
    return this.users.findById(userId);
  }

  findUserByEmail(email: string): Promise<IdentityUser | null> {
    return this.users.findByEmail(email.trim().toLowerCase());
  }

  activeLocales(): Promise<Locale[]> {
    return this.locales.list();
  }

  legalStatus(user: IdentityUser): LegalStatus {
    return this.legal.status(user);
  }

  /** Signs the user out everywhere, for example after a privilege change. */
  revokeAllSessions(userId: string, reason: SessionRevocationReason): Promise<void> {
    return this.transactions.run(async () => {
      if ((await this.users.deleteSessions(userId)) > 0) {
        await this.events.sessionsRevoked(userId, 'all', reason);
      }
    });
  }

  /**
   * Prepared hook for the GDPR deletion (privacy module): records the request as an event,
   * nothing is deleted yet.
   */
  requestAccountDeletion(userId: string): Promise<void> {
    return this.transactions.run(() => this.events.accountDeletionRequested(userId));
  }
}
