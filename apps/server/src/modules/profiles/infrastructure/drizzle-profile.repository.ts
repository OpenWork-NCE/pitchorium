import { Injectable } from '@nestjs/common';
import {
  type ContributorFacet,
  contributorHatSchema,
  type EntrepreneurFacet,
  entrepreneurNeedSchema,
  fundingInstrumentSchema,
  type Intention,
  intentionSchema,
  patronageTypeSchema,
  type ProfileVisibility,
  structureTypeSchema,
  visibilityLevelSchema,
} from '@pitchorium/contracts';
import { and, asc, desc, eq, gt, inArray, isNotNull, ne } from '@pitchorium/db/orm';
import {
  profilesContributorFacets,
  profilesEntrepreneurFacets,
  profilesHandleHistory,
  profilesProfiles,
} from '@pitchorium/db/schemas/profiles';
import { TransactionManager } from '../../../platform/database';
import type { BaseProfile, Profile } from '../domain/profile';
import {
  type BaseProfilePatch,
  type ProfileImageSlot,
  ProfileRepository,
} from '../application/ports';

type ProfileRow = typeof profilesProfiles.$inferSelect;
type EntrepreneurRow = typeof profilesEntrepreneurFacets.$inferSelect;
type ContributorRow = typeof profilesContributorFacets.$inferSelect;

