import { sql } from 'drizzle-orm';
import {
  date,
  index,
  integer,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const missionsSchema = pgSchema('missions');

const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

/**
 * Volunteer expertise missions (§6.3, §14, ADR 0071): offers of experts and mentors, requests
 * of entrepreneurs and project teams. No amount, no contract: missions are not jobs.
 */
export const missionsMissions = missionsSchema.table(
  'missions',
  {
    id: uuid('id').primaryKey(),
    direction: text('direction').notNull(),
    authorId: uuid('author_id').notNull(),
    /** Request of a project team. */
    projectId: uuid('project_id'),
    title: text('title').notNull(),
    description: text('description').notNull(),
    kind: text('kind').notNull(),
    domain: text('domain').notNull(),
    sectorCodes: text('sector_codes').array().notNull(),
    format: text('format').notNull(),
    estimatedHours: integer('estimated_hours').notNull(),
    mode: text('mode').notNull(),
    countryCodes: text('country_codes').array().notNull(),
    languages: text('languages').array().notNull(),
    capacity: integer('capacity').notNull(),
    skills: text('skills').array().notNull(),
    desiredBy: date('desired_by', { mode: 'string' }),
    visibility: text('visibility').notNull(),
    status: text('status').notNull(),
    moderationStatus: text('moderation_status').notNull(),
    /** Engagements accepted and not ended. */
    activeEngagements: integer('active_engagements').notNull(),
    publishedAt: timestamptz('published_at').notNull(),
    closedAt: timestamptz('closed_at'),
    createdAt: timestamptz('created_at').notNull(),
    updatedAt: timestamptz('updated_at').notNull(),
  },
  (table) => [
    index('missions_open_idx')
      .on(table.publishedAt, table.id)
      .where(sql`${table.status} = 'open' and ${table.moderationStatus} = 'visible'`),
    index('missions_author_id_idx').on(table.authorId, table.publishedAt),
    index('missions_project_id_idx')
      .on(table.projectId)
      .where(sql`${table.projectId} is not null`),
  ],
);

/**
 * Engagement on a mission between the expert, who gives the time, and the beneficiary: asked,
 * answered by the author of the mission, in progress, then completed (time declared in the
 * engagement module) or canceled.
 */
export const missionsEngagements = missionsSchema.table(
  'engagements',
  {
    id: uuid('id').primaryKey(),
    missionId: uuid('mission_id')
      .notNull()
      .references(() => missionsMissions.id, { onDelete: 'cascade' }),
    expertId: uuid('expert_id').notNull(),
    beneficiaryId: uuid('beneficiary_id').notNull(),
    projectId: uuid('project_id'),
    status: text('status').notNull(),
    message: text('message').notNull(),
    answerMessage: text('answer_message'),
    /** Time entry of the engagement module, declared at completion. */
    timeEntryId: uuid('time_entry_id'),
    requestedAt: timestamptz('requested_at').notNull(),
    answeredAt: timestamptz('answered_at'),
    endedAt: timestamptz('ended_at'),
    updatedAt: timestamptz('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('engagements_open_uq')
      .on(table.missionId, table.expertId, table.beneficiaryId)
      .where(sql`${table.status} in ('requested', 'accepted')`),
    index('engagements_mission_id_idx').on(table.missionId, table.status, table.requestedAt),
    index('engagements_expert_id_idx').on(table.expertId, table.requestedAt),
    index('engagements_beneficiary_id_idx').on(table.beneficiaryId, table.requestedAt),
  ],
);
