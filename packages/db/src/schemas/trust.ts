import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const trustSchema = pgSchema('trust');

const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

/**
 * Moderation case (§13): the reports and automatic signals about one target, one open case per
 * target (deduplication), ordered by priority in the moderation queue.
 */
export const trustCases = trustSchema.table(
  'cases',
  {
    id: uuid('id').primaryKey(),
    targetType: text('target_type').notNull(),
    targetId: uuid('target_id').notNull(),
    /** Member concerned by a decision: author, owner or sender of the target. */
    subjectId: uuid('subject_id'),
    origin: text('origin').notNull(),
    signalKind: text('signal_kind'),
    status: text('status').notNull(),
    priority: integer('priority').notNull(),
    priorityReasons: text('priority_reasons').array().notNull(),
    reportCount: integer('report_count').notNull(),
    reasons: text('reasons').array().notNull(),
    /** The target is a project collecting contributions (fraud first). */
    fundingActive: boolean('funding_active').notNull(),
    assignedTo: uuid('assigned_to'),
    decisionId: uuid('decision_id'),
    createdAt: timestamptz('created_at').notNull(),
    updatedAt: timestamptz('updated_at').notNull(),
    resolvedAt: timestamptz('resolved_at'),
  },
  (table) => [
    uniqueIndex('cases_open_target_uq')
      .on(table.targetType, table.targetId)
      .where(sql`${table.status} = 'open'`),
    index('cases_queue_idx')
      .on(table.priority.desc(), table.createdAt, table.id)
      .where(sql`${table.status} = 'open'`),
    index('cases_subject_id_idx').on(table.subjectId),
    index('cases_created_at_idx').on(table.createdAt),
  ],
);

/**
 * Report of a member, or notice of illegal content without an account (reporter null, contact
 * optional). A reported message keeps a limited context, never the whole conversation.
 */
export const trustReports = trustSchema.table(
  'reports',
  {
    id: uuid('id').primaryKey(),
    caseId: uuid('case_id')
      .notNull()
      .references(() => trustCases.id, { onDelete: 'cascade' }),
    targetType: text('target_type').notNull(),
    targetId: uuid('target_id').notNull(),
    reason: text('reason').notNull(),
    details: text('details'),
    reporterId: uuid('reporter_id'),
    reporterName: text('reporter_name'),
    reporterEmail: text('reporter_email'),
    /** Language of the emails to a notifier without an account. */
    reporterLocale: text('reporter_locale'),
    messageContext: jsonb('message_context').$type<Record<string, unknown>>(),
    outcome: text('outcome'),
    createdAt: timestamptz('created_at').notNull(),
    resolvedAt: timestamptz('resolved_at'),
  },
  (table) => [
    uniqueIndex('reports_case_reporter_uq')
      .on(table.caseId, table.reporterId)
      .where(sql`${table.reporterId} is not null`),
    index('reports_case_id_idx').on(table.caseId, table.createdAt),
    index('reports_reporter_id_idx').on(table.reporterId, table.createdAt),
    index('reports_created_at_idx').on(table.createdAt),
  ],
);

/** History of the assignments of a case (null moderator: unassigned). */
export const trustAssignments = trustSchema.table(
  'assignments',
  {
    id: uuid('id').primaryKey(),
    caseId: uuid('case_id')
      .notNull()
      .references(() => trustCases.id, { onDelete: 'cascade' }),
    moderatorId: uuid('moderator_id'),
    assignedBy: uuid('assigned_by').notNull(),
    assignedAt: timestamptz('assigned_at').notNull(),
  },
  (table) => [index('assignments_case_id_idx').on(table.caseId, table.assignedAt)],
);

/** Decision with its statement of reasons; reverted when an appeal overturns it. */
export const trustDecisions = trustSchema.table(
  'decisions',
  {
    id: uuid('id').primaryKey(),
    caseId: uuid('case_id')
      .notNull()
      .references(() => trustCases.id, { onDelete: 'cascade' }),
    targetType: text('target_type').notNull(),
    targetId: uuid('target_id').notNull(),
    subjectId: uuid('subject_id'),
    kind: text('kind').notNull(),
    reason: text('reason'),
    statement: text('statement').notNull(),
    ground: text('ground').notNull(),
    groundReference: text('ground_reference'),
    automatedDetection: boolean('automated_detection').notNull(),
    suspensionEndsAt: timestamptz('suspension_ends_at'),
    decidedBy: uuid('decided_by').notNull(),
    decidedAt: timestamptz('decided_at').notNull(),
    appealableUntil: timestamptz('appealable_until'),
    revertedAt: timestamptz('reverted_at'),
  },
  (table) => [
    index('decisions_subject_id_idx').on(table.subjectId, table.decidedAt),
    index('decisions_case_id_idx').on(table.caseId),
    index('decisions_decided_at_idx').on(table.decidedAt),
  ],
);

/** Internal complaint: one per decision, reviewed by someone other than its author. */
export const trustAppeals = trustSchema.table(
  'appeals',
  {
    id: uuid('id').primaryKey(),
    decisionId: uuid('decision_id')
      .notNull()
      .references(() => trustDecisions.id, { onDelete: 'cascade' }),
    appellantId: uuid('appellant_id').notNull(),
    statement: text('statement').notNull(),
    status: text('status').notNull(),
    reviewerId: uuid('reviewer_id'),
    outcomeStatement: text('outcome_statement'),
    createdAt: timestamptz('created_at').notNull(),
    resolvedAt: timestamptz('resolved_at'),
  },
  (table) => [
    uniqueIndex('appeals_decision_id_uq').on(table.decisionId),
    index('appeals_pending_idx')
      .on(table.createdAt)
      .where(sql`${table.status} = 'pending'`),
  ],
);

/** Suspension of an account: temporary (ends_at) or permanent (null), lifted early or not. */
export const trustSuspensions = trustSchema.table(
  'suspensions',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id').notNull(),
    decisionId: uuid('decision_id')
      .notNull()
      .references(() => trustDecisions.id, { onDelete: 'cascade' }),
    startsAt: timestamptz('starts_at').notNull(),
    endsAt: timestamptz('ends_at'),
    liftedAt: timestamptz('lifted_at'),
    liftedBy: uuid('lifted_by'),
    liftStatement: text('lift_statement'),
    /** Set once `trust.suspension.ended.v1` is recorded. */
    endedAt: timestamptz('ended_at'),
  },
  (table) => [
    index('suspensions_user_id_idx')
      .on(table.userId)
      .where(sql`${table.endedAt} is null`),
    index('suspensions_ends_at_idx')
      .on(table.endsAt)
      .where(sql`${table.endedAt} is null and ${table.endsAt} is not null`),
  ],
);

/**
 * Activity counted for the automatic signals (message requests out of network, connection
 * requests), one row per source event; purged after the longest window.
 */
export const trustActivity = trustSchema.table(
  'activity',
  {
    sourceEventId: uuid('source_event_id').primaryKey(),
    userId: uuid('user_id').notNull(),
    kind: text('kind').notNull(),
    occurredAt: timestamptz('occurred_at').notNull(),
  },
  (table) => [index('activity_user_kind_idx').on(table.userId, table.kind, table.occurredAt)],
);
