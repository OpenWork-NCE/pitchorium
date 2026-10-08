import { Injectable, type OnModuleInit } from '@nestjs/common';
import type { Locale } from '@pitchorium/contracts';
import { asc, eq, or, sql } from '@pitchorium/db/orm';
import {
  identityAccounts,
  identityLegalAcceptances,
  identitySessions,
  identityUsers,
  identityVerifications,
} from '@pitchorium/db/schemas/identity';
import { replaceIdentifier } from '../../../platform/compliance';
import { TransactionManager } from '../../../platform/database';
import { ERASURE_ORDER, PrivacyFacade } from '../../privacy';

/**
 * Personal data of identity (GDPR): the account, its sign-in methods (never a secret or a
 * token), its sessions and its legal acceptances. The erasure deletes the account last;
 * the acceptances are kept as proof under the pseudonym (ADR 0075).
 */
@Injectable()
export class IdentityPersonalData implements OnModuleInit {
  constructor(
    private readonly privacy: PrivacyFacade,
    private readonly transactions: TransactionManager,
  ) {}

  private get db() {
    return this.transactions.executor;
  }

  onModuleInit(): void {
    this.privacy.registerAccountDirectory({
      contact: async (userId) => {
        const [user] = await this.db
          .select({
            email: identityUsers.email,
            name: identityUsers.name,
            locale: identityUsers.locale,
          })
          .from(identityUsers)
          .where(eq(identityUsers.id, userId));
        return user ? { email: user.email, name: user.name, locale: user.locale as Locale } : null;
      },
    });
    this.privacy.registerPersonalData({
      module: 'identity',
      description:
        'Your account (name, email, language, time zone), your sign-in methods, your sessions with their device and address, and your acceptances of the terms.',
      order: ERASURE_ORDER.account,
      exporter: { export: (userId) => this.export(userId) },
      eraser: {
        erase: async ({ userId, email, pseudonym }) => {
          await replaceIdentifier(
            this.db,
            [{ table: 'identity.legal_acceptances', column: 'user_id' }],
            userId,
            pseudonym,
          );
          // Verification and magic link tokens name the address or the account.
          await this.db
            .delete(identityVerifications)
            .where(
              or(
                sql`strpos(lower(${identityVerifications.identifier}), ${email.toLowerCase()}) > 0`,
                sql`strpos(${identityVerifications.identifier}, ${userId}) > 0`,
                sql`strpos(${identityVerifications.value}, ${userId}) > 0`,
                sql`strpos(lower(${identityVerifications.value}), ${email.toLowerCase()}) > 0`,
              ),
            );
          // Sessions, accounts and second factors follow by cascade.
          await this.db.delete(identityUsers).where(eq(identityUsers.id, userId));
        },
      },
    });
  }

  private async export(userId: string) {
    const [user] = await this.db.select().from(identityUsers).where(eq(identityUsers.id, userId));
    const accounts = await this.db
      .select({
        providerId: identityAccounts.providerId,
        createdAt: identityAccounts.createdAt,
        updatedAt: identityAccounts.updatedAt,
      })
      .from(identityAccounts)
      .where(eq(identityAccounts.userId, userId));
    const sessions = await this.db
      .select({
        createdAt: identitySessions.createdAt,
        expiresAt: identitySessions.expiresAt,
        ipAddress: identitySessions.ipAddress,
        userAgent: identitySessions.userAgent,
      })
      .from(identitySessions)
      .where(eq(identitySessions.userId, userId));
    const acceptances = await this.db
      .select({
        document: identityLegalAcceptances.document,
        version: identityLegalAcceptances.version,
        acceptedAt: identityLegalAcceptances.acceptedAt,
      })
      .from(identityLegalAcceptances)
      .where(eq(identityLegalAcceptances.userId, userId))
      .orderBy(asc(identityLegalAcceptances.acceptedAt));
    return {
      data: {
        account: user ?? null,
        signInMethods: accounts,
        sessions,
        legalAcceptances: acceptances,
      },
    };
  }
}
