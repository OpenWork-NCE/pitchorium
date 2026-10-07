import { Injectable } from '@nestjs/common';
import type {
  ImpactAssessmentSource,
  ImpactLevel,
  ImpactMethodologyDraft,
  ImpactMethodologyStatus,
  ImpactSubjectType,
} from '@pitchorium/contracts';
import { and, desc, eq, inArray, sql } from '@pitchorium/db/orm';
import { impactAssessments, impactMethodologies } from '@pitchorium/db/schemas/impact';
import { TransactionManager } from '../../../platform/database';
import { ImpactRepository } from '../application/ports';
import type { AssessmentRecord } from '../domain/assessment';
import type { MethodologyRecord } from '../domain/methodology';

type MethodologyRow = typeof impactMethodologies.$inferSelect;
type AssessmentRow = typeof impactAssessments.$inferSelect;

const toMethodology = (row: MethodologyRow): MethodologyRecord => ({
  ...row,
  status: row.status as ImpactMethodologyStatus,
});

const toAssessment = (row: AssessmentRow): AssessmentRecord => ({
  ...row,
  subjectType: row.subjectType as ImpactSubjectType,
  level: row.level as ImpactLevel,
  source: row.source as ImpactAssessmentSource,
});

@Injectable()
export class DrizzleImpactRepository extends ImpactRepository {
  constructor(private readonly transactions: TransactionManager) {
    super();
  }

  private get db() {
    return this.transactions.executor;
  }

  async findMethodology(id: string): Promise<MethodologyRecord | null> {
    const [row] = await this.db
      .select()
      .from(impactMethodologies)
      .where(eq(impactMethodologies.id, id));
    return row ? toMethodology(row) : null;
  }

  async findMethodologies(ids: readonly string[]): Promise<MethodologyRecord[]> {
    if (ids.length === 0) return [];
    const rows = await this.db
      .select()
      .from(impactMethodologies)
      .where(inArray(impactMethodologies.id, [...ids]));
    return rows.map(toMethodology);
  }

  async publishedMethodology(): Promise<MethodologyRecord | null> {
    const [row] = await this.db
      .select()
      .from(impactMethodologies)
      .where(eq(impactMethodologies.status, 'published'));
    return row ? toMethodology(row) : null;
  }

  async listMethodologies(): Promise<MethodologyRecord[]> {
    const rows = await this.db
      .select()
      .from(impactMethodologies)
      .orderBy(desc(impactMethodologies.version));
    return rows.map(toMethodology);
  }

  async findDemoMethodology(): Promise<MethodologyRecord | null> {
    const [row] = await this.db
      .select()
      .from(impactMethodologies)
      .where(eq(impactMethodologies.demo, true))
      .orderBy(desc(impactMethodologies.version))
      .limit(1);
    return row ? toMethodology(row) : null;
  }

  async nextVersion(): Promise<number> {
    const [row] = await this.db
      .select({ max: sql<number>`coalesce(max(${impactMethodologies.version}), 0)::int` })
      .from(impactMethodologies);
    return (row?.max ?? 0) + 1;
  }

  async insertMethodology(methodology: MethodologyRecord): Promise<void> {
    await this.db.insert(impactMethodologies).values(methodology);
  }

  async updateDraft(id: string, draft: ImpactMethodologyDraft, now: Date): Promise<void> {
    await this.db
      .update(impactMethodologies)
      .set({ name: draft.name, criteria: draft.criteria, updatedAt: now })
      .where(and(eq(impactMethodologies.id, id), eq(impactMethodologies.status, 'draft')));
  }

  async setStatus(id: string, status: ImpactMethodologyStatus, now: Date): Promise<void> {
    await this.db
      .update(impactMethodologies)
      .set({
        status,
        updatedAt: now,
        ...(status === 'published' ? { publishedAt: now } : {}),
        ...(status === 'archived' ? { archivedAt: now } : {}),
      })
      .where(eq(impactMethodologies.id, id));
  }

  async deleteDraft(id: string): Promise<boolean> {
    const deleted = await this.db
      .delete(impactMethodologies)
      .where(and(eq(impactMethodologies.id, id), eq(impactMethodologies.status, 'draft')))
      .returning({ id: impactMethodologies.id });
    return deleted.length > 0;
  }

  async lockMethodologies(): Promise<void> {
    await this.db.execute(
      sql`select pg_advisory_xact_lock(hashtextextended('impact:methodologies', 0))`,
    );
  }

  async insertAssessment(assessment: AssessmentRecord): Promise<void> {
    await this.db.insert(impactAssessments).values(assessment);
  }

  async latestAssessment(
    subjectType: ImpactSubjectType,
    subjectId: string,
  ): Promise<AssessmentRecord | null> {
    const [row] = await this.db
      .select()
      .from(impactAssessments)
      .where(
        and(
          eq(impactAssessments.subjectType, subjectType),
          eq(impactAssessments.subjectId, subjectId),
        ),
      )
      .orderBy(desc(impactAssessments.submittedAt), desc(impactAssessments.id))
      .limit(1);
    return row ? toAssessment(row) : null;
  }

  async assessments(
    subjectType: ImpactSubjectType,
    subjectId: string,
  ): Promise<AssessmentRecord[]> {
    const rows = await this.db
      .select()
      .from(impactAssessments)
      .where(
        and(
          eq(impactAssessments.subjectType, subjectType),
          eq(impactAssessments.subjectId, subjectId),
        ),
      )
      .orderBy(desc(impactAssessments.submittedAt), desc(impactAssessments.id));
    return rows.map(toAssessment);
  }
}
