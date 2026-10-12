import type { LegalDocument, Locale } from '@pitchorium/contracts';
import type { LegalRecord } from '../domain/legal';

export interface IdentityUser extends LegalRecord {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  locale: Locale;
  /** IANA time zone (digests). */
  timeZone: string;
  twoFactorEnabled: boolean;
  createdAt: Date;
}

export interface LegalAcceptanceRow {
  id: string;
  document: LegalDocument;
  version: string;
}

/** Port: identity data outside of what Better Auth manages through its own adapter. */
/** A session as the administration sees it: its device and its activity, never its token. */
export interface IdentitySession {
  id: string;
  userAgent: string | null;
  createdAt: Date;
  lastActiveAt: Date;
  expiresAt: Date;
}

export abstract class IdentityUserRepository {
  abstract findById(id: string): Promise<IdentityUser | null>;
  abstract findByIds(ids: readonly string[]): Promise<IdentityUser[]>;
  abstract findByEmail(email: string): Promise<IdentityUser | null>;
  /** Accounts whose email or name contains the text, by email then id (administration). */
  abstract search(
    text: string,
    after: { email: string; id: string } | null,
    limit: number,
  ): Promise<IdentityUser[]>;
  /** Accounts, and those with a session used since the date. */
  abstract counts(activeSince: Date): Promise<{ total: number; active: number }>;
  abstract updatePreferences(
    id: string,
    preferences: { locale: Locale; timeZone: string },
    now: Date,
  ): Promise<void>;
  abstract recordLegalAcceptance(
    id: string,
    rows: LegalAcceptanceRow[],
    versions: { termsVersion: string; privacyVersion: string },
    now: Date,
  ): Promise<void>;
  /** User agents of the user's sessions other than `exceptSessionId`. */
  abstract otherSessionUserAgents(userId: string, exceptSessionId: string): Promise<string[]>;
  abstract countSessions(userId: string): Promise<number>;
  /** Sessions still valid, the most recently used first (administration). */
  abstract sessionsOf(userId: string, now: Date): Promise<IdentitySession[]>;
  abstract deleteSessions(userId: string): Promise<number>;
}
