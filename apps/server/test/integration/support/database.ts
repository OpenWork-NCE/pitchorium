import { createDatabase } from '@pitchorium/db';
import { inject } from 'vitest';

const PLATFORM_TABLES = ['outbox_events', 'inbox_messages', 'idempotency_keys', 'audit_log'];

/** Business data written by the tests; reference data and feature flags are seeded once. */
const BUSINESS_TABLES = [
  'organizations.organizations',
  'identity.users',
  'access.role_assignments',
  'profiles.profiles',
  'media.assets',
  'network.follows',
  'network.connections',
  'network.connection_requests',
  'network.blocks',
  'network.settings',
  'network.profile_views',
  'content.posts',
  'content.reactions',
  'impact.methodologies',
  'impact.assessments',
  'projects.projects',
  'payments.contributions',
  'payments.payout_accounts',
  'payments.kyc_submissions',
  'payments.ledger_entries',
  'payments.offline_contributions',
  'payments.provider_events',
  'payments.reconciliation_runs',
  'payments.discrepancies',
  'payments.simulated_sessions',
  'payments.simulated_accounts',
  'engagement.contribution_facts',
  'engagement.time_entries',
  'messaging.conversations',
  'messaging.participants',
  'messaging.messages',
  'messaging.introductions',
  'messaging.settings',
  'notifications.notifications',
  'notifications.deliveries',
  'notifications.preferences',
  'notifications.settings',
  'notifications.suppressions',
  'notifications.unread_message_emails',
  'events.events',
  'events.calendar_tokens',
  'missions.missions',
  'discovery.search_documents',
  'discovery.match_profiles',
  'discovery.suggestions',
  'discovery.dismissals',
  'trust.cases',
  'trust.activity',
  'privacy.exports',
  'privacy.erasures',
  'identity.legal_acceptances',
  'localization.translations',
  'localization.usage',
  'localization.monthly_usage',
  'localization.glossary_terms',
];

export async function truncatePlatformTables(): Promise<void> {
  const { pool } = createDatabase({ url: inject('databaseUrl'), maxConnections: 1 });
  try {
    await pool.query(`TRUNCATE ${PLATFORM_TABLES.map((table) => `platform.${table}`).join(', ')}`);
  } finally {
    await pool.end();
  }
}

export async function truncateAllTables(): Promise<void> {
  const { pool } = createDatabase({ url: inject('databaseUrl'), maxConnections: 1 });
  try {
    const tables = [...PLATFORM_TABLES.map((table) => `platform.${table}`), ...BUSINESS_TABLES];
    await pool.query(`TRUNCATE ${tables.join(', ')} CASCADE`);
  } finally {
    await pool.end();
  }
}

/** Direct SQL for assertions on rows the api does not expose. */
export async function query<T extends Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const { pool } = createDatabase({ url: inject('databaseUrl'), maxConnections: 1 });
  try {
    return (await pool.query<T>(sql, params)).rows;
  } finally {
    await pool.end();
  }
}
