import { z } from 'zod';
import { uuidV7Schema } from './ids.js';
import { cursorPageQuerySchema, cursorPageSchema } from './pagination.js';

/**
 * Trust and safety (§13), designed to be compatible with the notice and action, statement of
 * reasons and internal complaint mechanisms of the Digital Services Act; the obligations that
 * really apply to Pitchorium are a legal question (docs/open-questions.md).
 */
export const REPORT_DETAILS_MAX_LENGTH = 2_000;
export const MODERATION_STATEMENT_MIN_LENGTH = 20;
export const MODERATION_STATEMENT_MAX_LENGTH = 5_000;
export const MODERATION_GROUND_REFERENCE_MAX_LENGTH = 300;
export const APPEAL_STATEMENT_MAX_LENGTH = 5_000;
/** Longest temporary suspension a decision may set; longer is a permanent suspension. */
export const SUSPENSION_DAYS_MAX = 365;

export const REPORT_TARGET_TYPES = [
  'profile',
  'organization',
  'post',
  'comment',
  'project',
  'project_update',
  'event',
  'mission',
  'message',
  'media',
] as const;
export const reportTargetTypeSchema = z.enum(REPORT_TARGET_TYPES);

/** Provisional list (docs/open-questions.md), shared by every target. */
export const REPORT_REASONS = [
  'spam',
  'harassment',
  'fraud',
  'illegal_content',
  'misleading_information',
  'intellectual_property',
  'other',
] as const;
export const reportReasonSchema = z.enum(REPORT_REASONS);

/** `received` until the case is resolved; `outcome` tells the reporter what was decided. */
export const REPORT_STATUSES = ['received', 'resolved'] as const;
export const reportStatusSchema = z.enum(REPORT_STATUSES);
export const REPORT_OUTCOMES = ['action_taken', 'no_action'] as const;
export const reportOutcomeSchema = z.enum(REPORT_OUTCOMES);

/** A case gathers the reports and signals about one target; one open case per target. */
export const MODERATION_CASE_STATUSES = ['open', 'resolved'] as const;
export const moderationCaseStatusSchema = z.enum(MODERATION_CASE_STATUSES);
export const MODERATION_CASE_ORIGINS = ['report', 'signal'] as const;
export const moderationCaseOriginSchema = z.enum(MODERATION_CASE_ORIGINS);

/** Simple automatic signals, never a sanction by themselves (no machine learning). */
export const TRUST_SIGNAL_KINDS = [
  'message_requests',
  'connection_requests',
  'reports_received',
] as const;
export const trustSignalKindSchema = z.enum(TRUST_SIGNAL_KINDS);

/**
 * `hide` and `remove` act on the moderation status of the content in its module; `warn` and
 * `suspend` on the member concerned; `freeze_project` stops the contributions of a project.
 */
export const MODERATION_DECISION_KINDS = [
  'dismiss',
  'hide',
  'remove',
  'warn',
  'suspend',
  'freeze_project',
] as const;
export const moderationDecisionKindSchema = z.enum(MODERATION_DECISION_KINDS);

/** Contractual (terms of use) or legal ground of a decision (statement of reasons). */
export const MODERATION_GROUNDS = ['terms', 'law'] as const;
export const moderationGroundSchema = z.enum(MODERATION_GROUNDS);

export const APPEAL_STATUSES = ['pending', 'upheld', 'overturned'] as const;
export const appealStatusSchema = z.enum(APPEAL_STATUSES);
export const APPEAL_OUTCOMES = ['upheld', 'overturned'] as const;
export const appealOutcomeSchema = z.enum(APPEAL_OUTCOMES);

const details = z.string().trim().min(1).max(REPORT_DETAILS_MAX_LENGTH);

export const createReportRequestSchema = z
  .object({
    targetType: reportTargetTypeSchema,
    targetId: uuidV7Schema,
    reason: reportReasonSchema,
    details: details.nullable().default(null),
  })
  .strict();

/**
 * Notice of illegal content without an account: the explanation is required, the contact is
 * optional (without it the notifier is not informed of the decision), good faith is declared.
 */
export const anonymousReportRequestSchema = z
  .object({
    targetType: reportTargetTypeSchema,
    targetId: uuidV7Schema,
    details,
    reporterName: z.string().trim().min(1).max(120).nullable().default(null),
    reporterEmail: z.email().max(254).nullable().default(null),
    goodFaith: z.literal(true),
  })
  .strict();

/** A report as its author sees it: never who else reported, never the moderator. */
export const reportSchema = z.object({
  id: uuidV7Schema,
  targetType: reportTargetTypeSchema,
  targetId: uuidV7Schema,
  reason: reportReasonSchema,
  status: reportStatusSchema,
  outcome: reportOutcomeSchema.nullable(),
  createdAt: z.iso.datetime(),
  resolvedAt: z.iso.datetime().nullable(),
});
export const reportPageSchema = cursorPageSchema(reportSchema);

/** Receipt of a report without an account: the identifier to quote. */
export const reportReceiptSchema = z.object({ id: uuidV7Schema, receivedAt: z.iso.datetime() });

