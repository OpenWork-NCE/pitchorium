import { z } from 'zod';
import { roleSchema } from './access.js';
import { uuidV7Schema } from './ids.js';
import { localeSchema } from './locale.js';
import { localeStatusSchema } from './localization.js';
import { moneySchema } from './money.js';
import { cursorPageQuerySchema, cursorPageSchema } from './pagination.js';
import { contributionKindSchema, contributionStatusSchema } from './payments.js';
import { moderationDecisionDetailSchema } from './trust.js';

/**
 * Back office (§13, §14), under `/v1/admin/<area>`: members, feature flags, editorial
 * highlights, failed jobs, statistics and the audit log. Every reading of personal data by an
 * administrator is audited.
 */
export const memberSearchQuerySchema = cursorPageQuerySchema.extend({
  /** Part of the email, the name or the handle; at least 2 characters. */
  q: z.string().trim().min(2).max(120),
});

export const memberSummarySchema = z.object({
  userId: uuidV7Schema,
  email: z.string(),
  name: z.string(),
  handle: z.string().nullable(),
  roles: z.array(roleSchema),
  emailVerified: z.boolean(),
  createdAt: z.iso.datetime(),
});
export const memberSummaryPageSchema = cursorPageSchema(memberSummarySchema);

/** An open session of a member: its device and its activity, never its token nor address. */
export const memberSessionSchema = z.object({
  id: z.string(),
  userAgent: z.string().nullable(),
  createdAt: z.iso.datetime(),
  lastActiveAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
});

/** A contribution of the member, as their file lists it. */
export const memberContributionSchema = z.object({
  id: uuidV7Schema,
  project: z.object({ id: uuidV7Schema, slug: z.string(), title: z.string() }).nullable(),
  kind: contributionKindSchema,
  status: contributionStatusSchema,
  amount: moneySchema,
  createdAt: z.iso.datetime(),
});

/**
 * The file of a member as administrators see it: account, roles, sessions, standing,
 * decisions of the moderation and contributions. Its reading is audited.
 */
export const memberFileSchema = memberSummarySchema.extend({
  locale: localeSchema,
  timeZone: z.string(),
  twoFactorEnabled: z.boolean(),
  legal: z.object({ termsVersion: z.string().nullable(), privacyVersion: z.string().nullable() }),
  suspension: z.object({ id: uuidV7Schema, endsAt: z.iso.datetime().nullable() }).nullable(),
  kycVerified: z.boolean(),
  sessions: z.array(memberSessionSchema),
  /** The latest decisions concerning the member, with their appeal. */
  decisions: z.array(moderationDecisionDetailSchema),
  /** The latest contributions of the member, newest first. */
  contributions: z.array(memberContributionSchema),
});

export const memberIdParamsSchema = z.object({ userId: uuidV7Schema });

/**
 * The guardrail of a flag, as the api applies it: a locale is enabled only with a complete
 * catalogue and a recorded human review (ADR 0077); equity and loans need a legal reference,
 * and stay unpaid online without a licensed adapter (ADR 0051).
 */
export const featureFlagGuardSchema = z
  .discriminatedUnion('kind', [
    z.object({ kind: z.literal('locale'), status: localeStatusSchema }),
    z.object({
      kind: z.literal('legal'),
      legalReferenceRequired: z.literal(true),
      onlinePaymentAvailable: z.boolean(),
    }),
  ])
  .nullable();

export const featureFlagSchema = z.object({
  key: z.string(),
  enabled: z.boolean(),
  description: z.string(),
  updatedAt: z.iso.datetime(),
  /** Legal validation recorded for the funding flags, null otherwise. */
  legalReference: z.string().nullable(),
  guard: featureFlagGuardSchema,
});

/** A change of a flag, its author named by their account (null: the command line). */
export const featureFlagChangeSchema = z.object({
  enabled: z.boolean(),
  legalReference: z.string().nullable(),
  changedBy: z.object({ userId: uuidV7Schema, name: z.string() }).nullable(),
  changedAt: z.iso.datetime(),
});
export const featureFlagHistorySchema = z.object({ items: z.array(featureFlagChangeSchema) });
export const featureFlagListSchema = z.object({ items: z.array(featureFlagSchema) });
export const featureFlagKeyParamsSchema = z.object({
  key: z.string().regex(/^[a-z]+\.[a-z0-9-]+$/),
});

/**
 * `legalReference`: reference of the legal validation (opinion, licence, partner contract),
 * required to enable `funding.equity` and `funding.loans`.
 */
export const updateFeatureFlagRequestSchema = z
  .object({
    enabled: z.boolean(),
    legalReference: z.string().trim().min(3).max(300).nullable().default(null),
  })
  .strict();

export const HIGHLIGHT_TARGET_TYPES = ['post', 'project', 'profile'] as const;
export const highlightTargetTypeSchema = z.enum(HIGHLIGHT_TARGET_TYPES);

