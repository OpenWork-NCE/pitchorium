import { z } from 'zod';
import { uuidV7Schema } from './ids.js';
import { moneySchema } from './money.js';
import { organizationProjectRefSchema } from './organizations.js';
import { cursorPageQuerySchema, cursorPageSchema } from './pagination.js';
import {
  countryCodeSchema,
  FUNDING_INSTRUMENTS,
  handleSchema,
  memberCardSchema,
  positiveMoneySchema,
} from './profiles.js';

/** Instruments really collected online (section 9.1). */
export const CONTRIBUTION_KINDS = ['donation', 'reward_crowdfunding', 'love_money'] as const;
export const contributionKindSchema = z.enum(CONTRIBUTION_KINDS);

/**
 * What a client may ask to pay: every instrument of a project, plus loans. Only the collected
 * kinds are accepted; the others are refused with a stable code (ADR 0051).
 */
export const contributionRequestKindSchema = z.enum([...FUNDING_INSTRUMENTS, 'loan']);

/** Ways to pay offered on the hosted page of a provider (section 9.2). */
export const PAYMENT_METHODS = [
  'card',
  'sepa_debit',
  'apple_pay',
  'google_pay',
  'paypal',
  'mobile_money',
  'bank_transfer',
  'bank_account',
  'ussd',
] as const;
export const paymentMethodSchema = z.enum(PAYMENT_METHODS);

export const CONTRIBUTION_STATUSES = [
  'pending_payment',
  'succeeded',
  'failed',
  'expired',
  'canceled',
  'partially_refunded',
  'refunded',
  'disputed',
  'dispute_won',
  'dispute_lost',
] as const;
export const contributionStatusSchema = z.enum(CONTRIBUTION_STATUSES);

export const REWARD_RESERVATION_STATES = ['none', 'reserved', 'confirmed', 'released'] as const;
export const rewardReservationStateSchema = z.enum(REWARD_RESERVATION_STATES);

/** Source of the rate that gives the EUR equivalent of a payment (ADR 0046). */
export const FX_RATE_SOURCES = ['identity', 'fixed_parity', 'provider', 'simulated'] as const;
export const fxRateSourceSchema = z.enum(FX_RATE_SOURCES);

/** Decimal number written as a string, never a float: `655.957`. */
export const decimalStringSchema = z.string().regex(/^(0|[1-9]\d*)(\.\d+)?$/);

export const fxRateSchema = z.object({
  /** Units of the paid currency for one euro. */
  unitsPerEur: decimalStringSchema,
  source: fxRateSourceSchema,
  at: z.iso.datetime(),
});

export const paymentOptionsQuerySchema = z.object({
  /** Country of the contributor; the declared country of the profile by default. */
  country: countryCodeSchema.optional(),
});

/** Why collected contributions are not open, without exposing the payment plumbing. */
export const PAYMENTS_UNAVAILABLE_REASONS = [
  'project_not_open',
  'holder_not_ready',
  'no_payment_route',
] as const;
export const paymentsUnavailableReasonSchema = z.enum(PAYMENTS_UNAVAILABLE_REASONS);

export const paymentMethodOptionSchema = z.object({
  method: paymentMethodSchema,
  /** Mobile money operators, empty for the other methods. */
  operators: z.array(z.string()),
});

export const paymentCurrencyOptionSchema = z.object({
  currency: z.string(),
  min: moneySchema,
  max: moneySchema,
  methods: z.array(paymentMethodOptionSchema),
});

export const paymentOptionsSchema = z.object({
  projectId: uuidV7Schema,
  acceptsPayments: z.boolean(),
  unavailableReason: paymentsUnavailableReasonSchema.nullable(),
  contributorCountry: countryCodeSchema.nullable(),
  /** Collected kinds the project accepts. */
  kinds: z.array(contributionKindSchema),
  currencies: z.array(paymentCurrencyOptionSchema),
  commissionRateBps: z.number().int(),
  anonymousDonations: z.boolean(),
});