/**
 * Context of a reported message given to the moderator: the reported message and at most the
 * few messages that precede it in the conversation, never the whole conversation.
 */
export const reportedMessageContextSchema = z.object({
  conversationId: uuidV7Schema,
  messages: z.array(
    z.object({
      id: uuidV7Schema,
      senderId: uuidV7Schema,
      sentAt: z.iso.datetime(),
      text: z.string().nullable(),
      reported: z.boolean(),
    }),
  ),
});

export const moderationReportSchema = z.object({
  id: uuidV7Schema,
  reason: reportReasonSchema,
  details: z.string().nullable(),
  /** Null for a notice without an account. */
  reporterId: uuidV7Schema.nullable(),
  anonymous: z.boolean(),
  messageContext: reportedMessageContextSchema.nullable(),
  createdAt: z.iso.datetime(),
});

export const moderationAssignmentSchema = z.object({
  moderatorId: uuidV7Schema.nullable(),
  assignedBy: uuidV7Schema,
  assignedAt: z.iso.datetime(),
});

export const moderationCaseSchema = z.object({
  id: uuidV7Schema,
  targetType: reportTargetTypeSchema,
  targetId: uuidV7Schema,
  /** Member concerned by the decision (author, owner, sender), null when unknown. */
  subjectId: uuidV7Schema.nullable(),
  origin: moderationCaseOriginSchema,
  signalKind: trustSignalKindSchema.nullable(),
  status: moderationCaseStatusSchema,
  /** Higher first; the rules are in the README of the trust module. */
  priority: z.number().int(),
  priorityReasons: z.array(z.string()),
  reportCount: z.number().int(),
  reasons: z.array(reportReasonSchema),
  assignedTo: uuidV7Schema.nullable(),
  decisionId: uuidV7Schema.nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  resolvedAt: z.iso.datetime().nullable(),
});
export const moderationCasePageSchema = cursorPageSchema(moderationCaseSchema);

export const appealSchema = z.object({
  id: uuidV7Schema,
  decisionId: uuidV7Schema,
  statement: z.string(),
  status: appealStatusSchema,
  outcomeStatement: z.string().nullable(),
  createdAt: z.iso.datetime(),
  resolvedAt: z.iso.datetime().nullable(),
});

/**
 * Statement of reasons given to the member concerned: the decision, the facts, the ground, the
 * use of automated means and the redress (appeal until `appealableUntil`).
 */
export const moderationDecisionSchema = z.object({
  id: uuidV7Schema,
  caseId: uuidV7Schema,
  targetType: reportTargetTypeSchema,
  targetId: uuidV7Schema,
  kind: moderationDecisionKindSchema,
  reason: reportReasonSchema.nullable(),
  statement: z.string(),
  ground: moderationGroundSchema,
  groundReference: z.string().nullable(),
  /** True when the case comes from an automatic signal; the decision is always human. */
  automatedDetection: z.boolean(),
  suspensionEndsAt: z.iso.datetime().nullable(),
  decidedAt: z.iso.datetime(),
  appealableUntil: z.iso.datetime().nullable(),
  appeal: appealSchema.nullable(),
});
export const moderationDecisionPageSchema = cursorPageSchema(moderationDecisionSchema);

/** The same decision for the moderators: who decided and who reviewed the appeal. */
export const moderationDecisionDetailSchema = moderationDecisionSchema.extend({
  subjectId: uuidV7Schema.nullable(),
  decidedBy: uuidV7Schema,
  appealReviewerId: uuidV7Schema.nullable(),
});

export const moderationCaseDetailSchema = moderationCaseSchema.extend({
  reports: z.array(moderationReportSchema),
  assignments: z.array(moderationAssignmentSchema),
  decisions: z.array(moderationDecisionDetailSchema),
});

export const moderationQueueQuerySchema = cursorPageQuerySchema.extend({
  status: moderationCaseStatusSchema.default('open'),
  /** `me`: assigned to the reader; `unassigned`; `any` by default. */
  assigned: z.enum(['me', 'unassigned', 'any']).default('any'),
  targetType: reportTargetTypeSchema.optional(),
});

export const assignModerationCaseRequestSchema = z
  .object({ moderatorId: uuidV7Schema.nullable() })
  .strict();

export const decideModerationCaseRequestSchema = z
  .object({
    kind: moderationDecisionKindSchema,
    reason: reportReasonSchema.nullable().default(null),
    statement: z
      .string()
      .trim()
      .min(MODERATION_STATEMENT_MIN_LENGTH)
      .max(MODERATION_STATEMENT_MAX_LENGTH),
    ground: moderationGroundSchema,
    groundReference: z
      .string()
      .trim()
      .min(1)
      .max(MODERATION_GROUND_REFERENCE_MAX_LENGTH)
      .nullable()
      .default(null),
    /** `suspend` only: days of a temporary suspension, null for a permanent one (admins). */
    suspensionDays: z.number().int().min(1).max(SUSPENSION_DAYS_MAX).nullable().default(null),
  })
  .strict();

export const appealDecisionRequestSchema = z
  .object({ statement: z.string().trim().min(1).max(APPEAL_STATEMENT_MAX_LENGTH) })
  .strict();

