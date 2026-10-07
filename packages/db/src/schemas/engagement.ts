import { sql } from 'drizzle-orm';
import { bigint, date, index, integer, pgSchema, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const engagementSchema = pgSchema('engagement');

const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
const minorUnits = (name: string) => bigint(name, { mode: 'bigint' });

/**
 * Projection of the collected contributions, rebuilt from the payments facade (ADR 0053):
 * deleting every row and replaying gives the same dashboards. Amounts in EUR minor units.
 */
export const engagementContributionFacts = engagementSchema.table(
  'contribution_facts',
  {
    contributionId: uuid('contribution_id').primaryKey(),
    contributorId: uuid('contributor_id').notNull(),
    organizationId: uuid('organization_id'),
    projectId: uuid('project_id').notNull(),
    status: text('status').notNull(),
    /** EUR equivalent given, net of refunds and lost disputes; 0 before success. */
    netEurMinor: minorUnits('net_eur_minor').notNull(),
    succeededAt: timestamptz('succeeded_at'),
    updatedAt: timestamptz('updated_at').notNull(),
  },
  (table) => [
    index('contribution_facts_contributor_idx').on(table.contributorId, table.succeededAt),
    index('contribution_facts_organization_idx')
      .on(table.organizationId, table.succeededAt)
      .where(sql`${table.organizationId} is not null`),
  ],
);

/** Shared time log (sections 6.3 and 9.4): hours declared, then confirmed or disputed. */
export const engagementTimeEntries = engagementSchema.table(
  'time_entries',
  {
    id: uuid('id').primaryKey(),
    contributorId: uuid('contributor_id').notNull(),
    projectId: uuid('project_id'),
    entrepreneurId: uuid('entrepreneur_id'),
    kind: text('kind').notNull(),
    minutes: integer('minutes').notNull(),
    date: date('date', { mode: 'string' }).notNull(),
    description: text('description').notNull(),
    status: text('status').notNull(),
    respondedAt: timestamptz('responded_at'),
    respondedBy: uuid('responded_by'),
    disputeReason: text('dispute_reason'),
    createdAt: timestamptz('created_at').notNull(),
  },
  (table) => [
    index('time_entries_contributor_idx').on(table.contributorId, table.createdAt, table.id),
    index('time_entries_project_idx')
      .on(table.projectId, table.createdAt, table.id)
      .where(sql`${table.projectId} is not null`),
    index('time_entries_entrepreneur_idx')
      .on(table.entrepreneurId, table.createdAt, table.id)
      .where(sql`${table.entrepreneurId} is not null`),
  ],
);
