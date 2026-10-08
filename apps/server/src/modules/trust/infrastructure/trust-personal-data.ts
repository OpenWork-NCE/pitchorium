import { Injectable, type OnModuleInit } from '@nestjs/common';
import { eq, or, sql } from '@pitchorium/db/orm';
import {
  trustActivity,
  trustAppeals,
  trustDecisions,
  trustReports,
  trustSuspensions,
} from '@pitchorium/db/schemas/trust';
import { replaceIdentifier } from '../../../platform/compliance';
import { TransactionManager } from '../../../platform/database';
import { ERASURE_ORDER, PrivacyFacade } from '../../privacy';

/**
 * Personal data of trust: reports made, decisions concerning the member with their statement
 * of reasons, appeals and suspensions. Moderation decisions are kept as evidence, under the
 * pseudonym (ADR 0075); the address left by the member on a notice without an account is
 * erased; the activity counted by the signals is deleted.
 */
@Injectable()
export class TrustPersonalData implements OnModuleInit {
  constructor(
    private readonly privacy: PrivacyFacade,
    private readonly transactions: TransactionManager,
  ) {}

  private get db() {
    return this.transactions.executor;
  }

  onModuleInit(): void {
    this.privacy.registerPersonalData({
      module: 'trust',
      description:
        'The reports you made, the moderation decisions concerning you with their statement of reasons, your appeals and your suspensions.',
      order: ERASURE_ORDER.activity,
      exporter: {
        export: async (userId) => ({
          data: {
            reports: await this.db
              .select({
                id: trustReports.id,
                targetType: trustReports.targetType,
                reason: trustReports.reason,
                details: trustReports.details,
                outcome: trustReports.outcome,
                createdAt: trustReports.createdAt,
                resolvedAt: trustReports.resolvedAt,
              })
              .from(trustReports)
              .where(eq(trustReports.reporterId, userId)),
            decisions: await this.db
              .select({
                id: trustDecisions.id,
                kind: trustDecisions.kind,
                reason: trustDecisions.reason,
                statement: trustDecisions.statement,
                ground: trustDecisions.ground,
                decidedAt: trustDecisions.decidedAt,
                revertedAt: trustDecisions.revertedAt,
              })
              .from(trustDecisions)
              .where(eq(trustDecisions.subjectId, userId)),
            appeals: await this.db
              .select()
              .from(trustAppeals)
              .where(eq(trustAppeals.appellantId, userId)),
            suspensions: await this.db
              .select({
                startsAt: trustSuspensions.startsAt,
                endsAt: trustSuspensions.endsAt,
                liftedAt: trustSuspensions.liftedAt,
              })
              .from(trustSuspensions)
              .where(eq(trustSuspensions.userId, userId)),
          },
        }),
      },
      eraser: {
        erase: async ({ userId, email, pseudonym }) => {
          const db = this.db;
          await db.delete(trustActivity).where(eq(trustActivity.userId, userId));
          await db
            .update(trustReports)
            .set({ reporterEmail: null, reporterName: null })
            .where(
              or(
                eq(trustReports.reporterId, userId),
                sql`lower(${trustReports.reporterEmail}) = ${email.toLowerCase()}`,
              ),
            );
          await replaceIdentifier(
            db,
            [
              { table: 'trust.reports', column: 'reporter_id' },
              { table: 'trust.reports', column: 'target_id' },
              { table: 'trust.reports', column: 'message_context', kind: 'jsonb' },
              { table: 'trust.cases', column: 'target_id' },
              { table: 'trust.cases', column: 'subject_id' },
              { table: 'trust.cases', column: 'assigned_to' },
              { table: 'trust.assignments', column: 'moderator_id' },
              { table: 'trust.assignments', column: 'assigned_by' },
              { table: 'trust.decisions', column: 'target_id' },
              { table: 'trust.decisions', column: 'subject_id' },
              { table: 'trust.decisions', column: 'decided_by' },
              { table: 'trust.appeals', column: 'appellant_id' },
              { table: 'trust.appeals', column: 'reviewer_id' },
              { table: 'trust.suspensions', column: 'user_id' },
              { table: 'trust.suspensions', column: 'lifted_by' },
            ],
            userId,
            pseudonym,
          );
        },
      },
    });
  }
}
