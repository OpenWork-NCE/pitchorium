import { Injectable, Logger } from '@nestjs/common';
import { type DiscrepancyKind, uuidV7Schema } from '@pitchorium/contracts';
import { TransactionManager } from '../../../platform/database';
import { Clock, IdGenerator, Money } from '../../../platform/kernel';
import { Metrics } from '../../../platform/observability';
import { ProjectsFacade } from '../../projects';
import { commissionRefundFor, eurPartFor } from '../domain/commission';
import {
  assertTransition,
  type ContributionRecord,
  paymentMismatch,
  type ProviderDispute,
  type ProviderRefund,
  type ProviderSnapshot,
  remainingMinor,
  wasPaid,
} from '../domain/contribution';
import { EUR } from '../domain/fx';
import {
  disputeLost,
  disputeOpened,
  disputeWon,
  type LedgerEntryDraft,
  paymentSucceeded,
  providerFeeRecorded,
  refundSucceeded,
} from '../domain/ledger';
import {
  ContributionCanceled,
  ContributionDisputed,
  ContributionDisputeResolved,
  ContributionExpired,
  ContributionFailed,
  ContributionRefunded,
  ContributionSucceeded,
  DiscrepancyDetected,
} from '../domain/payments-events';
import { PaymentsEventsRecorder } from './payments-events.recorder';
import type { ProviderId } from '../domain/capability-matrix';
import {
  PaymentProviders,
  type ProviderPaymentRef,
  PaymentsRepository,
  type RefundRecord,
} from './ports';

export const DISCREPANCY_METRIC = 'pitchorium.payments.reconciliation.discrepancy';

export interface DiscrepancySubject {
  contributionId: string | null;
  projectId: string | null;
  provider: string | null;
}

/**
 * Applies what a provider reports of a contribution (read through its API) in one short
 * transaction under the lock of the contribution: success, failure, expiry, refunds and disputes,
 * each once, in that order whatever the order of the notifications. Each step writes its ledger
 * entry, its effect on the project (projects facade) and its event; a reported payment that does
 * not match the contribution is never applied: it becomes a discrepancy (ADR 0048).
 */
@Injectable()
export class ContributionEffectsService {
  private readonly logger = new Logger(ContributionEffectsService.name);

