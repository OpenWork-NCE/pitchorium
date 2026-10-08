import { Injectable, type OnModuleInit } from '@nestjs/common';
import { eq } from '@pitchorium/db/orm';
import {
  profilesContributorFacets,
  profilesEntrepreneurFacets,
  profilesHandleHistory,
  profilesProfiles,
} from '@pitchorium/db/schemas/profiles';
import { TransactionManager } from '../../../platform/database';
import { ERASURE_ORDER, PrivacyFacade } from '../../privacy';

/**
 * Personal data of profiles: the profile, its entrepreneur and contributor facets and its
 * former handles. The erasure deletes them (facets and history by cascade): the member then
 * shows as « Membre supprimé » wherever their identifier was kept.
 */
@Injectable()
export class ProfilesPersonalData implements OnModuleInit {
  constructor(
    private readonly privacy: PrivacyFacade,
    private readonly transactions: TransactionManager,
  ) {}

  private get db() {
    return this.transactions.executor;
  }

  onModuleInit(): void {
    this.privacy.registerPersonalData({
      module: 'profiles',
      description:
        'Your profile (handle, name, headline, presentation, location, languages, links, visibility), your entrepreneur and contributor facets, and your former handles.',
      order: ERASURE_ORDER.profile,
      exporter: {
        export: async (userId) => ({
          data: {
            profile:
              (
                await this.db
                  .select()
                  .from(profilesProfiles)
                  .where(eq(profilesProfiles.userId, userId))
              )[0] ?? null,
            entrepreneurFacet:
              (
                await this.db
                  .select()
                  .from(profilesEntrepreneurFacets)
                  .where(eq(profilesEntrepreneurFacets.userId, userId))
              )[0] ?? null,
            contributorFacet:
              (
                await this.db
                  .select()
                  .from(profilesContributorFacets)
                  .where(eq(profilesContributorFacets.userId, userId))
              )[0] ?? null,
            formerHandles: await this.db
              .select({
                handle: profilesHandleHistory.handle,
                replacedAt: profilesHandleHistory.replacedAt,
              })
              .from(profilesHandleHistory)
              .where(eq(profilesHandleHistory.userId, userId)),
          },
        }),
      },
      eraser: {
        erase: async ({ userId }) => {
          await this.db.delete(profilesProfiles).where(eq(profilesProfiles.userId, userId));
        },
      },
    });
  }
}