export const contributionQuoteRequestSchema = z.object({
  kind: contributionRequestKindSchema,
  amount: positiveMoneySchema,
  rewardId: uuidV7Schema.optional(),
  method: paymentMethodSchema.optional(),
  country: countryCodeSchema.optional(),
});

/** Section 9.3 step 7: what is paid, kept by Pitchorium and estimated for the holder. */
export const contributionQuoteSchema = z.object({
  kind: contributionKindSchema,
  amount: moneySchema,
  eurEquivalent: moneySchema,
  rate: fxRateSchema,
  commission: moneySchema,
  commissionRateBps: z.number().int(),
  commissionVersion: z.string(),
  /** Estimate from the published pricing of the provider, null when not verified. */
  estimatedProviderFee: moneySchema.nullable(),
  /** Amount minus commission and estimated fees, null without a fee estimate. */
  estimatedHolderAmount: moneySchema.nullable(),
  reward: z
    .object({ rewardId: uuidV7Schema, minAmount: moneySchema, eligible: z.boolean() })
    .nullable(),
  methods: z.array(paymentMethodOptionSchema),
});

export const createContributionRequestSchema = z.object({
  kind: contributionRequestKindSchema,
  amount: positiveMoneySchema,
  method: paymentMethodSchema,
  rewardId: uuidV7Schema.optional(),
  country: countryCodeSchema.optional(),
  /** Shown by name in the public list of supporters; off by default. */
  publicDisplay: z.boolean().default(false),
  /** Anonymous donation, hidden from the holder too, when the configuration allows it. */
  anonymous: z.boolean().default(false),
});

export const createOrganizationContributionRequestSchema = createContributionRequestSchema.extend({
  projectId: uuidV7Schema,
});

export const contributionProjectSchema = z.object({
  id: uuidV7Schema,
  slug: z.string(),
  title: z.string(),
});

export const contributionSchema = z.object({
  id: uuidV7Schema,
  project: contributionProjectSchema,
  organizationId: uuidV7Schema.nullable(),
  kind: contributionKindSchema,
  status: contributionStatusSchema,
  method: paymentMethodSchema,
  amount: moneySchema,
  eurEquivalent: moneySchema,
  rate: fxRateSchema,
  commission: moneySchema,
  commissionRateBps: z.number().int(),
  /** Actual provider fee once known, else null. */
  providerFee: moneySchema.nullable(),
  refunded: moneySchema,
  rewardId: uuidV7Schema.nullable(),
  rewardState: rewardReservationStateSchema,
  publicDisplay: z.boolean(),
  anonymous: z.boolean(),
  /** Hosted payment page of the provider, while the payment is pending. */
  paymentUrl: z.string().nullable(),
  expiresAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
  succeededAt: z.iso.datetime().nullable(),
});

/** What the project owner sees: the contributor, unless the donation is anonymous. */
export const projectContributionSchema = contributionSchema.extend({
  contributor: memberCardSchema.nullable(),
  organization: organizationProjectRefSchema
    .omit({ projectId: true })
    .extend({ id: uuidV7Schema })
    .nullable(),
});

export const contributionIdParamsSchema = z.object({ contributionId: uuidV7Schema });

export const contributionListQuerySchema = cursorPageQuerySchema.extend({
  status: contributionStatusSchema.optional(),
});

export const contributionPageSchema = cursorPageSchema(contributionSchema);
export const projectContributionPageSchema = cursorPageSchema(projectContributionSchema);

/** Public list of supporters: members and organizations who opted in, no amount. */
export const supporterSchema = z.object({
  type: z.enum(['member', 'organization']),
  displayName: z.string(),
  /** Handle of a member or slug of an organization. */
  key: z.string(),
  avatarUrl: z.string().nullable(),
  kind: contributionKindSchema,
  supportedAt: z.iso.datetime(),
});

