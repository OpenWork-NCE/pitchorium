import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  date,
  index,
  integer,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const projectsSchema = pgSchema('projects');

const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
const minorUnits = (name: string) => bigint(name, { mode: 'bigint' });

/**
 * Projects and campaigns (§11). Members, organizations and media are identifiers of other
 * modules (no cross-module FK). Amounts are in minor units of `currency` (ADR 0007).
 */
export const projectsProjects = projectsSchema.table(
  'projects',
  {
    id: uuid('id').primaryKey(),
    slug: text('slug').notNull(),
    ownerId: uuid('owner_id').notNull(),
    organizationId: uuid('organization_id'),
    title: text('title').notNull(),
    summary: text('summary'),
    description: text('description'),
    sectorCode: text('sector_code'),
    impactArea: text('impact_area'),
    countryCodes: text('country_codes').array().notNull(),
    videoProvider: text('video_provider'),
    videoId: text('video_id'),
    /** Private Vimeo link hash, part of the embed URL. */
    videoHash: text('video_hash'),
    instruments: text('instruments').array().notNull(),
    opensCapital: boolean('opens_capital').notNull(),
    currency: text('currency').notNull(),
    goalMinor: minorUnits('goal_minor'),
    durationDays: integer('duration_days'),
    galleryMediaIds: uuid('gallery_media_ids').array().notNull(),
    documentMediaIds: uuid('document_media_ids').array().notNull(),
    status: text('status').notNull(),
    collectedMinor: minorUnits('collected_minor').notNull(),
    contributionCount: integer('contribution_count').notNull(),
    /** Set by the first paid contribution: amounts are locked from then on. */
    firstContributionAt: timestamptz('first_contribution_at'),
    publicDisplayConsentAt: timestamptz('public_display_consent_at'),
    publicDisplayConsentBy: uuid('public_display_consent_by'),
    /** Current self-declared score, copied from the impact module at each assessment. */
    impactScore: integer('impact_score'),
    impactLevel: text('impact_level'),
    impactMethodologyVersion: integer('impact_methodology_version'),
    moderationStatus: text('moderation_status').notNull(),
    featuredAt: timestamptz('featured_at'),
    featuredBy: uuid('featured_by'),
    publishedAt: timestamptz('published_at'),
    endsAt: timestamptz('ends_at'),
    fundedAt: timestamptz('funded_at'),
    closedAt: timestamptz('closed_at'),
    endingSoonAt: timestamptz('ending_soon_at'),
    createdAt: timestamptz('created_at').notNull(),
    updatedAt: timestamptz('updated_at').notNull(),
    deletedAt: timestamptz('deleted_at'),
  },
  (table) => [
    uniqueIndex('projects_slug_uq').on(table.slug),
    index('projects_owner_id_idx').on(table.ownerId),
    index('projects_organization_id_idx')
      .on(table.organizationId)
      .where(sql`${table.organizationId} is not null`),
    index('projects_showcase_idx')
      .on(table.publishedAt, table.id)
      .where(
        sql`${table.status} <> 'draft' and ${table.deletedAt} is null and ${table.moderationStatus} = 'visible'`,
      ),
    index('projects_open_ends_at_idx')
      .on(table.endsAt, table.id)
      .where(sql`${table.status} in ('funding', 'funded') and ${table.deletedAt} is null`),
  ],
);

/** Former slugs, kept for redirects and never given to another project. */
export const projectsSlugHistory = projectsSchema.table(
  'slug_history',
  {
    slug: text('slug').primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projectsProjects.id, { onDelete: 'cascade' }),
    replacedAt: timestamptz('replaced_at').notNull(),
  },
  (table) => [index('slug_history_project_id_idx').on(table.projectId)],
);

