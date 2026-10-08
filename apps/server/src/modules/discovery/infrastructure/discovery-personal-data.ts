import { Injectable, type OnModuleInit } from '@nestjs/common';
import { and, eq, or } from '@pitchorium/db/orm';
import {
  discoveryDismissals,
  discoveryMatchProfiles,
  discoverySearchDocuments,
  discoverySuggestions,
} from '@pitchorium/db/schemas/discovery';
import { replaceIdentifier } from '../../../platform/compliance';
import { TransactionManager } from '../../../platform/database';
import { ERASURE_ORDER, PrivacyFacade } from '../../privacy';

const MEMBER = 'member';
const PERSON = 'person';

/**
 * Personal data of discovery, a projection of the other modules: the search document and the
 * matching profile of the member, their suggestions and dismissals, and their place in the
 * suggestions of others. The erasure removes the member from the search index and from every
 * list; the documents they own (projects, events, missions) keep the pseudonym as owner.
 */
@Injectable()
export class DiscoveryPersonalData implements OnModuleInit {
  constructor(
    private readonly privacy: PrivacyFacade,
    private readonly transactions: TransactionManager,
  ) {}

  private get db() {
    return this.transactions.executor;
  }

  onModuleInit(): void {
    this.privacy.registerPersonalData({
      module: 'discovery',
      description:
        'What the matching knows of you (sectors, countries, hats, needs), the suggestions made to you with their reasons, and the suggestions you dismissed.',
      order: ERASURE_ORDER.activity,
      exporter: {
        export: async (userId) => ({
          data: {
            matchingProfile: await this.db
              .select()
              .from(discoveryMatchProfiles)
              .where(eq(discoveryMatchProfiles.userId, userId)),
            suggestions: await this.db
              .select()
              .from(discoverySuggestions)
              .where(
                and(
                  eq(discoverySuggestions.subjectType, MEMBER),
                  eq(discoverySuggestions.subjectId, userId),
                ),
              ),
            dismissals: await this.db
              .select()
              .from(discoveryDismissals)
              .where(eq(discoveryDismissals.userId, userId)),
          },
        }),
      },
      eraser: {
        erase: async ({ userId, pseudonym }) => {
          const db = this.db;
          await db
            .delete(discoverySearchDocuments)
            .where(
              and(
                eq(discoverySearchDocuments.kind, PERSON),
                eq(discoverySearchDocuments.entityId, userId),
              ),
            );
          await db.delete(discoveryMatchProfiles).where(eq(discoveryMatchProfiles.userId, userId));
          await db
            .delete(discoverySuggestions)
            .where(
              or(
                and(
                  eq(discoverySuggestions.subjectType, MEMBER),
                  eq(discoverySuggestions.subjectId, userId),
                ),
                and(
                  eq(discoverySuggestions.candidateKind, PERSON),
                  eq(discoverySuggestions.candidateId, userId),
                ),
              ),
            );
          await db
            .delete(discoveryDismissals)
            .where(
              or(
                eq(discoveryDismissals.userId, userId),
                and(
                  eq(discoveryDismissals.candidateKind, PERSON),
                  eq(discoveryDismissals.candidateId, userId),
                ),
              ),
            );
          await replaceIdentifier(
            db,
            [
              { table: 'discovery.search_documents', column: 'owner_id' },
              { table: 'discovery.suggestions', column: 'reasons', kind: 'jsonb' },
            ],
            userId,
            pseudonym,
          );
        },
      },
    });
  }
}
