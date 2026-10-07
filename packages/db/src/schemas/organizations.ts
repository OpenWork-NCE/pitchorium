import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const organizationsSchema = pgSchema('organizations');

const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

/** Organization pages (§10.7). Media ids and user ids belong to other modules (no FK). */
export const organizationsOrganizations = organizationsSchema.table(
  'organizations',
  {
    id: uuid('id').primaryKey(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    structureType: text('structure_type').notNull(),
    description: text('description'),
    countryCodes: text('country_codes').array().notNull(),
    sectorCodes: text('sector_codes').array().notNull(),
    websiteUrl: text('website_url'),
    foundedYear: integer('founded_year'),
    logoMediaId: uuid('logo_media_id'),
    coverMediaId: uuid('cover_media_id'),
    verificationStatus: text('verification_status').notNull(),
    verifiedAt: timestamptz('verified_at'),
    createdBy: uuid('created_by').notNull(),
    createdAt: timestamptz('created_at').notNull(),
    updatedAt: timestamptz('updated_at').notNull(),
    deletedAt: timestamptz('deleted_at'),
  },
  (table) => [
    uniqueIndex('organizations_slug_uq').on(table.slug),
    index('organizations_created_by_idx')
      .on(table.createdBy)
      .where(sql`${table.deletedAt} is null`),
  ],
);

/** Former slugs, kept for redirects and never given to another organization. */
export const organizationsSlugHistory = organizationsSchema.table(
  'slug_history',
  {
    slug: text('slug').primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizationsOrganizations.id, { onDelete: 'cascade' }),
    replacedAt: timestamptz('replaced_at').notNull(),
  },
  (table) => [index('slug_history_organization_id_idx').on(table.organizationId)],
);

export const organizationsMembers = organizationsSchema.table(
  'members',
  {
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizationsOrganizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull(),
    role: text('role').notNull(),
    joinedAt: timestamptz('joined_at').notNull(),
  },
  (table) => [
    primaryKey({ name: 'members_pk', columns: [table.organizationId, table.userId] }),
    index('members_user_id_idx').on(table.userId),
  ],
);

/** Invitations by email; only the hash of the single-use token is stored. */
export const organizationsInvitations = organizationsSchema.table(
  'invitations',
  {
    id: uuid('id').primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizationsOrganizations.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: text('role').notNull(),
    status: text('status').notNull(),
    tokenHash: text('token_hash'),
    invitedBy: uuid('invited_by').notNull(),
    expiresAt: timestamptz('expires_at').notNull(),
    createdAt: timestamptz('created_at').notNull(),
    respondedAt: timestamptz('responded_at'),
    respondedBy: uuid('responded_by'),
  },
  (table) => [
    uniqueIndex('invitations_token_hash_uq').on(table.tokenHash),
    uniqueIndex('invitations_pending_email_uq')
      .on(table.organizationId, table.email)
      .where(sql`${table.status} = 'pending'`),
  ],
);

export interface VerificationSignalsRecord {
  websiteDomain: string | null;
  memberEmailOnWebsiteDomain: boolean;
}

export const organizationsVerificationRequests = organizationsSchema.table(
  'verification_requests',
  {
    id: uuid('id').primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizationsOrganizations.id, { onDelete: 'cascade' }),
    requestedBy: uuid('requested_by').notNull(),
    declaration: text('declaration').notNull(),
    documentMediaIds: uuid('document_media_ids').array().notNull(),
    signals: jsonb('signals').$type<VerificationSignalsRecord>().notNull(),
    status: text('status').notNull(),
    criteriaMet: text('criteria_met').array().notNull(),
    decisionReason: text('decision_reason'),
    decidedBy: uuid('decided_by'),
    createdAt: timestamptz('created_at').notNull(),
    decidedAt: timestamptz('decided_at'),
  },
  (table) => [
    index('verification_requests_status_idx').on(table.status, table.createdAt),
    uniqueIndex('verification_requests_pending_uq')
      .on(table.organizationId)
      .where(sql`${table.status} = 'pending'`),
  ],
);
