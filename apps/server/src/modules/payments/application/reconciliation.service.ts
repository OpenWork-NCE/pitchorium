import { Inject, Injectable, Logger } from '@nestjs/common';
import type { DiscrepancyKind } from '@pitchorium/contracts';
import { uuidV7Schema } from '@pitchorium/contracts';
import { COMMON_CONFIG, type CommonConfig } from '../../../platform/config';
import { Clock, IdGenerator } from '../../../platform/kernel';
import { ProjectsFacade } from '../../projects';
import type { ContributionRecord } from '../domain/contribution';
import { wasPaid } from '../domain/contribution';
import { EUR } from '../domain/fx';
import { LEDGER_ACCOUNTS } from '../domain/ledger';
import { ContributionEffectsService } from './contribution-effects.service';
import { PaymentProviders, PaymentsRepository, type ProviderTransaction } from './ports';

const DAY_MS = 86_400_000;

export interface ReconciliationReport {
  runId: string;
  checkedTransactions: number;
  discrepancies: { kind: DiscrepancyKind; reference: string }[];
}

/**
 * Daily reconciliation (ADR 0048): the transactions listed by each provider against the
 * contributions, each paid contribution against its ledger lines, the ledger balance, and the
 * collected amount of every project against its EUR memo account. A discrepancy is recorded,
 * logged as an error and counted, never corrected automatically.
 */
@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(
    private readonly payments: PaymentsRepository,
    private readonly providers: PaymentProviders,
    private readonly projects: ProjectsFacade,
    private readonly effects: ContributionEffectsService,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    @Inject(COMMON_CONFIG) private readonly config: CommonConfig,
  ) {}

  async run(lookbackMs = 3 * DAY_MS): Promise<ReconciliationReport> {
    const periodEnd = this.clock.now();
    const periodStart = new Date(periodEnd.getTime() - lookbackMs);
    const runId = this.ids.next();
    await this.payments.insertReconciliationRun({
      id: runId,
      periodStart,
      periodEnd,
      startedAt: periodEnd,
    });
    const found: ReconciliationReport['discrepancies'] = [];
    const report = async (
      kind: DiscrepancyKind,
      subject: { id: string | null; projectId: string | null; provider: string | null },
      reference: string,
      expected: string | null,
      actual: string | null,
    ) => {
      found.push({ kind, reference });
      await this.effects.discrepancy(
        kind,
        { contributionId: subject.id, projectId: subject.projectId, provider: subject.provider },
        { reference, expected, actual },
        runId,
      );
    };
    let checked = 0;
    const contributions = await this.payments.contributionsCreatedBetween(periodStart, periodEnd);
    for (const provider of this.providers.enabled()) {
      const accounts = (await this.payments.payoutAccountsOf(provider)).map(
        (account) => account.providerAccountId,
      );
      const transactions = await this.providers
        .payment(provider)
        .listTransactions(accounts, periodStart, periodEnd);
      checked += transactions.length;
      const seen = new Set<string>();
      for (const transaction of transactions) {
        const contribution = await this.contributionOf(provider, transaction);
        if (!contribution) {
          if (transaction.status === 'succeeded') {
            await report(
              'missing_contribution',
              { id: null, projectId: null, provider },
              transaction.providerPaymentId,
              null,
              `${transaction.amount.amountMinor} ${transaction.amount.currency}`,
            );
          }
          continue;
        }
        seen.add(contribution.id);
        await this.compare(contribution, transaction, report);
      }
      for (const contribution of contributions) {
        if (contribution.provider !== provider || !wasPaid(contribution.status)) continue;
        if (seen.has(contribution.id)) continue;
        await report(
          'missing_provider_transaction',
          contribution,
          contribution.providerPaymentId ?? contribution.id,
          `${contribution.amountMinor} ${contribution.currency}`,
          null,
        );
      }
    }
    for (const contribution of contributions) {
      if (!wasPaid(contribution.status)) continue;
      const paid = await this.payments.ledgerSum(LEDGER_ACCOUNTS.contributorFunds, {
        contributionId: contribution.id,
      });
      const refunded = await this.payments.ledgerSum(LEDGER_ACCOUNTS.refunds, {
        contributionId: contribution.id,
      });
      const paidMinor = -(paid.get(contribution.currency) ?? 0n);
      const refundedMinor = refunded.get(contribution.currency) ?? 0n;
      if (paidMinor !== contribution.amountMinor || refundedMinor !== contribution.refundedMinor) {
        await report(
          'ledger_mismatch',
          contribution,
          contribution.id,
          `paid ${contribution.amountMinor}, refunded ${contribution.refundedMinor}`,
          `paid ${paidMinor}, refunded ${refundedMinor}`,
        );
      }
    }
    for (const [currency, sum] of await this.payments.ledgerBalances()) {
      if (sum !== 0n) {
        await report(
          'ledger_unbalanced',
          { id: null, projectId: null, provider: null },
          currency,
          '0',
          sum.toString(),
        );
      }
    }
    for (const projectId of await this.payments.fundedProjectIds()) {
      const snapshot = await this.projects.fundingSnapshot(projectId);
      const ledger =
        (await this.payments.ledgerSum(LEDGER_ACCOUNTS.projectFunding, { projectId })).get(EUR) ??
        0n;
      const collected = snapshot?.collected.amountMinor ?? 0n;
      if (collected !== ledger) {
        await report(
          'project_total_mismatch',
          { id: null, projectId, provider: null },
          projectId,
          ledger.toString(),
          collected.toString(),
        );
      }
    }
    await this.payments.finishReconciliationRun(runId, this.clock.now(), checked, found.length);
    if (found.length === 0) this.logger.log(`Reconciliation ${runId}: no discrepancy`);
    return { runId, checkedTransactions: checked, discrepancies: found };
  }

  get defaultLookbackMs(): number {
    return 3 * DAY_MS + this.config.payments.sessionTtlMs;
  }

  private async contributionOf(
    provider: ContributionRecord['provider'],
    transaction: ProviderTransaction,
  ): Promise<ContributionRecord | null> {
    if (transaction.reference && uuidV7Schema.safeParse(transaction.reference).success) {
      const found = await this.payments.findContribution(transaction.reference);
      if (found) return found;
    }
    return transaction.providerPaymentId
      ? this.payments.findContributionByPayment(provider, transaction.providerPaymentId)
      : null;
  }

  private async compare(
    contribution: ContributionRecord,
    transaction: ProviderTransaction,
    report: (
      kind: DiscrepancyKind,
      subject: { id: string | null; projectId: string | null; provider: string | null },
      reference: string,
      expected: string | null,
      actual: string | null,
    ) => Promise<void>,
  ): Promise<void> {
    const reference = transaction.providerPaymentId || contribution.id;
    const paid = wasPaid(contribution.status);
    if ((transaction.status === 'succeeded') !== paid && transaction.status !== 'pending') {
      await report(
        'status_mismatch',
        contribution,
        reference,
        contribution.status,
        transaction.status,
      );
      return;
    }
    if (
      transaction.amount.currency !== contribution.currency ||
      transaction.amount.amountMinor !== contribution.amountMinor
    ) {
      await report(
        'amount_mismatch',
        contribution,
        reference,
        `${contribution.amountMinor} ${contribution.currency}`,
        `${transaction.amount.amountMinor} ${transaction.amount.currency}`,
      );
    }
    if (transaction.refunded && transaction.refunded.amountMinor !== contribution.refundedMinor) {
      await report(
        'refund_mismatch',
        contribution,
        reference,
        contribution.refundedMinor.toString(),
        transaction.refunded.amountMinor.toString(),
      );
    }
  }
}
