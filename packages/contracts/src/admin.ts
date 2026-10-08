import { z } from 'zod';
import { roleSchema } from './access.js';
import { uuidV7Schema } from './ids.js';
import { localeSchema } from './locale.js';
import { cursorPageQuerySchema, cursorPageSchema } from './pagination.js';

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

/** The file of a member as administrators see it. */
export const memberFileSchema = memberSummarySchema.extend({
  locale: localeSchema,
  timeZone: z.string(),
  twoFactorEnabled: z.boolean(),
  legal: z.object({ termsVersion: z.string().nullable(), privacyVersion: z.string().nullable() }),
  suspension: z.object({ id: uuidV7Schema, endsAt: z.iso.datetime().nullable() }).nullable(),
  kycVerified: z.boolean(),
});

export const memberIdParamsSchema = z.object({ userId: uuidV7Schema });

export const featureFlagSchema = z.object({
  key: z.string(),
  enabled: z.boolean(),
  description: z.string(),
  updatedAt: z.iso.datetime(),
  /** Legal validation recorded for the funding flags, null otherwise. */
  legalReference: z.string().nullable(),
});
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
  }),
});

export const auditQuerySchema = cursorPageQuerySchema.extend({
  actorId: z.string().max(64).optional(),
  action: z.string().max(80).optional(),
  targetType: z.string().max(64).optional(),
  targetId: z.string().max(64).optional(),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
});
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
