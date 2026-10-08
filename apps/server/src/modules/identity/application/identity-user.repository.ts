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
export abstract class IdentityUserRepository {
  abstract findById(id: string): Promise<IdentityUser | null>;
  abstract findByIds(ids: readonly string[]): Promise<IdentityUser[]>;
  abstract findByEmail(email: string): Promise<IdentityUser | null>;
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
  abstract deleteSessions(userId: string): Promise<number>;
}