export const highlightSchema = z.object({
  targetType: highlightTargetTypeSchema,
  /** Identifier of the publication or the project; handle of a profile. */
  targetId: z.string(),
  featuredAt: z.iso.datetime(),
  /** Title of a project, name of a profile, start of the text of a publication. */
  label: z.string().nullable(),
  /** Order of display among the highlights of its type, from 1: the latest featured first. */
  position: z.number().int().positive(),
});
export const highlightListSchema = z.object({ items: z.array(highlightSchema) });
export const highlightParamsSchema = z.object({
  targetType: highlightTargetTypeSchema,
  targetId: z.string().trim().min(1).max(64),
});
export const highlightListQuerySchema = z
  .object({ targetType: highlightTargetTypeSchema.optional() })
  .strict();

export const failedJobSchema = z.object({
  queue: z.string(),
  id: z.string(),
  name: z.string(),
  attemptsMade: z.number().int(),
  failedReason: z.string().nullable(),
  failedAt: z.iso.datetime().nullable(),
  /** The payload, masked by the api: structure, identifiers, dates, numbers and codes only. */
  data: z.unknown(),
});
export const failedJobListSchema = z.object({ items: z.array(failedJobSchema) });
export const failedJobsQuerySchema = z
  .object({
    queue: z.string().max(80).optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
  })
  .strict();
export const jobParamsSchema = z.object({
  queue: z.string().regex(/^[a-z]+\.[a-z0-9-]+$/),
  jobId: z.string().min(1).max(200),
});
export const jobRetryResultSchema = z.object({
  queue: z.string(),
  id: z.string(),
  /** `retried`, or the state that made the retry unnecessary (idempotent). */
  outcome: z.enum(['retried', 'not_failed', 'missing']),
});

export const platformStatsSchema = z.object({
  members: z.object({ total: z.number().int(), active30Days: z.number().int() }),
  projects: z.record(z.string(), z.number().int()),
  contributions: z.object({
    succeeded: z.number().int(),
    /** Net of refunds, in euro cents (equivalent frozen at each contribution). */
    collectedEurMinor: z.string(),
  }),
  pending: z.object({
    moderationCases: z.number().int(),
    appeals: z.number().int(),
    kycReviews: z.number().int(),
    offlineContributions: z.number().int(),
    rightsRequests: z.number().int(),
    failedJobs: z.number().int(),
    organizationVerifications: z.number().int(),
    discrepancies: z.number().int(),
  }),
});

/** The queues of the console, each with what waits in it. */
export const CONSOLE_QUEUES = [
  'moderation_cases',
  'appeals',
  'organization_verifications',
  'kyc_reviews',
  'offline_contributions',
  'discrepancies',
  'failed_jobs',
  'rights_requests',
] as const;
export const consoleQueueSchema = z.enum(CONSOLE_QUEUES);

/** The queues the reader may work in, by their rights, with their count (ADR 0172). */
export const consoleQueuesSchema = z.object({
  items: z.array(z.object({ queue: consoleQueueSchema, count: z.number().int() })),
});

export const auditQuerySchema = cursorPageQuerySchema.extend({
  actorId: z.string().max(64).optional(),
  action: z.string().max(80).optional(),
  targetType: z.string().max(64).optional(),
  targetId: z.string().max(64).optional(),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
});
/** The same filters for the CSV export, without pagination (at most AUDIT_EXPORT_MAX rows). */
export const auditExportQuerySchema = auditQuerySchema.omit({ cursor: true, limit: true });
export const AUDIT_EXPORT_MAX = 5_000;

export const auditEntrySchema = z.object({
  id: uuidV7Schema,
  actorType: z.string(),
  actorId: z.string().nullable(),
  action: z.string(),
  targetType: z.string(),
  targetId: z.string(),
  metadata: z.record(z.string(), z.unknown()),
  requestId: z.string().nullable(),
  occurredAt: z.iso.datetime(),
});
export const auditPageSchema = cursorPageSchema(auditEntrySchema);

export type MemberSearchQuery = z.infer<typeof memberSearchQuerySchema>;
export type MemberSummary = z.infer<typeof memberSummarySchema>;
export type MemberFile = z.infer<typeof memberFileSchema>;
export type FeatureFlagView = z.infer<typeof featureFlagSchema>;
export type UpdateFeatureFlagRequest = z.infer<typeof updateFeatureFlagRequestSchema>;
export type HighlightTargetType = z.infer<typeof highlightTargetTypeSchema>;
export type Highlight = z.infer<typeof highlightSchema>;
export type FailedJob = z.infer<typeof failedJobSchema>;
export type JobRetryResult = z.infer<typeof jobRetryResultSchema>;
export type PlatformStats = z.infer<typeof platformStatsSchema>;
export type AuditQuery = z.infer<typeof auditQuerySchema>;
export type AuditEntry = z.infer<typeof auditEntrySchema>;
export type MemberSession = z.infer<typeof memberSessionSchema>;
export type MemberContribution = z.infer<typeof memberContributionSchema>;
export type FeatureFlagGuard = z.infer<typeof featureFlagGuardSchema>;
export type FeatureFlagChange = z.infer<typeof featureFlagChangeSchema>;
export type ConsoleQueue = z.infer<typeof consoleQueueSchema>;
export type ConsoleQueues = z.infer<typeof consoleQueuesSchema>;
export type AuditExportQuery = z.infer<typeof auditExportQuerySchema>;
