import { Injectable } from '@nestjs/common';
import type { ContributorFacet, EntrepreneurFacet, ProfileVisibility } from '@pitchorium/contracts';
import { TransactionManager } from '../../../platform/database';
import { isEligibleCompanyCountry } from '../domain/facet-rules';
import { ProfileUpdated } from '../domain/profile-events';
import { OrganizationDirectoryRegistry } from './organization-directory.registry';
import {
  type OrganizationDirectory,
  type ProfileAccessFilter,
  ProfileRepository,
  type ProfileViewListener,
} from './ports';
import { ProfileAccessRegistry } from './profile-access.registry';
import { ProfileViewRegistry } from './profile-view.registry';
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

/**
 * A member with both facets and the visibility of their details, for the discovery projection
 * (which applies the visibility per audience) and the missions module (hats, entrepreneur
 * facet). Never shown as such to another member.
 */
export interface ProfileSource {
  userId: string;
  handle: string;
  displayName: string;
  headline: string | null;
  bio: string | null;
  countryCode: string | null;
  city: string | null;
  languages: string[];
  visibility: ProfileVisibility;
  entrepreneur: EntrepreneurFacet | null;
  contributor: ContributorFacet | null;
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
    private readonly views: ProfileViewRegistry,
    private readonly access: ProfileAccessRegistry,
  ) {}

  /**
   * User id behind a current or former handle, null when unknown. With a viewer, a member
   * hidden from them (block in either direction) is unknown too.
   */
  async userIdOf(handle: string, viewerId: string | null = null): Promise<string | null> {
    const userId = (await this.profiles.resolveHandle(handle))?.userId ?? null;
    if (!userId || (await this.access.isHidden(viewerId, userId))) return null;
    return userId;
  }

  /** User ids of the given current handles (mentions), by handle, without hidden members. */
  async userIdsByHandles(
    handles: readonly string[],
    viewerId: string | null = null,
  ): Promise<Map<string, string>> {
    const found = await this.profiles.userIdsByHandles(handles);
    const hidden = await this.access.hiddenFrom(viewerId, [...found.values()]);
    return new Map([...found].filter(([, userId]) => !hidden.has(userId)));
  }

  /** Profiles with their facets (discovery projection, missions), in no particular order. */
  async sources(userIds: readonly string[]): Promise<ProfileSource[]> {
    return (await this.profiles.findProfiles([...new Set(userIds)])).map((profile) => ({
      userId: profile.base.userId,
      handle: profile.base.handle,
      displayName: profile.base.displayName,
      headline: profile.base.headline,
      bio: profile.base.bio,
      countryCode: profile.base.countryCode,
      city: profile.base.city,
      languages: profile.base.languages,
      visibility: profile.base.visibility,
      entrepreneur: profile.entrepreneur,
      contributor: profile.contributor,
    }));
  }

  /** Members with a profile, by ascending id, for a full rebuild of the search index. */
  userIdsAfter(after: string | null, limit: number): Promise<string[]> {
    return this.profiles.userIdsAfter(after, limit);
  }

  /** Country of residence declared on the profile (ISO 3166-1), null when not given. */
  async countryOf(userId: string): Promise<string | null> {
    const [base] = await this.profiles.findBaseProfiles([userId]);
    return base?.countryCode ?? null;
  }

  /** Privacy settings of a member, null without profile. */
  async visibilityOf(userId: string): Promise<ProfileVisibility | null> {
    const [base] = await this.profiles.findBaseProfiles([userId]);
    return base?.visibility ?? null;
  }

  /**
   * Sectors a member shows to other members (facets whose details are not private), for
   * anonymized mentions such as « un membre du secteur X ».
   */
  visibleSectors(userIds: readonly string[]): Promise<Map<string, string[]>> {
    return this.profiles.visibleSectors(userIds);
  }

  /** Called at startup by the network module, which records profile views. */
  registerProfileViewListener(listener: ProfileViewListener): void {
    this.views.register(listener);
  }

  /** Called at startup by the network module, which hides blocked members (ADR 0029). */
  registerProfileAccessFilter(filter: ProfileAccessFilter): void {
    this.access.register(filter);
  }

  /** Throws PROFILES_UNKNOWN_REFERENCE for a country missing from the reference data. */
  assertCountries(codes: readonly string[]): Promise<void> {
    return this.reference.assertCountries(codes);
  }

  assertSectors(codes: readonly string[]): Promise<void> {
    return this.reference.assertSectors(codes);
  }

  /**
   * Known countries outside Africa (UN M49 002) and the Caribbean (029), for the projects
   * module; PROFILES_UNKNOWN_REFERENCE for a country missing from the reference data.
   */
  async countriesOutsideProjectRegions(codes: readonly string[]): Promise<string[]> {
    const outside: string[] = [];
    for (const code of codes) {
      if (!isEligibleCompanyCountry(await this.reference.country(code))) outside.push(code);
    }
    return outside;
  }

  /**
   * Cards of the given members that have a profile, by user id. With a viewer, members hidden
   * from them are left out, as if they had no profile.
   */
  async memberCards(
    userIds: readonly string[],
    viewerId: string | null = null,
  ): Promise<Map<string, MemberCard>> {
    const cards = new Map<string, MemberCard>();
    const hidden = await this.access.hiddenFrom(viewerId, userIds);
    const shown = hidden.size === 0 ? userIds : userIds.filter((id) => !hidden.has(id));
    for (const base of await this.profiles.findBaseProfiles(shown)) {
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
