import { Injectable, type OnModuleInit } from '@nestjs/common';
import { and, eq, or } from '@pitchorium/db/orm';
import { impactAssessments } from '@pitchorium/db/schemas/impact';
import { replaceIdentifier } from '../../../platform/compliance';
import { TransactionManager } from '../../../platform/database';
import { ERASURE_ORDER, PrivacyFacade } from '../../privacy';

const ENTREPRENEUR = 'entrepreneur_facet';

/**
 * Personal data of impact: the self-declared assessments of the entrepreneur facet and those
 * the member submitted for a project. The erasure deletes the assessments of the member; those
 * of a project stay with the project, under the pseudonym.
 */
@Injectable()
export class ImpactPersonalData implements OnModuleInit {
  constructor(
    private readonly privacy: PrivacyFacade,
    private readonly transactions: TransactionManager,
  ) {}

  private get db() {
    return this.transactions.executor;
  }

  onModuleInit(): void {
    this.privacy.registerPersonalData({
      module: 'impact',
      description:
        'The self-declared impact assessments of your entrepreneur facet and those you submitted for a project, with their answers and score.',
      order: ERASURE_ORDER.activity,
      exporter: {
        export: async (userId) => ({
          data: {
            assessments: await this.db
              .select()
              .from(impactAssessments)
              .where(
                or(
                  and(
                    eq(impactAssessments.subjectType, ENTREPRENEUR),
                    eq(impactAssessments.subjectId, userId),
                  ),
                  eq(impactAssessments.submittedBy, userId),
                ),
              ),
          },
        }),
      },
      eraser: {
        erase: async ({ userId, pseudonym }) => {
          await this.db
            .delete(impactAssessments)
            .where(
              and(
                eq(impactAssessments.subjectType, ENTREPRENEUR),
                eq(impactAssessments.subjectId, userId),
              ),
            );
          await replaceIdentifier(
            this.db,
            [
              { table: 'impact.assessments', column: 'submitted_by' },
              { table: 'impact.methodologies', column: 'created_by' },
            ],
            userId,
            pseudonym,
          );
        },
      },
    });
  }
}
