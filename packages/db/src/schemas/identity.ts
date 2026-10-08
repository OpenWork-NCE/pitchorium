import {
  boolean,
  index,
  integer,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const identitySchema = pgSchema('identity');

const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

/**
 * Better Auth "user" model. Column keys follow Better Auth field names; extra fields are declared
 * as additional fields in the identity module.
 */
export const identityUsers = identitySchema.table(
  'users',
  {
    id: uuid('id').primaryKey(),
    name: text('name').notNull(),
    // Lower-cased by Better Auth before every write and lookup.
    email: text('email').notNull(),
    emailVerified: boolean('email_verified').notNull(),
    image: text('image'),
    locale: text('locale').notNull(),
    /** IANA time zone of the member (digests, ADR 0061). */
    timeZone: text('time_zone').notNull().default('UTC'),
    twoFactorEnabled: boolean('two_factor_enabled').notNull().default(false),
    // Last accepted versions; the full history is in legal_acceptances.
    acceptedTermsVersion: text('accepted_terms_version'),
    acceptedPrivacyVersion: text('accepted_privacy_version'),
    adultDeclaredAt: timestamptz('adult_declared_at'),
    createdAt: timestamptz('created_at').notNull(),
    updatedAt: timestamptz('updated_at').notNull(),
  },
  (table) => [uniqueIndex('users_email_uq').on(table.email)],
);

export const identitySessions = identitySchema.table(
  'sessions',
  {
    id: uuid('id').primaryKey(),
    token: text('token').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => identityUsers.id, { onDelete: 'cascade' }),
    expiresAt: timestamptz('expires_at').notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamptz('created_at').notNull(),
    updatedAt: timestamptz('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('sessions_token_uq').on(table.token),
    index('sessions_user_id_idx').on(table.userId),
  ],
);

/** One row per sign-in method: `credential` (password) or an OAuth provider. */
export const identityAccounts = identitySchema.table(
  'accounts',
  {
    id: uuid('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => identityUsers.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamptz('access_token_expires_at'),
    refreshTokenExpiresAt: timestamptz('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamptz('created_at').notNull(),
    updatedAt: timestamptz('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('accounts_provider_account_uq').on(table.providerId, table.accountId),
    index('accounts_user_id_idx').on(table.userId),
  ],
);

/** Short-lived tokens: magic links, password resets, OAuth state. */
export const identityVerifications = identitySchema.table(
  'verifications',
  {
    id: uuid('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamptz('expires_at').notNull(),
    createdAt: timestamptz('created_at').notNull(),
    updatedAt: timestamptz('updated_at').notNull(),
  },
  (table) => [index('verifications_identifier_idx').on(table.identifier)],
);

/** TOTP secret and backup codes, encrypted by Better Auth. */
export const identityTwoFactors = identitySchema.table(
  'two_factors',
  {
    id: uuid('id').primaryKey(),
    secret: text('secret').notNull(),
    backupCodes: text('backup_codes').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => identityUsers.id, { onDelete: 'cascade' }),
    verified: boolean('verified').notNull().default(true),
    failedVerificationCount: integer('failed_verification_count').notNull().default(0),
    lockedUntil: timestamptz('locked_until'),
  },
  (table) => [
    index('two_factors_user_id_idx').on(table.userId),
    index('two_factors_secret_idx').on(table.secret),
  ],
);

/**
 * Append-only history of legal acceptances (terms, privacy policy, age declaration). Kept as
 * proof after the erasure of the account, pseudonymized: no foreign key to the user.
 */
export const identityLegalAcceptances = identitySchema.table(
  'legal_acceptances',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id').notNull(),
    document: text('document').notNull(),
    version: text('version').notNull(),
    acceptedAt: timestamptz('accepted_at').notNull(),
  },
  (table) => [index('legal_acceptances_user_id_idx').on(table.userId, table.acceptedAt)],
);