export const supporterPageSchema = cursorPageSchema(supporterSchema).extend({
  /** Paid contributions that count, named or not. */
  contributionCount: z.number().int(),
  /** Love money commitments without money, counted apart (ADR 0049). */
  commitmentCount: z.number().int(),
});

/** Off-platform contributions (section 9.3, fallback). */
export const OFFLINE_CONTRIBUTION_KINDS = [
  'cash',
  'institutional_transfer',
  'love_money_commitment',
  'skills_sponsorship',
] as const;
export const offlineContributionKindSchema = z.enum(OFFLINE_CONTRIBUTION_KINDS);

/** Kinds that carry money: they count in the collected amount after validation. */
export const MONETARY_OFFLINE_KINDS = ['cash', 'institutional_transfer'] as const;

export const OFFLINE_CONTRIBUTION_STATUSES = [
  'declared',
  'confirmed',
  'validated',
  'rejected',
] as const;
export const offlineContributionStatusSchema = z.enum(OFFLINE_CONTRIBUTION_STATUSES);

export const OFFLINE_DESCRIPTION_MAX_LENGTH = 1000;
export const OFFLINE_PROOFS_MAX = 5;

export const declareOfflineContributionRequestSchema = z.object({
  kind: offlineContributionKindSchema,
  /** Required for cash and institutional transfers, refused otherwise (EUR, XOF or XAF). */
  amount: positiveMoneySchema.optional(),
  description: z.string().trim().min(1).max(OFFLINE_DESCRIPTION_MAX_LENGTH).optional(),
});

export const declareTeamOfflineContributionRequestSchema =
  declareOfflineContributionRequestSchema.extend({ contributorHandle: handleSchema });

export const offlineContributionSchema = z.object({
  id: uuidV7Schema,
  project: contributionProjectSchema,
  kind: offlineContributionKindSchema,
  status: offlineContributionStatusSchema,
  amount: moneySchema.nullable(),
  eurEquivalent: moneySchema.nullable(),
  declaredBy: z.enum(['contributor', 'holder']),
  contributor: memberCardSchema.nullable(),
  description: z.string().nullable(),
  proofMediaIds: z.array(uuidV7Schema),
  createdAt: z.iso.datetime(),
  confirmedAt: z.iso.datetime().nullable(),
  decidedAt: z.iso.datetime().nullable(),
  decisionReason: z.string().nullable(),
});

export const offlineContributionPageSchema = cursorPageSchema(offlineContributionSchema);
export const offlineContributionIdParamsSchema = z.object({ offlineContributionId: uuidV7Schema });
export const offlineContributionListQuerySchema = cursorPageQuerySchema.extend({
  status: offlineContributionStatusSchema.optional(),
});
export const offlineProofsRequestSchema = z.object({
  mediaIds: z.array(uuidV7Schema).min(1).max(OFFLINE_PROOFS_MAX),
});

export const DECISION_REASON_MAX_LENGTH = 1000;
export const decisionReasonSchema = z.string().trim().min(1).max(DECISION_REASON_MAX_LENGTH);

export const offlineDecisionRequestSchema = z.object({
  decision: z.enum(['validated', 'rejected']),
  reason: decisionReasonSchema,
});

export const offlineRejectionRequestSchema = z.object({ reason: decisionReasonSchema });

/** Payout account of the holder (section 9.5). */
export const PAYOUT_ACCOUNT_STATUSES = ['pending', 'active', 'restricted'] as const;
export const payoutAccountStatusSchema = z.enum(PAYOUT_ACCOUNT_STATUSES);

export const KYC_STATUSES = ['not_submitted', 'pending', 'verified', 'rejected'] as const;
export const kycStatusSchema = z.enum(KYC_STATUSES);

