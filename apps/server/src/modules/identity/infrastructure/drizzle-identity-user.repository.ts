import { Injectable } from '@nestjs/common';
import { DEFAULT_LOCALE, type Locale, localeSchema } from '@pitchorium/contracts';
import { and, count, eq, inArray, ne } from '@pitchorium/db/orm';
import {
  identityLegalAcceptances,
  identitySessions,
  identityUsers,
} from '@pitchorium/db/schemas/identity';
import { TransactionManager } from '../../../platform/database';
import {
  type IdentityUser,
  type LegalAcceptanceRow,
  IdentityUserRepository,
} from '../application/identity-user.repository';

type UserRow = typeof identityUsers.$inferSelect;

function toUser(row: UserRow): IdentityUser {
  const locale = localeSchema.safeParse(row.locale);
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    emailVerified: row.emailVerified,
    image: row.image,
    locale: locale.success ? locale.data : DEFAULT_LOCALE,
    timeZone: row.timeZone,
    twoFactorEnabled: row.twoFactorEnabled,
    acceptedTermsVersion: row.acceptedTermsVersion,
    acceptedPrivacyVersion: row.acceptedPrivacyVersion,
    adultDeclaredAt: row.adultDeclaredAt,
    createdAt: row.createdAt,
  };
}

@Injectable()
export class DrizzleIdentityUserRepository extends IdentityUserRepository {
  constructor(private readonly transactions: TransactionManager) {
    super();
  }

  private get db() {
    return this.transactions.executor;
  }

  async findById(id: string): Promise<IdentityUser | null> {
    const [row] = await this.db.select().from(identityUsers).where(eq(identityUsers.id, id));
    return row ? toUser(row) : null;
  }

  async findByIds(ids: readonly string[]): Promise<IdentityUser[]> {
    if (ids.length === 0) return [];
    const rows = await this.db
      .select()
      .from(identityUsers)
      .where(inArray(identityUsers.id, [...ids]));
    return rows.map(toUser);
  }

  async findByEmail(email: string): Promise<IdentityUser | null> {
    const [row] = await this.db.select().from(identityUsers).where(eq(identityUsers.email, email));
    return row ? toUser(row) : null;
  }

  async updatePreferences(
    id: string,
    preferences: { locale: Locale; timeZone: string },
    now: Date,
  ): Promise<void> {
    await this.db
      .update(identityUsers)
      .set({ locale: preferences.locale, timeZone: preferences.timeZone, updatedAt: now })
      .where(eq(identityUsers.id, id));
  }

  async recordLegalAcceptance(
    id: string,
    rows: LegalAcceptanceRow[],
    versions: { termsVersion: string; privacyVersion: string },
    now: Date,
  ): Promise<void> {
    await this.db
      .insert(identityLegalAcceptances)
      .values(rows.map((row) => ({ ...row, userId: id, acceptedAt: now })));
    await this.db
      .update(identityUsers)
      .set({
        acceptedTermsVersion: versions.termsVersion,
        acceptedPrivacyVersion: versions.privacyVersion,
        adultDeclaredAt: now,
        updatedAt: now,
      })
      .where(eq(identityUsers.id, id));
  }

  async otherSessionUserAgents(userId: string, exceptSessionId: string): Promise<string[]> {
    const rows = await this.db
      .select({ userAgent: identitySessions.userAgent })
      .from(identitySessions)
      .where(and(eq(identitySessions.userId, userId), ne(identitySessions.id, exceptSessionId)));
    return rows.map((row) => row.userAgent ?? '');
  }

  async countSessions(userId: string): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(identitySessions)
      .where(eq(identitySessions.userId, userId));
    return row?.value ?? 0;
  }

  async deleteSessions(userId: string): Promise<number> {
    const deleted = await this.db
      .delete(identitySessions)
      .where(eq(identitySessions.userId, userId))
      .returning({ id: identitySessions.id });
    return deleted.length;
  }
}
