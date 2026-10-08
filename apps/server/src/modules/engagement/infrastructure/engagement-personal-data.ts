import { Injectable, type OnModuleInit } from '@nestjs/common';
import { eq, or } from '@pitchorium/db/orm';
import {
  engagementContributionFacts,
  engagementTimeEntries,
} from '@pitchorium/db/schemas/engagement';
import { replaceIdentifier } from '../../../platform/compliance';
import { TransactionManager } from '../../../platform/database';
import { ERASURE_ORDER, PrivacyFacade } from '../../privacy';

/**
 * Personal data of engagement: the projection of the contributions and the shared time log.
 * The hours belong to the other party too (their impact dashboard): the entries stay under the
 * pseudonym, as the projection of the pseudonymized contributions.
 */
@Injectable()
export class EngagementPersonalData implements OnModuleInit {
  constructor(
    private readonly privacy: PrivacyFacade,
    private readonly transactions: TransactionManager,
  ) {}

  private get db() {
    return this.transactions.executor;
  }

  onModuleInit(): void {
    this.privacy.registerPersonalData({
      module: 'engagement',
      description:
        'The contributions counted in your impact dashboard and the hours of mentoring or expertise you declared or received.',
      order: ERASURE_ORDER.financial,
      exporter: {
        export: async (userId) => ({
          data: {
            contributions: await this.db
              .select()
              .from(engagementContributionFacts)
              .where(eq(engagementContributionFacts.contributorId, userId)),
            timeEntries: await this.db
              .select()
              .from(engagementTimeEntries)
              .where(
                or(
                  eq(engagementTimeEntries.contributorId, userId),
                  eq(engagementTimeEntries.entrepreneurId, userId),
                ),
              ),
          },
        }),
      },
      eraser: {
        erase: ({ userId, pseudonym }) =>
          replaceIdentifier(
            this.db,
            [
              { table: 'engagement.contribution_facts', column: 'contributor_id' },
              { table: 'engagement.time_entries', column: 'contributor_id' },
              { table: 'engagement.time_entries', column: 'entrepreneur_id' },
              { table: 'engagement.time_entries', column: 'responded_by' },
            ],
            userId,
            pseudonym,
          ),
      },
    });
  }
}
