import { Injectable, type OnModuleInit } from '@nestjs/common';
import { eq, or } from '@pitchorium/db/orm';
import {
  paymentsContributions,
  paymentsKycSubmissions,
  paymentsOfflineContributions,
  paymentsPayoutAccounts,
} from '@pitchorium/db/schemas/payments';
import { replaceIdentifier } from '../../../platform/compliance';
import { TransactionManager } from '../../../platform/database';
import { ERASURE_ORDER, PrivacyFacade } from '../../privacy';

/**
 * Personal data of payments: contributions, payout account, KYC, off-platform contributions.
 * Kept for the legal obligations (accounting, anti-money laundering; their length is a legal
 * question): the identity is replaced by the irreversible pseudonym, amounts are untouched,
 * the KYC documents stay under it (MediaRetentionRegistry, ADR 0075).
 */
@Injectable()
export class PaymentsPersonalData implements OnModuleInit {
  constructor(
    private readonly privacy: PrivacyFacade,
    private readonly transactions: TransactionManager,
  ) {}

  private get db() {
    return this.transactions.executor;
  }

  onModuleInit(): void {
    this.privacy.registerPersonalData({
      module: 'payments',
      description:
        'Your contributions (amounts, currency, method, commission, state), your payout account and identity verifications as a holder, and your off-platform contributions.',
      order: ERASURE_ORDER.financial,
      exporter: {
        export: async (userId) => ({
          data: {
            contributions: await this.db
              .select()
              .from(paymentsContributions)
              .where(eq(paymentsContributions.contributorId, userId)),
            receivedAsHolder: await this.db
              .select({
                id: paymentsContributions.id,
                projectId: paymentsContributions.projectId,
                amountMinor: paymentsContributions.amountMinor,
                currency: paymentsContributions.currency,
                status: paymentsContributions.status,
                succeededAt: paymentsContributions.succeededAt,
              })
              .from(paymentsContributions)
              .where(eq(paymentsContributions.holderId, userId)),
            payoutAccount: await this.db
              .select({
                provider: paymentsPayoutAccounts.provider,
                country: paymentsPayoutAccounts.country,
                currency: paymentsPayoutAccounts.currency,
                status: paymentsPayoutAccounts.status,
                createdAt: paymentsPayoutAccounts.createdAt,
              })
              .from(paymentsPayoutAccounts)
              .where(eq(paymentsPayoutAccounts.userId, userId)),
            kycSubmissions: await this.db
              .select({
                status: paymentsKycSubmissions.status,
                submittedAt: paymentsKycSubmissions.submittedAt,
                decidedAt: paymentsKycSubmissions.decidedAt,
                decisionReason: paymentsKycSubmissions.decisionReason,
              })
              .from(paymentsKycSubmissions)
              .where(eq(paymentsKycSubmissions.userId, userId)),
            offlineContributions: await this.db
              .select()
              .from(paymentsOfflineContributions)
              .where(
                or(
                  eq(paymentsOfflineContributions.contributorId, userId),
                  eq(paymentsOfflineContributions.declarerId, userId),
                ),
              ),
          },
        }),
      },
      eraser: {
        erase: ({ userId, pseudonym }) =>
          replaceIdentifier(
            this.db,
            [
              { table: 'payments.contributions', column: 'contributor_id' },
              { table: 'payments.contributions', column: 'holder_id' },
              { table: 'payments.payout_accounts', column: 'user_id' },
              { table: 'payments.kyc_submissions', column: 'user_id' },
              { table: 'payments.kyc_submissions', column: 'decided_by' },
              { table: 'payments.offline_contributions', column: 'contributor_id' },
              { table: 'payments.offline_contributions', column: 'declarer_id' },
              { table: 'payments.offline_contributions', column: 'confirmed_by' },
              { table: 'payments.offline_contributions', column: 'decided_by' },
              { table: 'payments.refunds', column: 'requested_by' },
              { table: 'payments.discrepancies', column: 'resolved_by' },
              { table: 'payments.simulated_accounts', column: 'user_id' },
            ],
            userId,
            pseudonym,
          ),
      },
    });
  }
}
