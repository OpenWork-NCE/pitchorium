import { Injectable } from '@nestjs/common';
import type { Refund } from '@pitchorium/contracts';
import { AuditService } from '../../../platform/audit';
import { TransactionManager } from '../../../platform/database';
import { Clock, DomainError, IdGenerator, Money } from '../../../platform/kernel';
import { isRefundable, remainingMinor } from '../domain/contribution';
import { ContributionEffectsService } from './contribution-effects.service';
import { contributionNotFound } from './contributions.service';
import { refundView } from './payments-views';
import { PaymentProviders, PaymentsRepository, type RefundRecord } from './ports';

export interface RefundOrder {
  amount?: { amountMinor: string; currency: string } | undefined;
  reason: string;
  /** Administrator, or null for a moderation decision. */
  requestedBy: string | null;
  origin: 'admin' | 'moderation';
}

/**
 * Refunds, total or partial (section 13): by an administrator, or on a moderation decision.
 * The refund is recorded pending before the provider is called (outside any transaction), then
 * its effects apply once the provider confirms it (ContributionEffectsService).
 */
@Injectable()
export class RefundsService {
  constructor(
    private readonly payments: PaymentsRepository,
    private readonly providers: PaymentProviders,
    private readonly effects: ContributionEffectsService,
    private readonly audit: AuditService,
    private readonly transactions: TransactionManager,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async refund(contributionId: string, order: RefundOrder): Promise<Refund> {
    const refund = await this.transactions.run(async () => {
      const contribution = await this.payments.lockContribution(contributionId);
      if (!contribution) throw contributionNotFound();
      if (!isRefundable(contribution.status)) {
        throw new DomainError(
          'PAYMENTS_INVALID_TRANSITION',
          `Cannot refund a ${contribution.status} contribution`,
        );
      }
      const pending = (await this.payments.refundsOf(contributionId))
        .filter((existing) => existing.status === 'pending')
        .reduce((sum, existing) => sum + existing.amountMinor, 0n);
      const refundable = remainingMinor(contribution) - pending;
      const amount = order.amount
        ? Money.fromJSON(order.amount)
        : Money.of(refundable, contribution.currency);
      if (
        amount.currency !== contribution.currency ||
        amount.amountMinor <= 0n ||
        amount.amountMinor > refundable
      ) {
        throw new DomainError(
          'PAYMENTS_REFUND_INVALID',
          'The refund exceeds the refundable amount',
        );
      }
      const now = this.clock.now();
      const record: RefundRecord = {
        id: this.ids.next(),
        contributionId,
        providerRefundId: null,
        amountMinor: amount.amountMinor,
        currency: amount.currency,
        commissionMinor: 0n,
        eurMinor: 0n,
        status: 'pending',
        origin: order.origin,
        reason: order.reason,
        requestedBy: order.requestedBy,
        createdAt: now,
        updatedAt: now,
      };
      await this.payments.insertRefund(record);
      await this.audit.record({
        actor: order.requestedBy ? { type: 'user', id: order.requestedBy } : { type: 'system' },
        action: 'payments.refund-requested',
        target: { type: 'contribution', id: contributionId },
        metadata: {
          refundId: record.id,
          amountMinor: amount.amountMinor.toString(),
          currency: amount.currency,
          origin: order.origin,
          reason: order.reason,
        },
      });
      return { record, contribution };
    });
    let result: { providerRefundId: string; status: RefundRecord['status'] };
    try {
      result = await this.providers.payment(refund.contribution.provider).refund({
        contribution: refund.contribution,
        refundId: refund.record.id,
        amount: Money.of(refund.record.amountMinor, refund.record.currency),
      });
    } catch (error) {
      await this.payments.updateRefund(refund.record.id, {
        status: 'failed',
        updatedAt: this.clock.now(),
      });
      throw error;
    }
    await this.transactions.run(async () => {
      await this.payments.updateRefund(refund.record.id, {
        providerRefundId: result.providerRefundId,
        status: result.status === 'failed' ? 'failed' : 'pending',
        updatedAt: this.clock.now(),
      });
      if (result.status !== 'succeeded') return;
      const contribution = await this.payments.lockContribution(contributionId);
      const pendingRecord = await this.payments.findRefund(refund.record.id);
      if (contribution && pendingRecord)
        await this.effects.applyRefund(contribution, pendingRecord);
    });
    const saved = await this.payments.findRefund(refund.record.id);
    if (!saved) throw contributionNotFound();
    return refundView(saved);
  }
}
