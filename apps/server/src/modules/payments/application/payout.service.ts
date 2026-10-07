import { Inject, Injectable } from '@nestjs/common';
import type {
  CreatePayoutAccountRequest,
  KycOverview,
  PayoutAccount,
  SubmitKycRequest,
} from '@pitchorium/contracts';
import { AuditService } from '../../../platform/audit';
import { COMMON_CONFIG, type CommonConfig } from '../../../platform/config';
import { TransactionManager } from '../../../platform/database';
import { Clock, DomainError } from '../../../platform/kernel';
import { IdentityFacade } from '../../identity';
import { MediaFacade } from '../../media';
import { PROVIDER_CAPABILITIES, type ProviderId } from '../domain/capability-matrix';
import {
  KycApproved,
  KycRejected,
  KycSubmitted,
  PayoutAccountOnboarded,
  PayoutAccountUpdated,
} from '../domain/payments-events';
import {
  collectionOpen,
  isKycVerified,
  type KycSubmissionRecord,
  type PayoutAccountRecord,
  type PayoutAccountState,
} from '../domain/payout';
import { routeFor } from '../domain/routing';
import { PaymentsEventsRecorder } from './payments-events.recorder';
import { KycProvider, PaymentProviders, PaymentsRepository } from './ports';

/** Resource of the KYC documents in the media module (always private). */
export const KYC_SUBMISSION_RESOURCE = 'kyc_submission';

const accountNotFound = () =>
  new DomainError('PAYMENTS_PAYOUT_ACCOUNT_NOT_FOUND', 'No payout account');

/**
 * Payout account and KYC of a holder (section 9.5). The route is decided by the country of the
 * payout account (ADR 0043); Stripe verifies the holder itself, the other routes go through a
 * manual review (ADR 0050). Collected contributions open once both are complete.
 */
@Injectable()
export class PayoutService {
  constructor(
    private readonly payments: PaymentsRepository,
    private readonly providers: PaymentProviders,
    private readonly kyc: KycProvider,
    private readonly identity: IdentityFacade,
    private readonly media: MediaFacade,
    private readonly events: PaymentsEventsRecorder,
    private readonly audit: AuditService,
    private readonly transactions: TransactionManager,
    private readonly clock: Clock,
    @Inject(COMMON_CONFIG) private readonly config: CommonConfig,
  ) {}

  async create(userId: string, request: CreatePayoutAccountRequest): Promise<PayoutAccount> {
    if (await this.payments.findPayoutAccount(userId)) {
      throw new DomainError('PAYMENTS_PAYOUT_ACCOUNT_EXISTS', 'A payout account already exists');
    }
    const route = routeFor(request.country, this.providers.enabled());
    if (!route) {
      throw new DomainError(
        'PAYMENTS_PAYOUT_COUNTRY_NOT_SUPPORTED',
        `No verified payment route serves ${request.country}`,
      );
    }
    const capabilities = PROVIDER_CAPABILITIES[route.provider];
    if (capabilities.onboarding === 'bank_details' && !request.bankAccount) {
      throw new DomainError('PAYMENTS_PAYOUT_DETAILS_REQUIRED', 'Bank details are required');
    }
    const user = await this.identity.findUser(userId);
    if (!user) throw new DomainError('IDENTITY_USER_NOT_FOUND', 'User not found');
    // Outside any transaction (ADR 0019): the provider creates the account first.
    const created = await this.providers.payout(route.provider).createAccount({
      userId,
      country: route.country,
      currency: route.currency,
      email: user.email,
      name: user.name,
      bankAccount: request.bankAccount,
      commissionRateBps: this.config.payments.commission.rateBps,
    });
    const now = this.clock.now();
    const account: PayoutAccountRecord = {
      userId,
      provider: route.provider,
      country: route.country,
      currency: route.currency,
      providerAccountId: created.providerAccountId,
      status: created.state.status,
      onboarding: capabilities.onboarding,
      kycMode: capabilities.kycMode,
      providerVerified: capabilities.kycMode === 'provider' && created.state.verified,
      createdAt: now,
      updatedAt: now,
    };
    await this.transactions.run(async () => {
      if (!(await this.payments.insertPayoutAccount(account))) {
        throw new DomainError('PAYMENTS_PAYOUT_ACCOUNT_EXISTS', 'A payout account already exists');
      }
      await this.audit.record({
        actor: { type: 'user', id: userId },
        action: 'payments.payout-account-created',
        target: { type: 'payout_account', id: userId },
        metadata: { provider: route.provider, country: route.country },
      });
      if (account.status === 'active') {
        await this.events.record(PayoutAccountOnboarded, userId, {
          provider: route.provider,
          country: route.country,
        });
      } else {
        await this.events.record(PayoutAccountUpdated, userId, {
          status: account.status,
          fields: ['created'],
        });
      }
    });
    return this.view(userId);
  }

