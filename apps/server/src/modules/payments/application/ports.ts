import type {
  ContributionStatus,
  DiscrepancyKind,
  Locale,
  OfflineContributionStatus,
  PaymentMethod,
} from '@pitchorium/contracts';
import type { KeysetPosition, Money } from '../../../platform/kernel';
import type { ProviderId } from '../domain/capability-matrix';
import type { ContributionRecord, ProviderSnapshot } from '../domain/contribution';
import type { Rate } from '../domain/fx';
import type { LedgerEntryDraft, LedgerKind } from '../domain/ledger';
import type { OfflineContributionRecord } from '../domain/offline';
import type {
  KycSubmissionRecord,
  PayoutAccountRecord,
  PayoutAccountState,
} from '../domain/payout';

/** What a provider needs to open its hosted payment page (section 9.3 step 4). */
export interface CreateSessionRequest {
  contributionId: string;
  providerAccountId: string;
  amount: Money;
  /** Taken at the source by the provider (application fee, split). */
  commission: Money;
  method: PaymentMethod;
  expiresAt: Date;
  contributorEmail: string;
  contributorName: string;
  description: string;
  locale: Locale;
  /** Where the provider sends the contributor back. */
  returnUrl: string;
}

export interface PaymentSession {
  sessionId: string;
  paymentUrl: string;
}

export interface ProviderRefundRequest {
  contribution: Pick<
    ContributionRecord,
    'id' | 'providerAccountId' | 'providerSessionId' | 'providerPaymentId' | 'currency'
  >;
  refundId: string;
  amount: Money;
}

export interface ProviderRefundResult {
  providerRefundId: string;
  status: 'pending' | 'succeeded' | 'failed';
}

/** A payment as listed by the provider for the reconciliation. */
export interface ProviderTransaction {
  /** Our contribution identifier, as stored by the provider. */
  reference: string | null;
  providerPaymentId: string;
  providerAccountId: string;
  status: 'succeeded' | 'failed' | 'pending';
  amount: Money;
  /** Null when the provider does not report refunds in its list. */
  refunded: Money | null;
  createdAt: Date;
}

/** A provider notification whose signature was verified on the raw body. */
export interface VerifiedWebhook {
  externalId: string;
  type: string;
  contributionId: string | null;
  providerPaymentId: string | null;
  providerAccountId: string | null;
  /**
   * Reference of the payment at the provider, for a notification that names neither the
   * contribution nor the payment (Flutterwave chargeback: `flw_ref`).
   */
  paymentReference: string | null;
}

/** A payment named by the provider: our contribution identifier and its payment identifier. */
export interface ProviderPaymentRef {
  reference: string | null;
  providerPaymentId: string;
}

export class WebhookRejectedError extends Error {
  constructor(reason: string) {
    super(`Webhook rejected: ${reason}`);
    this.name = 'WebhookRejectedError';
  }
}

/**
 * Port: a payment provider. The payment always happens on its hosted page: no card data goes
 * through Pitchorium. Every state is read again from its API, never trusted from a webhook.
 */
export interface PaymentProvider {
  readonly id: ProviderId;
  createSession(request: CreateSessionRequest): Promise<PaymentSession>;
  /** Current state of the payment of a contribution, refunds and disputes included. */
  retrieve(contribution: ContributionRecord): Promise<ProviderSnapshot>;
  refund(request: ProviderRefundRequest): Promise<ProviderRefundResult>;
  /** Current state of a refund still pending. */
  refreshRefund(
    contribution: ContributionRecord,
    providerRefundId: string,
  ): Promise<ProviderRefundResult>;
  /** Payments of the given accounts created in the period, for the reconciliation. */
  listTransactions(
    accountIds: readonly string[],
    from: Date,
    to: Date,
  ): Promise<ProviderTransaction[]>;
  /**
   * Payments disputed in the period, for a provider whose payment read is not enough to learn
   * about every dispute (Flutterwave chargebacks): the reconciliation syncs each of them.
   */
  disputedPayments?(from: Date, to: Date): Promise<ProviderPaymentRef[]>;
  /** The payment a `paymentReference` of a notification names, read through the API. */
  paymentOf?(paymentReference: string): Promise<ProviderPaymentRef | null>;
  /** Throws WebhookRejectedError when the signature, its age or the body is invalid. */
  verifyWebhook(
    headers: Record<string, string | undefined>,
    rawBody: Buffer,
    now: Date,
  ): VerifiedWebhook;
}

export interface CreatePayoutAccountRequest {
  userId: string;
  country: string;
  currency: string;
  email: string;
  name: string;
  bankAccount:
    | { bankCode: string; accountNumber: string; accountName: string; mobileNumber?: string }
    | undefined;
  commissionRateBps: number;
  /** Labels set on the account at the provider (the provider tests mark what they create). */
  metadata?: Readonly<Record<string, string>>;
}