export const resolveAppealRequestSchema = z
  .object({
    outcome: appealOutcomeSchema,
    statement: z
      .string()
      .trim()
      .min(MODERATION_STATEMENT_MIN_LENGTH)
      .max(MODERATION_STATEMENT_MAX_LENGTH),
  })
  .strict();

export const liftSuspensionRequestSchema = z
  .object({
    statement: z
      .string()
      .trim()
      .min(MODERATION_STATEMENT_MIN_LENGTH)
      .max(MODERATION_STATEMENT_MAX_LENGTH),
  })
  .strict();

export const suspensionSchema = z.object({
  id: uuidV7Schema,
  userId: uuidV7Schema,
  decisionId: uuidV7Schema,
  startsAt: z.iso.datetime(),
  /** Null for a permanent suspension. */
  endsAt: z.iso.datetime().nullable(),
  liftedAt: z.iso.datetime().nullable(),
});

/** What a member sees of their own standing: the active suspension and the decisions. */
export const moderationStandingSchema = z.object({
  suspension: suspensionSchema.nullable(),
  decisions: z.array(moderationDecisionSchema),
});

/** Refunds of a frozen project decided by an administrator (§9, payments). */
export const projectRefundsRequestSchema = z
  .object({
    decisionId: uuidV7Schema,
    reason: z.string().trim().min(1).max(500),
  })
  .strict();
export const projectRefundsResultSchema = z.object({ queued: z.number().int() });

/** Aggregated transparency counters over a period (admins). */
export const transparencyQuerySchema = z.object({ from: z.iso.date(), to: z.iso.date() }).strict();
export const transparencyReportSchema = z.object({
  from: z.iso.date(),
  to: z.iso.date(),
  reports: z.object({
    total: z.number().int(),
    anonymous: z.number().int(),
    byReason: z.record(z.string(), z.number().int()),
    byTargetType: z.record(z.string(), z.number().int()),
  }),
  cases: z.object({
    opened: z.number().int(),
    fromSignals: z.number().int(),
    resolved: z.number().int(),
    /** Median hours from the opening to the decision, null without decision. */
    medianResolutionHours: z.number().nullable(),
  }),
  decisions: z.object({ byKind: z.record(z.string(), z.number().int()) }),
  suspensions: z.object({ started: z.number().int(), permanent: z.number().int() }),
  appeals: z.object({
    received: z.number().int(),
    upheld: z.number().int(),
    overturned: z.number().int(),
    pending: z.number().int(),
  }),
});

export const moderationCaseIdParamsSchema = z.object({ caseId: uuidV7Schema });
export const moderationDecisionIdParamsSchema = z.object({ decisionId: uuidV7Schema });
export const appealIdParamsSchema = z.object({ appealId: uuidV7Schema });
export const suspensionIdParamsSchema = z.object({ suspensionId: uuidV7Schema });
export const userIdParamsSchema = z.object({ userId: uuidV7Schema });

export type ReportTargetType = z.infer<typeof reportTargetTypeSchema>;
export type ReportReason = z.infer<typeof reportReasonSchema>;
export type ReportStatus = z.infer<typeof reportStatusSchema>;
export type ReportOutcome = z.infer<typeof reportOutcomeSchema>;
export type ModerationCaseStatus = z.infer<typeof moderationCaseStatusSchema>;
export type ModerationCaseOrigin = z.infer<typeof moderationCaseOriginSchema>;
export type TrustSignalKind = z.infer<typeof trustSignalKindSchema>;
export type ModerationDecisionKind = z.infer<typeof moderationDecisionKindSchema>;
export type ModerationGround = z.infer<typeof moderationGroundSchema>;
export type AppealStatus = z.infer<typeof appealStatusSchema>;
export type AppealOutcome = z.infer<typeof appealOutcomeSchema>;
export type CreateReportRequest = z.infer<typeof createReportRequestSchema>;
export type AnonymousReportRequest = z.infer<typeof anonymousReportRequestSchema>;
export type Report = z.infer<typeof reportSchema>;
export type ReportReceipt = z.infer<typeof reportReceiptSchema>;
export type ReportedMessageContext = z.infer<typeof reportedMessageContextSchema>;
export type ModerationReport = z.infer<typeof moderationReportSchema>;
export type ModerationCase = z.infer<typeof moderationCaseSchema>;
export type ModerationCaseDetail = z.infer<typeof moderationCaseDetailSchema>;
export type ModerationDecision = z.infer<typeof moderationDecisionSchema>;
export type ModerationDecisionDetail = z.infer<typeof moderationDecisionDetailSchema>;
export type Appeal = z.infer<typeof appealSchema>;
export type ModerationQueueQuery = z.infer<typeof moderationQueueQuerySchema>;
export type DecideModerationCaseRequest = z.infer<typeof decideModerationCaseRequestSchema>;
export type Suspension = z.infer<typeof suspensionSchema>;
export type ModerationStanding = z.infer<typeof moderationStandingSchema>;
export type TransparencyReport = z.infer<typeof transparencyReportSchema>;
