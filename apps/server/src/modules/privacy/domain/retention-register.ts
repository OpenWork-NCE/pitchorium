/**
 * Register of the retention of personal data, every module in one place (GDPR article 5(1)(e)),
 * consolidated in docs/compliance/retention.md. A duration that the law or the client must set
 * names its open question; nothing is invented.
 */
export interface RetentionEntry {
  /** Module, or `platform` for technical stores. */
  module: string;
  data: string;
  retention: string;
  /** What happens at the end: deletion, pseudonymization, purge. */
  end: string;
  /** Number of the open question when the duration is not decided. */
  openQuestion?: number;
}

export const RETENTION_REGISTER: readonly RetentionEntry[] = [
  {
    module: 'identity',
    data: 'Account, sign-in methods',
    retention: 'Until the erasure of the account',
    end: 'Deleted',
  },
  {
    module: 'identity',
    data: 'Sessions (device, address)',
    retention: '30 days, extended on each day of use',
    end: 'Expired, deleted at the erasure',
  },
  {
    module: 'identity',
    data: 'Verification and magic link tokens',
    retention: '24 hours (email), 30 minutes (password reset)',
    end: 'Expired, deleted at the erasure',
  },
  {
    module: 'identity',
    data: 'Legal acceptances',
    retention: 'Proof, beyond the erasure',
    end: 'Pseudonymized at the erasure',
    openQuestion: 20,
  },
  {
    module: 'access',
    data: 'Platform roles',
    retention: 'Until withdrawn or the erasure',
    end: 'Deleted',
  },
  {
    module: 'profiles',
    data: 'Profile, facets, former handles',
    retention: 'Until the erasure',
    end: 'Deleted',
  },
  {
    module: 'organizations',
    data: 'Memberships, invitations',
    retention: 'Until left or the erasure; invitations 7 days',
    end: 'Deleted, traces pseudonymized',
  },
  {
    module: 'media',
    data: 'Files',
    retention: 'Until deleted by the owner or the erasure; unattached files 24 hours',
    end: 'Deleted and purged from the CDN; financial proofs pseudonymized',
  },
  {
    module: 'network',
    data: 'Follows, connections, requests, blocks',
    retention: 'Until removed or the erasure; pending requests 30 days',
    end: 'Deleted',
  },
  {
    module: 'network',
    data: 'Profile views',
    retention: '90 days (NETWORK_PROFILE_VIEWS_RETENTION_DAYS)',
    end: 'Deleted',
    openQuestion: 40,
  },
  {
    module: 'content',
    data: 'Publications, comments, reactions',
    retention: 'Until deleted by the author or the erasure',
    end: 'Deleted; an answered comment becomes a tombstone',
  },
  {
    module: 'projects',
    data: 'Projects, teams, updates, interests',
    retention: 'Until deleted or the erasure',
    end: 'Deleted, or kept under the pseudonym when contributions exist',
  },
  {
    module: 'impact',
    data: 'Self-declared assessments',
    retention: 'Until the erasure',
    end: 'Deleted; those of a project pseudonymized',
  },
  {
    module: 'payments',
    data: 'Contributions, ledger, payout accounts, KYC and its documents, off-platform contributions',
    retention: 'Legal obligations (accounting, anti-money laundering)',
    end: 'Pseudonymized at the erasure, amounts kept',
    openQuestion: 85,
  },
  {
    module: 'engagement',
    data: 'Contribution projection, time log',
    retention: 'As the contributions; time entries until the erasure',
    end: 'Pseudonymized',
  },
  {
    module: 'messaging',
    data: 'Messages, conversations, introductions',
    retention: 'Until the erasure',
    end: 'Tombstones under the pseudonym',
    openQuestion: 69,
  },
  {
    module: 'notifications',
    data: 'Notifications',
    retention: '90 days without activity (NOTIFICATIONS_RETENTION_DAYS)',
    end: 'Deleted',
    openQuestion: 73,
  },
  {
    module: 'notifications',
    data: 'Email suppression list',
    retention: 'Indefinite, to honor a bounce or a complaint',
    end: 'Fingerprint only after the erasure',
    openQuestion: 73,
  },
  {
    module: 'discovery',
    data: 'Search index, matching profiles, suggestions',
    retention: 'Projection of the source modules',
    end: 'Deleted with the source',
  },
  {
    module: 'events',
    data: 'Events organized, registrations, calendar token',
    retention: 'Until the erasure',
    end: 'Deleted; past events pseudonymized',
  },
  {
    module: 'missions',
    data: 'Missions, engagements',
    retention: 'Until the erasure',
    end: 'Pseudonymized',
  },
  {
    module: 'trust',
    data: 'Reports, notifier contacts, decisions, appeals, suspensions',
    retention: 'Evidence, beyond the erasure',
    end: 'Pseudonymized; contacts erased',
    openQuestion: 84,
  },
  { module: 'trust', data: 'Activity counted by the signals', retention: '7 days', end: 'Deleted' },
  {
    module: 'localization',
    data: 'Machine translations in cache',
    retention: '30 days (LOCALIZATION_CACHE_TTL_DAYS), invalidated by a modification',
    end: 'Deleted; the one of a profile at the erasure',
  },
  {
    module: 'localization',
    data: 'Characters translated per member and day',
    retention: 'Until the erasure',
    end: 'Deleted',
  },
  {
    module: 'privacy',
    data: 'Export archives',
    retention: '72 hours (PRIVACY_EXPORT_TTL_HOURS)',
    end: 'Deleted',
  },
  {
    module: 'privacy',
    data: 'Rights requests',
    retention: 'Evidence of the answer',
    end: 'Pseudonymized once completed',
    openQuestion: 20,
  },
  {
    module: 'platform',
    data: 'Audit log',
    retention: 'Evidence',
    end: 'Pseudonymized at the erasure',
    openQuestion: 20,
  },
  {
    module: 'platform',
    data: 'Outbox events and inbox messages',
    retention: '30 days after processing (OUTBOX_RETENTION_DAYS)',
    end: 'Deleted',
  },
  {
    module: 'platform',
    data: 'Idempotent answers',
    retention: '24 hours (IDEMPOTENCY_TTL_HOURS)',
    end: 'Deleted',
  },
  {
    module: 'platform',
    data: 'Queue jobs (Redis)',
    retention: 'Completed 24 hours, failed 7 days',
    end: 'Removed by BullMQ',
  },
  {
    module: 'platform',
    data: 'Backups, application logs, error reports',
    retention: 'Set with the host and the tools',
    end: 'Expired',
    openQuestion: 24,
  },
];
