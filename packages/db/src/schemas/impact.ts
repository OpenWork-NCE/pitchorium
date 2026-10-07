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

export const impactSchema = pgSchema('impact');

const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

export interface ImpactScaleLevelRecord {
  key: string;
  labelKey: string;
  value: number;
}

export interface ImpactCriterionRecord {
  key: string;
  labelKey: string;
  descriptionKey: string;
  weight: number;
  scale: ImpactScaleLevelRecord[];
}

/**
 * Versions of the self-declared impact methodology (§12). A published or archived version never
 * changes; at most one version is published at a time.
 */
export const impactMethodologies = impactSchema.table(
  'methodologies',
  {
    id: uuid('id').primaryKey(),
    version: integer('version').notNull(),
    name: text('name').notNull(),
    status: text('status').notNull(),
    /** Fictitious methodology of the development data, refused in production. */
    demo: boolean('demo').notNull(),
    criteria: jsonb('criteria').$type<ImpactCriterionRecord[]>().notNull(),
    /** Null for the development data. */
    createdBy: uuid('created_by'),
    createdAt: timestamptz('created_at').notNull(),
    updatedAt: timestamptz('updated_at').notNull(),
    publishedAt: timestamptz('published_at'),
    archivedAt: timestamptz('archived_at'),
  },
  (table) => [
    uniqueIndex('methodologies_version_uq').on(table.version),
    uniqueIndex('methodologies_published_uq')
      .on(table.status)
      .where(sql`${table.status} = 'published'`),
  ],
);

/**
 * Assessments, append-only: each submission is kept for the history of its subject (the
 * entrepreneur facet of a member, a project); the latest one is the current one.
 */
export const impactAssessments = impactSchema.table(
  'assessments',
  {
    id: uuid('id').primaryKey(),
    subjectType: text('subject_type').notNull(),
    /** User id for an entrepreneur facet, project id for a project (no cross-module FK). */
    subjectId: uuid('subject_id').notNull(),
    methodologyId: uuid('methodology_id')
      .notNull()
      .references(() => impactMethodologies.id),
    /** Level key by criterion key. */
    answers: jsonb('answers').$type<Record<string, string>>().notNull(),
    score: integer('score').notNull(),
    level: text('level').notNull(),
    source: text('source').notNull(),
    submittedBy: uuid('submitted_by').notNull(),
    submittedAt: timestamptz('submitted_at').notNull(),
  },
  (table) => [
    index('assessments_subject_idx').on(
      table.subjectType,
      table.subjectId,
      table.submittedAt,
      table.id,
    ),
  ],
);
