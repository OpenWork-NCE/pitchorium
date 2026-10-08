import { Injectable } from '@nestjs/common';
import type { TranslationProviderId } from '@pitchorium/contracts';
import { and, asc, eq, lte, sql } from '@pitchorium/db/orm';
import {
  localizationGlossaryTerms,
  localizationMonthlyUsage,
  localizationTranslations,
  localizationUsage,
} from '@pitchorium/db/schemas/localization';
import { TransactionManager } from '../../../platform/database';
import {
  type CachedTranslation,
  type GlossaryTermRecord,
  LocalizationRepository,
} from '../application/ports';

@Injectable()
export class DrizzleLocalizationRepository extends LocalizationRepository {
  constructor(private readonly transactions: TransactionManager) {
    super();
  }

  private get db() {
    return this.transactions.executor;
  }

  async findTranslation(
    sourceType: string,
    sourceKey: string,
    targetLocale: string,
  ): Promise<CachedTranslation | null> {
    const [row] = await this.db
      .select()
      .from(localizationTranslations)
      .where(
        and(
          eq(localizationTranslations.sourceType, sourceType),
          eq(localizationTranslations.sourceKey, sourceKey),
          eq(localizationTranslations.targetLocale, targetLocale),
        ),
      );
    return row ? { ...row, provider: row.provider as TranslationProviderId } : null;
  }

  async saveTranslation(translation: CachedTranslation): Promise<void> {
    await this.db
      .insert(localizationTranslations)
      .values(translation)
      .onConflictDoUpdate({
        target: [
          localizationTranslations.sourceType,
          localizationTranslations.sourceKey,
          localizationTranslations.targetLocale,
        ],
        set: {
          contentHash: translation.contentHash,
          sourceLanguage: translation.sourceLanguage,
          provider: translation.provider,
          fields: translation.fields,
          createdAt: translation.createdAt,
          expiresAt: translation.expiresAt,
        },
      });
  }

  async deleteTranslations(sourceType: string, sourceKey: string): Promise<number> {
    const rows = await this.db
      .delete(localizationTranslations)
      .where(
        and(
          eq(localizationTranslations.sourceType, sourceType),
          eq(localizationTranslations.sourceKey, sourceKey),
        ),
      )
      .returning({ key: localizationTranslations.sourceKey });
    return rows.length;
  }

  async purgeExpired(now: Date): Promise<number> {
    const rows = await this.db
      .delete(localizationTranslations)
      .where(lte(localizationTranslations.expiresAt, now))
      .returning({ key: localizationTranslations.sourceKey });
    return rows.length;
  }

  async memberUsage(userId: string, day: string): Promise<number> {
    const [row] = await this.db
      .select({ characters: localizationUsage.characters })
      .from(localizationUsage)
      .where(and(eq(localizationUsage.userId, userId), eq(localizationUsage.day, day)));
    return row?.characters ?? 0;
  }

  async monthUsage(month: string): Promise<{ characters: number; warnedAt: Date | null }> {
    const [row] = await this.db
      .select()
      .from(localizationMonthlyUsage)
      .where(eq(localizationMonthlyUsage.month, month));
    return { characters: row?.characters ?? 0, warnedAt: row?.warnedAt ?? null };
  }

  async addUsage(userId: string, day: string, month: string, characters: number): Promise<number> {
    await this.db
      .insert(localizationUsage)
      .values({ userId, day, characters })
      .onConflictDoUpdate({
        target: [localizationUsage.userId, localizationUsage.day],
        set: { characters: sql`${localizationUsage.characters} + ${characters}` },
      });
    const [row] = await this.db
      .insert(localizationMonthlyUsage)
      .values({ month, characters })
      .onConflictDoUpdate({
        target: localizationMonthlyUsage.month,
        set: { characters: sql`${localizationMonthlyUsage.characters} + ${characters}` },
      })
      .returning({ characters: localizationMonthlyUsage.characters });
    return row?.characters ?? characters;
  }

  async markWarned(month: string, at: Date): Promise<void> {
    await this.db
      .update(localizationMonthlyUsage)
      .set({ warnedAt: at })
      .where(eq(localizationMonthlyUsage.month, month));
  }

  async usageOf(userId: string): Promise<{ day: string; characters: number }[]> {
    return this.db
      .select({ day: localizationUsage.day, characters: localizationUsage.characters })
      .from(localizationUsage)
      .where(eq(localizationUsage.userId, userId))
      .orderBy(asc(localizationUsage.day));
  }

  async deleteUsageOf(userId: string): Promise<void> {
    await this.db.delete(localizationUsage).where(eq(localizationUsage.userId, userId));
  }

  async glossary(): Promise<GlossaryTermRecord[]> {
    return this.db
      .select()
      .from(localizationGlossaryTerms)
      .orderBy(asc(localizationGlossaryTerms.fr));
  }

  async findTerm(id: string): Promise<GlossaryTermRecord | null> {
    const [row] = await this.db
      .select()
      .from(localizationGlossaryTerms)
      .where(eq(localizationGlossaryTerms.id, id));
    return row ?? null;
  }

  async findTermByFr(fr: string): Promise<GlossaryTermRecord | null> {
    const [row] = await this.db
      .select()
      .from(localizationGlossaryTerms)
      .where(eq(localizationGlossaryTerms.fr, fr));
    return row ?? null;
  }

  async insertTerm(term: GlossaryTermRecord): Promise<boolean> {
    const rows = await this.db
      .insert(localizationGlossaryTerms)
      .values(term)
      .onConflictDoNothing({ target: localizationGlossaryTerms.fr })
      .returning({ id: localizationGlossaryTerms.id });
    return rows.length > 0;
  }

  async updateTerm(id: string, patch: Partial<GlossaryTermRecord>): Promise<void> {
    await this.db
      .update(localizationGlossaryTerms)
      .set(patch)
      .where(eq(localizationGlossaryTerms.id, id));
  }

  async deleteTerm(id: string): Promise<boolean> {
    const rows = await this.db
      .delete(localizationGlossaryTerms)
      .where(eq(localizationGlossaryTerms.id, id))
      .returning({ id: localizationGlossaryTerms.id });
    return rows.length > 0;
  }
}
