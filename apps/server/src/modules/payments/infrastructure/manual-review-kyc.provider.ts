import { Injectable } from '@nestjs/common';
import { Clock, IdGenerator } from '../../../platform/kernel';
import { KycProvider, PaymentsRepository } from '../application/ports';
import type { KycSubmissionRecord } from '../domain/payout';

/**
 * KYC by manual review (ADR 0050): the holder submits private documents (media), an
 * administrator decides with a reason, every step is audited. An automated provider would
 * implement the same port.
 */
@Injectable()
export class ManualReviewKycProvider extends KycProvider {
  readonly kind = 'manual_review' as const;

  constructor(
    private readonly payments: PaymentsRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {
    super();
  }

  async submit(userId: string, documentMediaIds: readonly string[]): Promise<KycSubmissionRecord> {
    const submission: KycSubmissionRecord = {
      id: this.ids.next(),
      userId,
      status: 'pending',
      documentMediaIds: [...documentMediaIds],
      submittedAt: this.clock.now(),
      decidedAt: null,
      decidedBy: null,
      decisionReason: null,
    };
    await this.payments.insertKycSubmission(submission);
    return submission;
  }

  latest(userId: string): Promise<KycSubmissionRecord | null> {
    return this.payments.latestKycSubmission(userId);
  }
}