  async view(userId: string): Promise<PayoutAccount> {
    const account = await this.payments.findPayoutAccount(userId);
    if (!account) throw accountNotFound();
    const latest = await this.kyc.latest(userId);
    const onboardingUrl =
      account.onboarding === 'hosted' && account.status !== 'active'
        ? await this.providers
            .payout(account.provider)
            .onboardingLink(account.providerAccountId, this.returnUrl())
        : null;
    return {
      country: account.country,
      currency: account.currency,
      status: account.status,
      onboarding: account.onboarding,
      onboardingUrl,
      kyc: { mode: account.kycMode, status: kycStatus(account, latest) },
      collectionOpen: collectionOpen(account, latest),
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString(),
    };
  }

  /** Reads the account again at the provider (return from the hosted onboarding). */
  async refresh(userId: string): Promise<PayoutAccount> {
    const account = await this.payments.findPayoutAccount(userId);
    if (!account) throw accountNotFound();
    await this.applyState(
      account,
      await this.providers.payout(account.provider).accountState(account.providerAccountId),
    );
    return this.view(userId);
  }

  /** Account notification of a provider (worker), whatever its order. */
  async refreshByProviderAccount(provider: ProviderId, providerAccountId: string): Promise<void> {
    const account = await this.payments.findPayoutAccountByProviderId(provider, providerAccountId);
    if (!account) return;
    await this.applyState(
      account,
      await this.providers.payout(provider).accountState(providerAccountId),
    );
  }

  private async applyState(account: PayoutAccountRecord, state: PayoutAccountState): Promise<void> {
    const verified = account.kycMode === 'provider' && state.verified;
    if (state.status === account.status && verified === account.providerVerified) return;
    await this.transactions.run(async () => {
      await this.payments.updatePayoutAccount(account.userId, {
        status: state.status,
        providerVerified: verified,
        updatedAt: this.clock.now(),
      });
      if (state.status === 'active' && account.status !== 'active') {
        await this.events.record(PayoutAccountOnboarded, account.userId, {
          provider: account.provider,
          country: account.country,
        });
      } else {
        await this.events.record(PayoutAccountUpdated, account.userId, {
          status: state.status,
          fields: state.status !== account.status ? ['status'] : ['verification'],
        });
      }
      if (verified && !account.providerVerified) {
        await this.events.record(KycApproved, account.userId, {
          submissionId: null,
          mode: 'provider',
        });
      }
    });
  }

  async kycOverview(userId: string): Promise<KycOverview> {
    const account = await this.payments.findPayoutAccount(userId);
    const latest = await this.kyc.latest(userId);
    return {
      mode: account?.kycMode ?? null,
      status: kycStatus(account, latest),
      latest: latest ? kycView(latest) : null,
    };
  }