function toBase(row: ProfileRow): BaseProfile {
  return {
    userId: row.userId,
    handle: row.handle,
    displayName: row.displayName,
    headline: row.headline,
    bio: row.bio,
    countryCode: row.countryCode,
    city: row.city,
    languages: row.languages,
    links: { website: row.websiteUrl, linkedin: row.linkedinUrl },
    avatarUrl: row.avatarUrl,
    avatarMediaId: row.avatarMediaId,
    coverMediaId: row.coverMediaId,
    intention: row.intention === null ? null : intentionSchema.parse(row.intention),
    visibility: {
      publicPageEnabled: row.publicPageEnabled,
      entrepreneurDetails: visibilityLevelSchema.parse(row.entrepreneurDetailsVisibility),
      contributorDetails: visibilityLevelSchema.parse(row.contributorDetailsVisibility),
      networkLists: visibilityLevelSchema.parse(row.networkListsVisibility),
    },
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toEntrepreneur(row: EntrepreneurRow): EntrepreneurFacet {
  return {
    companyName: row.companyName,
    sectorCode: row.sectorCode,
    stageCode: row.stageCode,
    companyCountryCode: row.companyCountryCode,
    companyCity: row.companyCity,
    teamSize: row.teamSize,
    foundedYear: row.foundedYear,
    pitch: row.pitch,
    needs: row.needs.map((need) => entrepreneurNeedSchema.parse(need)),
    soughtExpertise: row.soughtExpertise,
    fundingTarget:
      row.fundingTargetMinor !== null && row.fundingTargetCurrency !== null
        ? { amountMinor: row.fundingTargetMinor.toString(), currency: row.fundingTargetCurrency }
        : null,
  };
}

function toContributor(row: ContributorRow): ContributorFacet {
  return {
    hats: row.hats.map((hat) => contributorHatSchema.parse(hat)),
    structureType: structureTypeSchema.parse(row.structureType),
    organizationName: row.organizationName,
    organizationId: row.organizationId,
    interventionCountryCodes: row.interventionCountryCodes,
    sectorCodes: row.sectorCodes,
    ticket:
      row.ticketMinMinor !== null && row.ticketMaxMinor !== null && row.ticketCurrency !== null
        ? {
            minAmountMinor: row.ticketMinMinor.toString(),
            maxAmountMinor: row.ticketMaxMinor.toString(),
            currency: row.ticketCurrency,
          }
        : null,
    acceptedInstruments: row.acceptedInstruments.map((value) =>
      fundingInstrumentSchema.parse(value),
    ),
    patronageTypes: row.patronageTypes.map((value) => patronageTypeSchema.parse(value)),
    mentoringAvailable: row.mentoringAvailable,
    openToExpertMissions: row.openToExpertMissions,
  };
}

@Injectable()
export class DrizzleProfileRepository extends ProfileRepository {
  constructor(private readonly transactions: TransactionManager) {
    super();
  }

  private get db() {
    return this.transactions.executor;
  }

  async findByUserId(userId: string): Promise<Profile | null> {
    const [[base], [entrepreneur], [contributor]] = await Promise.all([
      this.db.select().from(profilesProfiles).where(eq(profilesProfiles.userId, userId)),
      this.db
        .select()
        .from(profilesEntrepreneurFacets)
        .where(eq(profilesEntrepreneurFacets.userId, userId)),
      this.db
        .select()
        .from(profilesContributorFacets)
        .where(eq(profilesContributorFacets.userId, userId)),
    ]);
    if (!base) return null;
    return {
      base: toBase(base),
      entrepreneur: entrepreneur ? toEntrepreneur(entrepreneur) : null,
      contributor: contributor ? toContributor(contributor) : null,
    };
  }

  async findProfiles(userIds: readonly string[]): Promise<Profile[]> {
    if (userIds.length === 0) return [];
    const ids = [...userIds];
    const [bases, entrepreneurs, contributors] = await Promise.all([
      this.db.select().from(profilesProfiles).where(inArray(profilesProfiles.userId, ids)),
      this.db
        .select()
        .from(profilesEntrepreneurFacets)
        .where(inArray(profilesEntrepreneurFacets.userId, ids)),
      this.db
        .select()
        .from(profilesContributorFacets)
        .where(inArray(profilesContributorFacets.userId, ids)),
    ]);
    const entrepreneurOf = new Map(entrepreneurs.map((row) => [row.userId, row]));
    const contributorOf = new Map(contributors.map((row) => [row.userId, row]));
    return bases.map((base) => {
      const entrepreneur = entrepreneurOf.get(base.userId);
      const contributor = contributorOf.get(base.userId);
      return {
        base: toBase(base),
        entrepreneur: entrepreneur ? toEntrepreneur(entrepreneur) : null,
        contributor: contributor ? toContributor(contributor) : null,
      };
    });
  }

  async publicPagesAfter(
    afterHandle: string | null,
    limit: number,
  ): Promise<{ handle: string; updatedAt: Date }[]> {
    return this.db
      .select({ handle: profilesProfiles.handle, updatedAt: profilesProfiles.updatedAt })
      .from(profilesProfiles)
      .where(
        and(
          eq(profilesProfiles.publicPageEnabled, true),
          afterHandle ? gt(profilesProfiles.handle, afterHandle) : undefined,
        ),
      )
      .orderBy(asc(profilesProfiles.handle))
      .limit(limit);
  }

  async userIdsAfter(after: string | null, limit: number): Promise<string[]> {
    const rows = await this.db
      .select({ userId: profilesProfiles.userId })
      .from(profilesProfiles)
      .where(after ? gt(profilesProfiles.userId, after) : undefined)
      .orderBy(asc(profilesProfiles.userId))
      .limit(limit);
    return rows.map((row) => row.userId);
  }

  async findBaseProfiles(userIds: readonly string[]): Promise<BaseProfile[]> {
    if (userIds.length === 0) return [];
    const rows = await this.db
      .select()
      .from(profilesProfiles)
      .where(inArray(profilesProfiles.userId, [...userIds]));
    return rows.map(toBase);
  }

  async clearContributorOrganization(userId: string, organizationId: string): Promise<boolean> {
    const cleared = await this.db
      .update(profilesContributorFacets)
      .set({ organizationId: null })
      .where(
        and(
          eq(profilesContributorFacets.userId, userId),
          eq(profilesContributorFacets.organizationId, organizationId),
        ),
      )
      .returning({ userId: profilesContributorFacets.userId });
    return cleared.length > 0;
  }

  async userIdsByHandles(handles: readonly string[]): Promise<Map<string, string>> {
    if (handles.length === 0) return new Map();
    const rows = await this.db
      .select({ handle: profilesProfiles.handle, userId: profilesProfiles.userId })
      .from(profilesProfiles)
      .where(inArray(profilesProfiles.handle, [...handles]));
    return new Map(rows.map((row) => [row.handle, row.userId]));
  }

  async visibleSectors(userIds: readonly string[]): Promise<Map<string, string[]>> {
    const sectors = new Map<string, string[]>();
    if (userIds.length === 0) return sectors;
    const ids = [...userIds];
    const add = (userId: string, codes: readonly string[]) =>
      sectors.set(userId, [...new Set([...(sectors.get(userId) ?? []), ...codes])]);
    const entrepreneurs = await this.db
      .select({
        userId: profilesEntrepreneurFacets.userId,
        sector: profilesEntrepreneurFacets.sectorCode,
      })
      .from(profilesEntrepreneurFacets)
      .innerJoin(profilesProfiles, eq(profilesProfiles.userId, profilesEntrepreneurFacets.userId))
      .where(
        and(
          inArray(profilesEntrepreneurFacets.userId, ids),
          ne(profilesProfiles.entrepreneurDetailsVisibility, 'private'),
        ),
      );
    for (const row of entrepreneurs) add(row.userId, [row.sector]);
    const contributors = await this.db
      .select({
        userId: profilesContributorFacets.userId,
        sectors: profilesContributorFacets.sectorCodes,
      })
      .from(profilesContributorFacets)
      .innerJoin(profilesProfiles, eq(profilesProfiles.userId, profilesContributorFacets.userId))
      .where(
        and(
          inArray(profilesContributorFacets.userId, ids),
          ne(profilesProfiles.contributorDetailsVisibility, 'private'),
        ),
      );
    for (const row of contributors) add(row.userId, row.sectors);
    return sectors;
  }

  async resolveHandle(handle: string): Promise<{ userId: string; current: boolean } | null> {
    const [current] = await this.db
      .select({ userId: profilesProfiles.userId })
      .from(profilesProfiles)
      .where(eq(profilesProfiles.handle, handle));
    if (current) return { userId: current.userId, current: true };
    const [former] = await this.db
      .select({ userId: profilesHandleHistory.userId })
      .from(profilesHandleHistory)
      .where(eq(profilesHandleHistory.handle, handle));
    return former ? { userId: former.userId, current: false } : null;
  }

  async isHandleUnavailable(handle: string, forUserId: string): Promise<boolean> {
    const [current] = await this.db
      .select({ userId: profilesProfiles.userId })
      .from(profilesProfiles)
      .where(and(eq(profilesProfiles.handle, handle), ne(profilesProfiles.userId, forUserId)));
    if (current) return true;
    const [former] = await this.db
      .select({ userId: profilesHandleHistory.userId })
      .from(profilesHandleHistory)
      .where(
        and(eq(profilesHandleHistory.handle, handle), ne(profilesHandleHistory.userId, forUserId)),
      );
    return former !== undefined;
  }

  async insertIfAbsent(profile: BaseProfile): Promise<boolean> {
    // No conflict target: a taken handle is reported as "not inserted" instead of an error,
    // which would abort the surrounding transaction.
    const inserted = await this.db
      .insert(profilesProfiles)
      .values({
        userId: profile.userId,
        handle: profile.handle,
        displayName: profile.displayName,
        headline: profile.headline,
        bio: profile.bio,
        countryCode: profile.countryCode,
        city: profile.city,
        languages: profile.languages,
        websiteUrl: profile.links.website,
        linkedinUrl: profile.links.linkedin,
        avatarUrl: profile.avatarUrl,
        avatarMediaId: profile.avatarMediaId,
        coverMediaId: profile.coverMediaId,
        intention: profile.intention,
        publicPageEnabled: profile.visibility.publicPageEnabled,
        entrepreneurDetailsVisibility: profile.visibility.entrepreneurDetails,
        contributorDetailsVisibility: profile.visibility.contributorDetails,
        networkListsVisibility: profile.visibility.networkLists,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
      })
      .onConflictDoNothing()
      .returning({ userId: profilesProfiles.userId });
    return inserted.length > 0;
  }

  async updateBase(userId: string, patch: BaseProfilePatch, now: Date): Promise<void> {
    const { links, ...fields } = patch;
    await this.db
      .update(profilesProfiles)
      .set({
        ...fields,
        ...(links ? { websiteUrl: links.website, linkedinUrl: links.linkedin } : {}),
        updatedAt: now,
      })
      .where(eq(profilesProfiles.userId, userId));
  }

  async setFeatured(userId: string, featuredBy: string | null, at: Date | null): Promise<void> {
    await this.db
      .update(profilesProfiles)
      .set({ featuredAt: at, featuredBy })
      .where(eq(profilesProfiles.userId, userId));
  }

  async featuredProfiles(limit: number): Promise<{ handle: string; featuredAt: Date | null }[]> {
    return this.db
      .select({ handle: profilesProfiles.handle, featuredAt: profilesProfiles.featuredAt })
      .from(profilesProfiles)
      .where(
        and(isNotNull(profilesProfiles.featuredAt), eq(profilesProfiles.publicPageEnabled, true)),
      )
      .orderBy(desc(profilesProfiles.featuredAt))
      .limit(limit);
  }

  async setIntention(userId: string, intention: Intention | null, now: Date): Promise<void> {
    await this.db
      .update(profilesProfiles)
      .set({ intention, intentionSetAt: intention ? now : null, updatedAt: now })
      .where(eq(profilesProfiles.userId, userId));
  }

  async setVisibility(userId: string, visibility: ProfileVisibility, now: Date): Promise<void> {
    await this.db
      .update(profilesProfiles)
      .set({
        publicPageEnabled: visibility.publicPageEnabled,
        entrepreneurDetailsVisibility: visibility.entrepreneurDetails,
        contributorDetailsVisibility: visibility.contributorDetails,
        networkListsVisibility: visibility.networkLists,
        updatedAt: now,
      })
      .where(eq(profilesProfiles.userId, userId));
  }

  async setImage(
    userId: string,
    slot: ProfileImageSlot,
    mediaId: string | null,
    now: Date,
  ): Promise<void> {
    await this.db
      .update(profilesProfiles)
      .set(
        slot === 'avatar'
          ? { avatarMediaId: mediaId, updatedAt: now }
          : { coverMediaId: mediaId, updatedAt: now },
      )
      .where(eq(profilesProfiles.userId, userId));
  }

  async changeHandle(userId: string, previous: string, next: string, now: Date): Promise<void> {
    // Taking back one's own former handle removes it from the history.
    await this.db
      .delete(profilesHandleHistory)
      .where(and(eq(profilesHandleHistory.handle, next), eq(profilesHandleHistory.userId, userId)));
    await this.db
      .insert(profilesHandleHistory)
      .values({ handle: previous, userId, replacedAt: now })
      .onConflictDoNothing();
    await this.db
      .update(profilesProfiles)
      .set({ handle: next, updatedAt: now })
      .where(eq(profilesProfiles.userId, userId));
  }

  async saveEntrepreneurFacet(userId: string, facet: EntrepreneurFacet, now: Date): Promise<void> {
    const values = {
      companyName: facet.companyName,
      sectorCode: facet.sectorCode,
      stageCode: facet.stageCode,
      companyCountryCode: facet.companyCountryCode,
      companyCity: facet.companyCity,
      teamSize: facet.teamSize,
      foundedYear: facet.foundedYear,
      pitch: facet.pitch,
      needs: facet.needs,
      soughtExpertise: facet.soughtExpertise,
      fundingTargetMinor: facet.fundingTarget ? BigInt(facet.fundingTarget.amountMinor) : null,
      fundingTargetCurrency: facet.fundingTarget?.currency ?? null,
      updatedAt: now,
    };
    await this.db
      .insert(profilesEntrepreneurFacets)
      .values({ userId, ...values, createdAt: now })
      .onConflictDoUpdate({ target: profilesEntrepreneurFacets.userId, set: values });
  }

  async deleteEntrepreneurFacet(userId: string): Promise<boolean> {
    const deleted = await this.db
      .delete(profilesEntrepreneurFacets)
      .where(eq(profilesEntrepreneurFacets.userId, userId))
      .returning({ userId: profilesEntrepreneurFacets.userId });
    return deleted.length > 0;
  }

  async saveContributorFacet(userId: string, facet: ContributorFacet, now: Date): Promise<void> {
    const values = {
      hats: facet.hats,
      structureType: facet.structureType,
      organizationName: facet.organizationName,
      organizationId: facet.organizationId,
      interventionCountryCodes: facet.interventionCountryCodes,
      sectorCodes: facet.sectorCodes,
      ticketMinMinor: facet.ticket ? BigInt(facet.ticket.minAmountMinor) : null,
      ticketMaxMinor: facet.ticket ? BigInt(facet.ticket.maxAmountMinor) : null,
      ticketCurrency: facet.ticket?.currency ?? null,
      acceptedInstruments: facet.acceptedInstruments,
      patronageTypes: facet.patronageTypes,
      mentoringAvailable: facet.mentoringAvailable,
      openToExpertMissions: facet.openToExpertMissions,
      updatedAt: now,
    };
    await this.db
      .insert(profilesContributorFacets)
      .values({ userId, ...values, createdAt: now })
      .onConflictDoUpdate({ target: profilesContributorFacets.userId, set: values });
  }

  async deleteContributorFacet(userId: string): Promise<boolean> {
    const deleted = await this.db
      .delete(profilesContributorFacets)
      .where(eq(profilesContributorFacets.userId, userId))
      .returning({ userId: profilesContributorFacets.userId });
    return deleted.length > 0;
  }
}