export const createPayoutAccountRequestSchema = z.object({
  /** Country of the bank account that receives the funds: it decides the payment route. */
  country: countryCodeSchema,
  /** Bank details, for the routes that create a payout sub-account. */
  bankAccount: z
    .object({
      bankCode: z.string().trim().min(1).max(32),
      accountNumber: z.string().trim().min(4).max(64),
      accountName: z.string().trim().min(1).max(120),
      mobileNumber: z
        .string()
        .regex(/^\+?[0-9]{6,15}$/)
        .optional(),
    })
    .optional(),
});

export const payoutAccountSchema = z.object({
  country: countryCodeSchema,
  /** Currency of the funds received. */
  currency: z.string(),
  status: payoutAccountStatusSchema,
  /** `hosted`: identity and bank details on the page of the provider; `bank_details`: here. */
  onboarding: z.enum(['hosted', 'bank_details']),
  onboardingUrl: z.string().nullable(),
  kyc: z.object({
    /** `provider`: the provider verifies the holder; `manual_review`: Pitchorium does. */
    mode: z.enum(['provider', 'manual_review']),
    status: kycStatusSchema,
  }),
  /** Collected contributions are open on the projects of the holder. */
  collectionOpen: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const KYC_DOCUMENTS_MAX = 10;
export const submitKycRequestSchema = z.object({
  documentMediaIds: z.array(uuidV7Schema).min(1).max(KYC_DOCUMENTS_MAX),
  /** The holder certifies the documents are genuine and theirs. */
  certification: z.literal(true),
});

export const KYC_REVIEW_STATUSES = ['pending', 'approved', 'rejected'] as const;
export const kycReviewStatusSchema = z.enum(KYC_REVIEW_STATUSES);

export const kycSubmissionSchema = z.object({
  id: uuidV7Schema,
  userId: uuidV7Schema,
  holder: memberCardSchema.nullable(),
  status: kycReviewStatusSchema,
  documentMediaIds: z.array(uuidV7Schema),
  submittedAt: z.iso.datetime(),
  decidedAt: z.iso.datetime().nullable(),
  decisionReason: z.string().nullable(),
});

export const kycOverviewSchema = z.object({
  mode: z.enum(['provider', 'manual_review']).nullable(),
  status: kycStatusSchema,
  latest: kycSubmissionSchema.nullable(),
});

export const kycSubmissionPageSchema = cursorPageSchema(kycSubmissionSchema);
export const kycSubmissionIdParamsSchema = z.object({ kycSubmissionId: uuidV7Schema });
export const kycSubmissionListQuerySchema = cursorPageQuerySchema.extend({
  status: kycReviewStatusSchema.optional(),
});
export const kycDecisionRequestSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  reason: decisionReasonSchema,
});

/** Refund by an administrator: all that remains, or a part (section 13). */
export const REFUND_STATUSES = ['pending', 'succeeded', 'failed'] as const;
export const refundStatusSchema = z.enum(REFUND_STATUSES);

export const refundRequestSchema = z.object({
  amount: positiveMoneySchema.optional(),
  reason: decisionReasonSchema,
});

export const refundSchema = z.object({
  id: uuidV7Schema,
  contributionId: uuidV7Schema,
  amount: moneySchema,
  commissionRefunded: moneySchema,
  status: refundStatusSchema,
  reason: z.string(),
  createdAt: z.iso.datetime(),
});

export const adminContributionSchema = projectContributionSchema.extend({
  refunds: z.array(refundSchema),
});

/** Daily reconciliation of the provider transactions with the ledger (ADR 0048). */
export const DISCREPANCY_KINDS = [
  'missing_contribution',
  'missing_provider_transaction',
  'status_mismatch',
  'amount_mismatch',
  'refund_mismatch',
  'ledger_mismatch',
  'ledger_unbalanced',
  'project_total_mismatch',
] as const;
export const discrepancyKindSchema = z.enum(DISCREPANCY_KINDS);

export const DISCREPANCY_STATUSES = ['open', 'resolved'] as const;
export const discrepancyStatusSchema = z.enum(DISCREPANCY_STATUSES);