  /** Manual review only: private documents attached to the submission (media). */
  async submitKyc(userId: string, request: SubmitKycRequest): Promise<KycSubmissionRecord> {
    const account = await this.payments.findPayoutAccount(userId);
    if (!account) throw accountNotFound();
    if (account.kycMode !== 'manual_review') {
      throw new DomainError('PAYMENTS_KYC_NOT_MANUAL', 'The provider verifies the identity');
    }
    const latest = await this.kyc.latest(userId);
    if (latest?.status === 'pending') {
      throw new DomainError('PAYMENTS_KYC_PENDING', 'A submission is under review');
    }
    if (latest?.status === 'approved') {
      throw new DomainError('PAYMENTS_KYC_ALREADY_VERIFIED', 'Identity already verified');
    }
    return this.transactions.run(async () => {
      const submission = await this.kyc.submit(userId, request.documentMediaIds);
      for (const mediaId of request.documentMediaIds) {
        await this.media.attach({
          mediaId,
          ownerId: userId,
          usage: 'verification_document',
          resource: { type: KYC_SUBMISSION_RESOURCE, id: submission.id },
        });
      }
      await this.events.record(KycSubmitted, userId, { submissionId: submission.id });
      await this.audit.record({
        actor: { type: 'user', id: userId },
        action: 'payments.kyc-submitted',
        target: { type: KYC_SUBMISSION_RESOURCE, id: submission.id },
        metadata: { documents: request.documentMediaIds.length },
      });
      return submission;
    });
  }

  /**
   * Decision of an administrator (the review queue). `reviewerId` is null only for the
   * demonstration data of `pnpm db:seed:dev`, refused in production (ADR 0035).
   */
  async decideKyc(
    submissionId: string,
    reviewerId: string | null,
    decision: 'approved' | 'rejected',
    reason: string,
  ): Promise<KycSubmissionRecord> {
    if (reviewerId === null && this.config.env === 'production') {
      throw new DomainError('FORBIDDEN', 'A KYC decision needs a reviewer');
    }
    return this.transactions.run(async () => {
      const submission = await this.payments.findKycSubmission(submissionId);
      if (!submission) throw new DomainError('PAYMENTS_KYC_NOT_FOUND', 'KYC submission not found');
      if (submission.status !== 'pending') {
        throw new DomainError('PAYMENTS_KYC_ALREADY_DECIDED', 'Already decided');
      }
      const now = this.clock.now();
      const decided: KycSubmissionRecord = {
        ...submission,
        status: decision,
        decidedAt: now,
        decidedBy: reviewerId,
        decisionReason: reason,
      };
      await this.payments.updateKycSubmission(submissionId, {
        status: decision,
        decidedAt: now,
        decidedBy: reviewerId,
        decisionReason: reason,
      });
      if (decision === 'approved') {
        await this.events.record(KycApproved, submission.userId, {
          submissionId,
          mode: 'manual_review',
        });
      } else {
        await this.events.record(KycRejected, submission.userId, {
          submissionId,
          decidedBy: reviewerId ?? 'system',
        });
      }
      await this.audit.record({
        actor: reviewerId ? { type: 'user', id: reviewerId } : { type: 'system' },
        action: `payments.kyc-${decision}`,
        target: { type: KYC_SUBMISSION_RESOURCE, id: submissionId },
        metadata: { holderId: submission.userId, reason },
      });
      return decided;
    });
  }

  async isKycVerified(userId: string): Promise<boolean> {
    return isKycVerified(
      await this.payments.findPayoutAccount(userId),
      await this.kyc.latest(userId),
    );
  }

  /** Holder ready to collect: active payout account and verified identity. */
  async collectionOpen(userId: string): Promise<boolean> {
    return collectionOpen(
      await this.payments.findPayoutAccount(userId),
      await this.kyc.latest(userId),
    );
  }

  private returnUrl(): string {
    return `${this.config.webAppUrl}/settings/payouts`;
  }
}

function kycStatus(
  account: PayoutAccountRecord | null,
  latest: KycSubmissionRecord | null,
): KycOverview['status'] {
  if (isKycVerified(account, latest)) return 'verified';
  if (account?.kycMode === 'provider')
    return account.status === 'pending' ? 'not_submitted' : 'pending';
  if (!latest) return 'not_submitted';
  return latest.status === 'rejected' ? 'rejected' : 'pending';
}

export function kycView(submission: KycSubmissionRecord) {
  return {
    id: submission.id,
    userId: submission.userId,
    holder: null,
    status: submission.status,
    documentMediaIds: submission.documentMediaIds,
    submittedAt: submission.submittedAt.toISOString(),
    decidedAt: submission.decidedAt?.toISOString() ?? null,
    decisionReason: submission.decisionReason,
  };
}
