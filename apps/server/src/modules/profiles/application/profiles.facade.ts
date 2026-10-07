import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../../platform/database';
import { ProfileUpdated } from '../domain/profile-events';
import { OrganizationDirectoryRegistry } from './organization-directory.registry';
import { type OrganizationDirectory, ProfileRepository } from './ports';
import { ProfileDisplayService } from './profile-display.service';
import { ProfileEventsRecorder } from './profile-events.recorder';
import { ReferenceDataService } from './reference-data.service';

/** How a member appears on another module's page (organization members, for example). */
export interface MemberCard {
  userId: string;
  handle: string;
  displayName: string;
  headline: string | null;
  avatarUrl: string | null;
  /** Whether the member enabled their public profile page. */
  publicPageEnabled: boolean;
}

/** Public facade of the profiles module, for the other modules. */
@Injectable()
export class ProfilesFacade {
  constructor(
    private readonly profiles: ProfileRepository,
    private readonly reference: ReferenceDataService,
    private readonly display: ProfileDisplayService,
    private readonly directory: OrganizationDirectoryRegistry,
    private readonly events: ProfileEventsRecorder,
    private readonly transactions: TransactionManager,
  ) {}

  /** Throws PROFILES_UNKNOWN_REFERENCE for a country missing from the reference data. */
  assertCountries(codes: readonly string[]): Promise<void> {
    return this.reference.assertCountries(codes);
  }

  assertSectors(codes: readonly string[]): Promise<void> {
    return this.reference.assertSectors(codes);
  }

  /** Cards of the given members that have a profile, by user id. */
  async memberCards(userIds: readonly string[]): Promise<Map<string, MemberCard>> {
    const cards = new Map<string, MemberCard>();
    for (const base of await this.profiles.findBaseProfiles(userIds)) {
      const { avatarUrl } = await this.display.resolve({
        base,
        entrepreneur: null,
        contributor: null,
      });
      cards.set(base.userId, {
        userId: base.userId,
        handle: base.handle,
        displayName: base.displayName,
        headline: base.headline,
        avatarUrl,
        publicPageEnabled: base.visibility.publicPageEnabled,
      });
    }
    return cards;
  }

  /** A member who left an organization no longer shows it on their contributor facet. */
  unlinkOrganization(userId: string, organizationId: string): Promise<void> {
    return this.transactions.run(async () => {
      if (await this.profiles.clearContributorOrganization(userId, organizationId)) {
        await this.events.record(ProfileUpdated, userId, {
          fields: ['contributor.organizationId'],
        });
      }
    });
  }

  registerOrganizationDirectory(directory: OrganizationDirectory): void {
    this.directory.register(directory);
  }
}