export const discrepancySchema = z.object({
  id: uuidV7Schema,
  kind: discrepancyKindSchema,
  provider: z.string().nullable(),
  reference: z.string(),
  contributionId: uuidV7Schema.nullable(),
  projectId: uuidV7Schema.nullable(),
  expected: z.string().nullable(),
  actual: z.string().nullable(),
  status: discrepancyStatusSchema,
  detectedAt: z.iso.datetime(),
  resolvedAt: z.iso.datetime().nullable(),
  resolution: z.string().nullable(),
});

export const discrepancyPageSchema = cursorPageSchema(discrepancySchema);
export const discrepancyIdParamsSchema = z.object({ discrepancyId: uuidV7Schema });
export const discrepancyListQuerySchema = cursorPageQuerySchema.extend({
  status: discrepancyStatusSchema.optional(),
});
export const resolveDiscrepancyRequestSchema = z.object({ note: decisionReasonSchema });

export type ContributionKind = z.infer<typeof contributionKindSchema>;
export type ContributionRequestKind = z.infer<typeof contributionRequestKindSchema>;
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;
export type ContributionStatus = z.infer<typeof contributionStatusSchema>;
export type RewardReservationState = z.infer<typeof rewardReservationStateSchema>;
export type FxRateSource = z.infer<typeof fxRateSourceSchema>;
export type FxRate = z.infer<typeof fxRateSchema>;
export type PaymentOptions = z.infer<typeof paymentOptionsSchema>;
export type PaymentMethodOption = z.infer<typeof paymentMethodOptionSchema>;
export type PaymentCurrencyOption = z.infer<typeof paymentCurrencyOptionSchema>;
export type PaymentsUnavailableReason = (typeof PAYMENTS_UNAVAILABLE_REASONS)[number];
export type ContributionQuoteRequest = z.infer<typeof contributionQuoteRequestSchema>;
export type ContributionQuote = z.infer<typeof contributionQuoteSchema>;
export type CreateContributionRequest = z.infer<typeof createContributionRequestSchema>;
export type CreateOrganizationContributionRequest = z.infer<
  typeof createOrganizationContributionRequestSchema
>;
export type Contribution = z.infer<typeof contributionSchema>;
export type ProjectContribution = z.infer<typeof projectContributionSchema>;
export type AdminContribution = z.infer<typeof adminContributionSchema>;
export type Supporter = z.infer<typeof supporterSchema>;
export type SupporterPage = z.infer<typeof supporterPageSchema>;
export type OfflineContributionKind = z.infer<typeof offlineContributionKindSchema>;
export type OfflineContributionStatus = z.infer<typeof offlineContributionStatusSchema>;
export type DeclareOfflineContributionRequest = z.infer<
  typeof declareOfflineContributionRequestSchema
>;
export type DeclareTeamOfflineContributionRequest = z.infer<
  typeof declareTeamOfflineContributionRequestSchema
>;
export type OfflineContribution = z.infer<typeof offlineContributionSchema>;
export type PayoutAccountStatus = z.infer<typeof payoutAccountStatusSchema>;
export type KycStatus = z.infer<typeof kycStatusSchema>;
export type CreatePayoutAccountRequest = z.infer<typeof createPayoutAccountRequestSchema>;
export type PayoutAccount = z.infer<typeof payoutAccountSchema>;
export type SubmitKycRequest = z.infer<typeof submitKycRequestSchema>;
export type KycSubmission = z.infer<typeof kycSubmissionSchema>;
export type KycOverview = z.infer<typeof kycOverviewSchema>;
export type RefundRequest = z.infer<typeof refundRequestSchema>;
export type Refund = z.infer<typeof refundSchema>;
export type DiscrepancyKind = z.infer<typeof discrepancyKindSchema>;
export type Discrepancy = z.infer<typeof discrepancySchema>;