/** Port: the payout account of a holder at a provider (section 9.5). */
export interface PayoutAccountProvider {
  readonly id: ProviderId;
  createAccount(
    request: CreatePayoutAccountRequest,
  ): Promise<{ providerAccountId: string; state: PayoutAccountState }>;
  /** Hosted onboarding link, null for the providers without hosted onboarding. */
  onboardingLink(providerAccountId: string, returnUrl: string): Promise<string | null>;
  accountState(providerAccountId: string): Promise<PayoutAccountState>;
}

/** The payment and payout adapters of the enabled providers. */
export abstract class PaymentProviders {
  abstract enabled(): readonly ProviderId[];
  abstract payment(id: ProviderId): PaymentProvider;
  abstract payout(id: ProviderId): PayoutAccountProvider;
}

/** Port: rate of a floating currency for one euro, locked for the payment session. */
export abstract class FxRateProvider {
  abstract rate(currency: string, at: Date): Promise<Rate>;
}

/**
 * Port: KYC of the holders whose route has no provider verification. Today a manual review by an
 * administrator; an automated provider can implement it later (ADR 0050).
 */
export abstract class KycProvider {
  abstract readonly kind: 'manual_review';
  abstract submit(
    userId: string,
    documentMediaIds: readonly string[],
  ): Promise<KycSubmissionRecord>;
  abstract latest(userId: string): Promise<KycSubmissionRecord | null>;
}

export interface RefundRecord {
  id: string;
  contributionId: string;
  providerRefundId: string | null;
  amountMinor: bigint;
  currency: string;
  commissionMinor: bigint;
  eurMinor: bigint;
  status: 'pending' | 'succeeded' | 'failed';
  origin: 'admin' | 'moderation' | 'provider';
  reason: string;
  requestedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DisputeRecord {
  id: string;
  contributionId: string;
  providerDisputeId: string;
  amountMinor: bigint;
  currency: string;
  eurMinor: bigint;
  status: 'open' | 'won' | 'lost';
  openedAt: Date;
  closedAt: Date | null;
}

export interface LedgerEntryRecord extends LedgerEntryDraft {
  id: string;
  recordedAt: Date;
}

export interface DiscrepancyRecord {
  id: string;
  runId: string | null;
  kind: DiscrepancyKind;
  provider: string | null;
  reference: string;
  contributionId: string | null;
  projectId: string | null;
  expected: string | null;
  actual: string | null;
  status: 'open' | 'resolved';
  detectedAt: Date;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  resolution: string | null;
}

export type ContributionPatch = Partial<
  Omit<ContributionRecord, 'id' | 'projectId' | 'contributorId' | 'createdAt'>
>;

export interface ContributionFilter {
  contributorId?: string;
  projectId?: string;
  organizationId?: string;
  status?: ContributionStatus;
}

export abstract class PaymentsRepository {
  abstract insertContribution(contribution: ContributionRecord): Promise<void>;
  abstract findContribution(id: string): Promise<ContributionRecord | null>;
  abstract lockContribution(id: string): Promise<ContributionRecord | null>;
  abstract findContributionByPayment(
    provider: ProviderId,
    providerPaymentId: string,
  ): Promise<ContributionRecord | null>;
  abstract updateContribution(id: string, patch: ContributionPatch): Promise<void>;
  /** Newest first. */
  abstract contributions(
    filter: ContributionFilter,
    after: KeysetPosition | null,
    limit: number,
  ): Promise<ContributionRecord[]>;
  abstract countRecentContributions(
    contributorId: string,
    since: Date,
    method?: PaymentMethod,
  ): Promise<number>;
  abstract pendingExpiredBefore(at: Date, limit: number): Promise<ContributionRecord[]>;
  /** Ended contributions still holding a reserved reward (repair of failed releases). */
  abstract heldRewardsOfEnded(limit: number): Promise<ContributionRecord[]>;
  abstract contributionsCreatedBetween(from: Date, to: Date): Promise<ContributionRecord[]>;
  /** Projects with at least one contribution or off-platform contribution. */
  abstract fundedProjectIds(): Promise<string[]>;
  /** Paid contributions of a project shown to the public (opt-in), oldest first. */
  abstract publicSupporters(
    projectId: string,
    after: KeysetPosition | null,
    limit: number,
  ): Promise<ContributionRecord[]>;
  abstract countPaidContributions(projectId: string): Promise<number>;
  /** Members who paid a contribution to the project that still counts. */
  abstract contributorIdsOf(projectId: string): Promise<string[]>;
  /** Paid contributions of a project that a refund may still reach. */
  abstract refundableIdsOf(projectId: string): Promise<string[]>;
  /** Platform statistics: paid contributions, net EUR collected, reviews waiting. */
  abstract statistics(): Promise<{
    succeeded: number;
    collectedEurMinor: bigint;
    kycPending: number;
    offlinePending: number;
  }>;
  /** Projects supported by an organization through paid contributions. */
  abstract projectsSupportedBy(organizationId: string): Promise<string[]>;
  /** Every contribution, oldest first, by keyset (rebuild of the engagement projection). */
  abstract allContributions(afterId: string | null, limit: number): Promise<ContributionRecord[]>;