  constructor(
    private readonly payments: PaymentsRepository,
    private readonly providers: PaymentProviders,
    private readonly projects: ProjectsFacade,
    private readonly events: PaymentsEventsRecorder,
    private readonly transactions: TransactionManager,
    private readonly metrics: Metrics,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  /**
   * Reads the provider (outside any transaction, ADR 0019), then applies. The payment named by
   * a verified notification is read when the contribution does not know it yet.
   */
  async sync(
    contributionId: string,
    providerPaymentId: string | null = null,
  ): Promise<ContributionRecord | null> {
    const found = await this.payments.findContribution(contributionId);
    if (!found?.providerSessionId) return found;
    const contribution =
      found.providerPaymentId === null && providerPaymentId !== null
        ? { ...found, providerPaymentId }
        : found;
    const provider = this.providers.payment(contribution.provider);
    const snapshot = await provider.retrieve(contribution);
    const known = new Set(snapshot.refunds.map((refund) => refund.providerRefundId));
    const pending = (await this.payments.refundsOf(contributionId)).filter(
      (refund) =>
        refund.status === 'pending' &&
        refund.providerRefundId !== null &&
        !known.has(refund.providerRefundId),
    );
    const refreshed: ProviderRefund[] = [];
    for (const refund of pending) {
      const result = await provider.refreshRefund(contribution, refund.providerRefundId ?? '');
      refreshed.push({
        providerRefundId: result.providerRefundId,
        amount: Money.of(refund.amountMinor, refund.currency),
        status: result.status,
      });
    }
    return this.apply(contributionId, {
      ...snapshot,
      refunds: [...snapshot.refunds, ...refreshed],
    });
  }

  /**
   * A notification that names the payment only by its provider reference (Flutterwave
   * chargeback): the provider gives the payment, which is then synced like any other.
   */
  async syncByReference(
    provider: ProviderId,
    paymentReference: string,
  ): Promise<ContributionRecord | null> {
    const payment = await this.providers.payment(provider).paymentOf?.(paymentReference);
    const contribution = payment ? await this.contributionOf(provider, payment) : null;
    if (!payment || !contribution) {
      this.logger.warn(`No contribution for the ${provider} payment ${paymentReference}`);
      return null;
    }
    return this.sync(contribution.id, payment.providerPaymentId);
  }

  /** The contribution of a payment: by our reference first, then by the payment identifier. */
  async contributionOf(
    provider: ProviderId,
    payment: ProviderPaymentRef,
  ): Promise<ContributionRecord | null> {
    if (payment.reference && uuidV7Schema.safeParse(payment.reference).success) {
      const found = await this.payments.findContribution(payment.reference);
      if (found) return found;
    }
    return payment.providerPaymentId
      ? this.payments.findContributionByPayment(provider, payment.providerPaymentId)
      : null;
  }

  apply(contributionId: string, snapshot: ProviderSnapshot): Promise<ContributionRecord | null> {
    return this.transactions.run(async () => {
      let contribution = await this.payments.lockContribution(contributionId);
      if (!contribution) return null;
      if (snapshot.paymentId && !contribution.providerPaymentId) {
        await this.payments.updateContribution(contributionId, {
          providerPaymentId: snapshot.paymentId,
          updatedAt: this.clock.now(),
        });
        contribution = { ...contribution, providerPaymentId: snapshot.paymentId };
      }
      contribution = await this.applyPaymentStatus(contribution, snapshot);
      if (!wasPaid(contribution.status)) return contribution;
      contribution = await this.applyFee(contribution, snapshot);
      for (const refund of snapshot.refunds) {
        contribution = await this.applyProviderRefund(contribution, refund);
      }
      for (const dispute of snapshot.disputes) {
        contribution = await this.applyDispute(contribution, dispute);
      }
      return contribution;
    });
  }

  /** Ends a pending contribution without payment (failure, expiry, cancellation). */
  async end(
    contribution: ContributionRecord,
    status: 'failed' | 'expired' | 'canceled',
    reason: string,
  ): Promise<ContributionRecord> {
    assertTransition(contribution.status, status);
    const now = this.clock.now();
    let rewardState = contribution.rewardState;
    if (rewardState === 'reserved') {
      await this.projects.release(contribution.id);
      rewardState = 'released';
    }
    const ended = { ...contribution, status, rewardState, endedAt: now, updatedAt: now };
    await this.payments.updateContribution(contribution.id, {
      status,
      rewardState,
      endedAt: now,
      updatedAt: now,
      paymentUrl: null,
    });
    const payload = { projectId: contribution.projectId };
    if (status === 'failed') {
      await this.events.record(ContributionFailed, contribution.id, { ...payload, reason });
    } else if (status === 'expired') {
      await this.events.record(ContributionExpired, contribution.id, payload);
    } else {
      await this.events.record(ContributionCanceled, contribution.id, payload);
    }
    return ended;
  }

  /**
   * A refund the provider confirmed: the commission is refunded in proportion, the project no
   * longer collects the EUR part, the reward unit is released when everything is refunded.
   */
  async applyRefund(
    contribution: ContributionRecord,
    refund: RefundRecord,
  ): Promise<ContributionRecord> {
    if (refund.status === 'succeeded') return contribution;
    if (refund.amountMinor > remainingMinor(contribution)) {
      await this.discrepancy('refund_mismatch', contribution, {
        reference: refund.providerRefundId ?? refund.id,
        expected: `at most ${remainingMinor(contribution)} ${contribution.currency}`,
        actual: `${refund.amountMinor} ${contribution.currency}`,
      });
      return contribution;
    }
    const full = refund.amountMinor === remainingMinor(contribution);
    const status = full ? 'refunded' : 'partially_refunded';
    assertTransition(contribution.status, status);
    const commission = commissionRefundFor(
      contribution.commissionMinor,
      contribution.amountMinor,
      contribution.refundedMinor,
      refund.amountMinor,
    );
    const eurMinor = eurPartFor(
      contribution.eurMinor,
      contribution.amountMinor,
      contribution.refundedMinor + contribution.lostMinor,
      refund.amountMinor,
    );
    const now = this.clock.now();
    await this.payments.updateRefund(refund.id, {
      status: 'succeeded',
      commissionMinor: commission,
      eurMinor,
      updatedAt: now,
    });
    await this.ledger(
      refundSucceeded(
        contribution,
        { id: refund.id, amountMinor: refund.amountMinor, commissionMinor: commission, eurMinor },
        { occurredAt: now },
      ),
    );
    if (eurMinor > 0n) {
      await this.projects.reverseFunding(contribution.id, {
        reversalId: refund.id,
        amount: Money.of(eurMinor, EUR),
      });
    }
    let rewardState = contribution.rewardState;
    if (full && rewardState === 'confirmed') {
      await this.projects.release(contribution.id);
      rewardState = 'released';
    }
    const updated: ContributionRecord = {
      ...contribution,
      status,
      refundedMinor: contribution.refundedMinor + refund.amountMinor,
      refundedEurMinor: contribution.refundedEurMinor + eurMinor,
      commissionRefundedMinor: contribution.commissionRefundedMinor + commission,
      rewardState,
      updatedAt: now,
    };
    await this.payments.updateContribution(contribution.id, {
      status: updated.status,
      refundedMinor: updated.refundedMinor,
      refundedEurMinor: updated.refundedEurMinor,
      commissionRefundedMinor: updated.commissionRefundedMinor,
      rewardState,
      updatedAt: now,
    });
    await this.events.record(ContributionRefunded, contribution.id, {
      projectId: contribution.projectId,
      refundId: refund.id,
      amountMinor: refund.amountMinor.toString(),
      currency: contribution.currency,
      eurMinor: eurMinor.toString(),
      full,
    });
    return updated;
  }

  /** Records a discrepancy found outside a reconciliation run, alerting once. */
  async discrepancy(
    kind: DiscrepancyKind,
    subject: DiscrepancySubject | Pick<ContributionRecord, 'id' | 'projectId' | 'provider'>,
    details: { reference: string; expected: string | null; actual: string | null },
    runId: string | null = null,
  ): Promise<boolean> {
    const about: DiscrepancySubject =
      'contributionId' in subject
        ? subject
        : { contributionId: subject.id, projectId: subject.projectId, provider: subject.provider };
    const id = this.ids.next();
    const inserted = await this.transactions.run(async () => {
      const created = await this.payments.insertDiscrepancy({
        id,
        runId,
        kind,
        provider: about.provider,
        reference: details.reference,
        contributionId: about.contributionId,
        projectId: about.projectId,
        expected: details.expected,
        actual: details.actual,
        status: 'open',
        detectedAt: this.clock.now(),
        resolvedAt: null,
        resolvedBy: null,
        resolution: null,
      });
      if (created) {
        await this.events.record(DiscrepancyDetected, id, {
          kind,
          reference: details.reference,
          provider: about.provider,
        });
      }
      return created;
    });
    if (inserted) {
      this.logger.error(
        `Payment discrepancy ${kind} on ${details.reference}: expected ${details.expected ?? '-'}, actual ${details.actual ?? '-'}`,
      );
      this.metrics.increment(DISCREPANCY_METRIC, { kind, provider: about.provider ?? 'none' });
    }
    return inserted;
  }

  private async applyPaymentStatus(
    contribution: ContributionRecord,
    snapshot: ProviderSnapshot,
  ): Promise<ContributionRecord> {
    if (contribution.status !== 'pending_payment') {
      if (snapshot.status === 'succeeded' && !wasPaid(contribution.status)) {
        // Paid after the contribution ended here: never applied silently.
        await this.discrepancy('status_mismatch', contribution, {
          reference: snapshot.paymentId ?? contribution.id,
          expected: contribution.status,
          actual: 'succeeded',
        });
      }
      return contribution;
    }
    switch (snapshot.status) {
      case 'succeeded':
        return this.succeed(contribution, snapshot);
      case 'failed':
        return this.end(contribution, 'failed', 'payment_failed');
      case 'expired':
        return this.end(contribution, 'expired', 'session_expired');
      case 'canceled':
        return this.end(contribution, 'canceled', 'session_canceled');
      case 'pending':
        return contribution;
    }
  }

  /**
   * The verified payment matches the contribution: the project collects its EUR equivalent
   * (frozen at the session, or reported by the settlement of the provider), the reward unit is
   * confirmed, the ledger records the split. No manual confirmation (section 9.3 step 5).
   */
  private async succeed(
    contribution: ContributionRecord,
    snapshot: ProviderSnapshot,
  ): Promise<ContributionRecord> {
    const mismatch = paymentMismatch(contribution, snapshot);
    if (mismatch) {
      await this.discrepancy('amount_mismatch', contribution, {
        reference: snapshot.paymentId ?? contribution.id,
        expected: `${contribution.amountMinor} ${contribution.currency}`,
        actual: mismatch,
      });
      return contribution;
    }
    assertTransition(contribution.status, 'succeeded');
    const now = this.clock.now();
    const eurMinor =
      snapshot.settledEur && contribution.currency !== EUR && snapshot.settledEur.currency === EUR
        ? snapshot.settledEur.amountMinor
        : contribution.eurMinor;
    const fee =
      snapshot.providerFee?.currency === contribution.currency
        ? snapshot.providerFee.amountMinor
        : null;
    let rewardState = contribution.rewardState;
    if (rewardState === 'reserved') {
      await this.projects.confirm(contribution.id);
      rewardState = 'confirmed';
    }
    const succeeded: ContributionRecord = {
      ...contribution,
      status: 'succeeded',
      eurMinor,
      providerFeeMinor: fee,
      rewardState,
      paymentUrl: null,
      succeededAt: now,
      updatedAt: now,
    };
    await this.payments.updateContribution(contribution.id, {
      status: 'succeeded',
      eurMinor,
      providerFeeMinor: fee,
      rewardState,
      paymentUrl: null,
      succeededAt: now,
      updatedAt: now,
    });
    await this.ledger(paymentSucceeded(succeeded, fee ?? 0n, { occurredAt: now }));
    await this.projects.applyFunding(
      contribution.id,
      contribution.projectId,
      Money.of(eurMinor, EUR),
    );
    await this.events.record(ContributionSucceeded, contribution.id, {
      projectId: contribution.projectId,
      contributorId: contribution.contributorId,
      organizationId: contribution.organizationId,
      kind: contribution.kind,
      eurMinor: eurMinor.toString(),
    });
    return succeeded;
  }

  /** The actual fee became known after the success: borne by the holder. */
  private async applyFee(
    contribution: ContributionRecord,
    snapshot: ProviderSnapshot,
  ): Promise<ContributionRecord> {
    const fee = snapshot.providerFee;
    if (contribution.providerFeeMinor !== null || !fee || fee.currency !== contribution.currency) {
      return contribution;
    }
    const now = this.clock.now();
    await this.ledger(providerFeeRecorded(contribution, fee.amountMinor, { occurredAt: now }));
    await this.payments.updateContribution(contribution.id, {
      providerFeeMinor: fee.amountMinor,
      updatedAt: now,
    });
    return { ...contribution, providerFeeMinor: fee.amountMinor };
  }

  /** A refund reported by the provider, requested here or from its dashboard. */
  private async applyProviderRefund(
    contribution: ContributionRecord,
    reported: ProviderRefund,
  ): Promise<ContributionRecord> {
    const existing = await this.payments.findRefundByProviderId(reported.providerRefundId);
    if (existing?.status === 'succeeded') return contribution;
    if (reported.status === 'failed') {
      if (existing) {
        await this.payments.updateRefund(existing.id, {
          status: 'failed',
          updatedAt: this.clock.now(),
        });
      }
      return contribution;
    }
    if (reported.status !== 'succeeded') return contribution;
    const refund =
      existing ??
      (await this.createProviderRefund(contribution, reported.providerRefundId, reported.amount));
    if (contribution.status === 'disputed' || contribution.status === 'dispute_lost') {
      await this.discrepancy('refund_mismatch', contribution, {
        reference: reported.providerRefundId,
        expected: 'no refund during a dispute',
        actual: `${reported.amount.amountMinor} ${reported.amount.currency}`,
      });
      return contribution;
    }
    return this.applyRefund(contribution, refund);
  }

  private async createProviderRefund(
    contribution: ContributionRecord,
    providerRefundId: string,
    amount: Money,
  ): Promise<RefundRecord> {
    const now = this.clock.now();
    const refund: RefundRecord = {
      id: this.ids.next(),
      contributionId: contribution.id,
      providerRefundId,
      amountMinor: amount.amountMinor,
      currency: amount.currency,
      commissionMinor: 0n,
      eurMinor: 0n,
      status: 'pending',
      origin: 'provider',
      reason: 'provider',
      requestedBy: null,
      createdAt: now,
      updatedAt: now,
    };
    await this.payments.insertRefund(refund);
    return refund;
  }

  /**
   * Disputes: opening withdraws the amount from the holder; a won dispute cancels the opening by
   * a counter-entry; a lost one reverses its EUR part on the project.
   */
  private async applyDispute(
    contribution: ContributionRecord,
    reported: ProviderDispute,
  ): Promise<ContributionRecord> {
    let current = contribution;
    let dispute = await this.payments.findDisputeByProviderId(reported.providerDisputeId);
    const now = this.clock.now();
    if (!dispute) {
      if (reported.amount.amountMinor > remainingMinor(current)) {
        await this.discrepancy('amount_mismatch', current, {
          reference: reported.providerDisputeId,
          expected: `at most ${remainingMinor(current)} ${current.currency}`,
          actual: `${reported.amount.amountMinor} ${reported.amount.currency}`,
        });
        return current;
      }
      assertTransition(current.status, 'disputed');
      dispute = {
        id: this.ids.next(),
        contributionId: current.id,
        providerDisputeId: reported.providerDisputeId,
        amountMinor: reported.amount.amountMinor,
        currency: reported.amount.currency,
        eurMinor: 0n,
        status: 'open',
        openedAt: now,
        closedAt: null,
      };
      await this.payments.insertDispute(dispute);
      await this.ledger(
        disputeOpened(
          current,
          { id: dispute.id, amountMinor: dispute.amountMinor },
          {
            occurredAt: now,
          },
        ),
      );
      current = { ...current, status: 'disputed', updatedAt: now };
      await this.payments.updateContribution(current.id, { status: 'disputed', updatedAt: now });
      await this.events.record(ContributionDisputed, current.id, {
        projectId: current.projectId,
        disputeId: dispute.id,
        amountMinor: dispute.amountMinor.toString(),
        currency: dispute.currency,
      });
    }
    if (dispute.status !== 'open' || reported.status === 'open') return current;
    if (reported.status === 'won') {
      const opening = await this.payments.findLedgerEntry('dispute_opened', dispute.id);
      if (opening) await this.ledger(disputeWon(opening, dispute.id, { occurredAt: now }));
      await this.payments.updateDispute(dispute.id, { status: 'won', closedAt: now });
      current = { ...current, status: 'dispute_won', updatedAt: now };
      await this.payments.updateContribution(current.id, { status: 'dispute_won', updatedAt: now });
      await this.events.record(ContributionDisputeResolved, current.id, {
        projectId: current.projectId,
        disputeId: dispute.id,
        outcome: 'won',
        eurMinor: '0',
      });
      return current;
    }
    const eurMinor = eurPartFor(
      current.eurMinor,
      current.amountMinor,
      current.refundedMinor + current.lostMinor,
      dispute.amountMinor,
    );
    await this.payments.updateDispute(dispute.id, { status: 'lost', eurMinor, closedAt: now });
    await this.ledger(disputeLost(current, { id: dispute.id, eurMinor }, { occurredAt: now }));
    if (eurMinor > 0n) {
      await this.projects.reverseFunding(current.id, {
        reversalId: dispute.id,
        amount: Money.of(eurMinor, EUR),
      });
    }
    const lostMinor = current.lostMinor + dispute.amountMinor;
    let rewardState = current.rewardState;
    if (lostMinor + current.refundedMinor >= current.amountMinor && rewardState === 'confirmed') {
      await this.projects.release(current.id);
      rewardState = 'released';
    }
    current = {
      ...current,
      status: 'dispute_lost',
      lostMinor,
      lostEurMinor: current.lostEurMinor + eurMinor,
      rewardState,
      updatedAt: now,
    };
    await this.payments.updateContribution(current.id, {
      status: 'dispute_lost',
      lostMinor,
      lostEurMinor: current.lostEurMinor,
      rewardState,
      updatedAt: now,
    });
    await this.events.record(ContributionDisputeResolved, current.id, {
      projectId: current.projectId,
      disputeId: dispute.id,
      outcome: 'lost',
      eurMinor: eurMinor.toString(),
    });
    return current;
  }

  /** Ledger entries are written once per kind and source: a replay adds nothing. */
  private async ledger(draft: LedgerEntryDraft): Promise<void> {
    await this.payments.insertLedgerEntry({
      ...draft,
      id: this.ids.next(),
      recordedAt: this.clock.now(),
    });
  }
}