/** Team: `invited` until the member accepts (with their public display consent), then `active`. */
export const projectsTeamMembers = projectsSchema.table(
  'team_members',
  {
    projectId: uuid('project_id')
      .notNull()
      .references(() => projectsProjects.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull(),
    role: text('role').notNull(),
    function: text('function'),
    status: text('status').notNull(),
    invitedBy: uuid('invited_by'),
    invitedAt: timestamptz('invited_at').notNull(),
    joinedAt: timestamptz('joined_at'),
    publicDisplayConsentAt: timestamptz('public_display_consent_at'),
  },
  (table) => [
    primaryKey({ name: 'team_members_pk', columns: [table.projectId, table.userId] }),
    index('team_members_user_id_idx').on(table.userId, table.status),
  ],
);

/** 1 to 5 tiers with cumulative thresholds, the last one equal to the goal (ADR 0038). */
export const projectsTiers = projectsSchema.table(
  'tiers',
  {
    id: uuid('id').primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projectsProjects.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    thresholdMinor: minorUnits('threshold_minor').notNull(),
    description: text('description').notNull(),
    unlockedAt: timestamptz('unlocked_at'),
  },
  (table) => [uniqueIndex('tiers_project_position_uq').on(table.projectId, table.position)],
);

/** Rewards; a limited quantity is tracked by reservation (ADR 0041). */
export const projectsRewards = projectsSchema.table(
  'rewards',
  {
    id: uuid('id').primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projectsProjects.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description').notNull(),
    minAmountMinor: minorUnits('min_amount_minor').notNull(),
    instruments: text('instruments').array().notNull(),
    /** Null: unlimited. */
    quantity: integer('quantity'),
    reserved: integer('reserved').notNull(),
    confirmed: integer('confirmed').notNull(),
    estimatedDelivery: date('estimated_delivery', { mode: 'string' }),
    createdAt: timestamptz('created_at').notNull(),
    updatedAt: timestamptz('updated_at').notNull(),
  },
  (table) => [index('rewards_project_id_idx').on(table.projectId, table.createdAt)],
);

/** One reservation per contribution (payments module), idempotent by its identifier. */
export const projectsRewardReservations = projectsSchema.table(
  'reward_reservations',
  {
    contributionId: uuid('contribution_id').primaryKey(),
    rewardId: uuid('reward_id')
      .notNull()
      .references(() => projectsRewards.id, { onDelete: 'cascade' }),
    status: text('status').notNull(),
    createdAt: timestamptz('created_at').notNull(),
    updatedAt: timestamptz('updated_at').notNull(),
  },
  (table) => [index('reward_reservations_reward_id_idx').on(table.rewardId)],
);

/** Paid contributions applied to the collected amount, idempotent by contribution. */
export const projectsFundingEntries = projectsSchema.table(
  'funding_entries',
  {
    contributionId: uuid('contribution_id').primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projectsProjects.id, { onDelete: 'cascade' }),
    amountMinor: minorUnits('amount_minor').notNull(),
    currency: text('currency').notNull(),
    appliedAt: timestamptz('applied_at').notNull(),
    reversedAt: timestamptz('reversed_at'),
  },
  (table) => [index('funding_entries_project_id_idx').on(table.projectId)],
);

/** Campaign updates (§11.3), shown in the feed of the followers of the project. */
export const projectsUpdates = projectsSchema.table(
  'updates',
  {
    id: uuid('id').primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projectsProjects.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id').notNull(),
    text: text('text').notNull(),
    imageMediaIds: uuid('image_media_ids').array().notNull(),
    moderationStatus: text('moderation_status').notNull(),
    publishedAt: timestamptz('published_at').notNull(),
    editedAt: timestamptz('edited_at'),
    deletedAt: timestamptz('deleted_at'),
  },
  (table) => [
    index('updates_project_feed_idx')
      .on(table.projectId, table.publishedAt, table.id)
      .where(sql`${table.deletedAt} is null and ${table.moderationStatus} = 'visible'`),
  ],
);

/** Expressions of interest (§9.1, §11.2): message and indicative amount, no payment. */
export const projectsInterests = projectsSchema.table(
  'interests',
  {
    id: uuid('id').primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projectsProjects.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull(),
    kind: text('kind').notNull(),
    message: text('message').notNull(),
    indicativeAmountMinor: minorUnits('indicative_amount_minor'),
    indicativeCurrency: text('indicative_currency'),
    documentMediaIds: uuid('document_media_ids').array().notNull(),
    createdAt: timestamptz('created_at').notNull(),
  },
  (table) => [index('interests_project_idx').on(table.projectId, table.createdAt, table.id)],
);