  abstract insertRefund(refund: RefundRecord): Promise<void>;
  abstract findRefund(id: string): Promise<RefundRecord | null>;
  abstract findRefundByProviderId(providerRefundId: string): Promise<RefundRecord | null>;
  abstract updateRefund(id: string, patch: Partial<RefundRecord>): Promise<void>;
  abstract refundsOf(contributionId: string): Promise<RefundRecord[]>;

  abstract insertDispute(dispute: DisputeRecord): Promise<void>;
  abstract findDisputeByProviderId(providerDisputeId: string): Promise<DisputeRecord | null>;
  abstract updateDispute(id: string, patch: Partial<DisputeRecord>): Promise<void>;

  /** False when the entry of this kind and source already exists. */
  abstract insertLedgerEntry(entry: LedgerEntryRecord): Promise<boolean>;
  abstract findLedgerEntry(kind: LedgerKind, sourceId: string): Promise<LedgerEntryRecord | null>;
  /** Sum of the lines of an account per currency, for a contribution or a project. */
  abstract ledgerSum(
    account: string,
    scope: { contributionId?: string; projectId?: string; offlineContributionId?: string },
  ): Promise<Map<string, bigint>>;
  /** Sum of every line per currency: zero when the ledger balances. */
  abstract ledgerBalances(): Promise<Map<string, bigint>>;

  abstract findPayoutAccount(userId: string): Promise<PayoutAccountRecord | null>;
  abstract findPayoutAccountByProviderId(
    provider: ProviderId,
    providerAccountId: string,
  ): Promise<PayoutAccountRecord | null>;
  abstract insertPayoutAccount(account: PayoutAccountRecord): Promise<boolean>;
  abstract updatePayoutAccount(userId: string, patch: Partial<PayoutAccountRecord>): Promise<void>;
  /**
   * Replaces the payout account of a holder by a new one, if the current one is still the
   * account given (a concurrent change wins once); false otherwise.
   */
  abstract replacePayoutAccount(
    previousProviderAccountId: string,
    account: PayoutAccountRecord,
  ): Promise<boolean>;
  /** Payment sessions still pending on a payout account. */
  abstract hasPendingContributions(
    provider: ProviderId,
    providerAccountId: string,
  ): Promise<boolean>;
  abstract payoutAccountsOf(provider: ProviderId): Promise<PayoutAccountRecord[]>;

  abstract insertKycSubmission(submission: KycSubmissionRecord): Promise<boolean>;
  abstract findKycSubmission(id: string): Promise<KycSubmissionRecord | null>;
  abstract latestKycSubmission(userId: string): Promise<KycSubmissionRecord | null>;
  abstract updateKycSubmission(id: string, patch: Partial<KycSubmissionRecord>): Promise<void>;
  abstract kycSubmissions(
    status: KycSubmissionRecord['status'] | undefined,
    after: KeysetPosition | null,
    limit: number,
  ): Promise<KycSubmissionRecord[]>;

  abstract insertOffline(record: OfflineContributionRecord): Promise<void>;
  abstract findOffline(id: string): Promise<OfflineContributionRecord | null>;
  abstract lockOffline(id: string): Promise<OfflineContributionRecord | null>;
  abstract updateOffline(id: string, patch: Partial<OfflineContributionRecord>): Promise<void>;
  abstract offlineContributions(
    filter: { projectId?: string; contributorId?: string; status?: OfflineContributionStatus },
    after: KeysetPosition | null,
    limit: number,
  ): Promise<OfflineContributionRecord[]>;
  abstract countCommitments(projectId: string): Promise<number>;

  /** False when the event was already recorded. */
  abstract insertProviderEvent(event: {
    id: string;
    provider: ProviderId;
    externalId: string;
    type: string;
    contributionId: string | null;
    providerAccountId: string | null;
    receivedAt: Date;
  }): Promise<boolean>;

  abstract insertReconciliationRun(run: {
    id: string;
    periodStart: Date;
    periodEnd: Date;
    startedAt: Date;
  }): Promise<void>;
  abstract finishReconciliationRun(
    id: string,
    finishedAt: Date,
    checkedTransactions: number,
    discrepancies: number,
  ): Promise<void>;
  /** False when the same discrepancy is already open. */
  abstract insertDiscrepancy(discrepancy: DiscrepancyRecord): Promise<boolean>;
  abstract findDiscrepancy(id: string): Promise<DiscrepancyRecord | null>;
  abstract updateDiscrepancy(id: string, patch: Partial<DiscrepancyRecord>): Promise<void>;
  abstract discrepancies(
    status: DiscrepancyRecord['status'] | undefined,
    after: KeysetPosition | null,
    limit: number,
  ): Promise<DiscrepancyRecord[]>;
}
