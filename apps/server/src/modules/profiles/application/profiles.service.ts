import { randomInt } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type {
  ContributorFacet,
  CreateContributorFacetRequest,
  CreateEntrepreneurFacetRequest,
  EntrepreneurFacet,
  Intention,
  UpdateBaseProfileRequest,
  UpdateContributorFacetRequest,
  UpdateEntrepreneurFacetRequest,
  UpdateProfileVisibilityRequest,
} from '@pitchorium/contracts';
import { TransactionManager } from '../../../platform/database';
import { Clock, DomainError } from '../../../platform/kernel';
import { IdentityFacade } from '../../identity';
import { MediaFacade } from '../../media';
import { assertContributorFacet, assertEligibleCompanyCountry } from '../domain/facet-rules';
import { assertHandleAllowed, handleBaseFromName, handleWithSuffix } from '../domain/handle';
import { DEFAULT_VISIBILITY, type Profile } from '../domain/profile';
import {
  ContributorFacetUpdated,
  EntrepreneurFacetUpdated,
  HandleChanged,
  IntentionSet,
  ProfileCreated,
  ProfileUpdated,
  VisibilityChanged,
} from '../domain/profile-events';
import { ProfileEventsRecorder } from './profile-events.recorder';
import { type ProfileImageSlot, ProfileRepository } from './ports';
import { ReferenceDataService } from './reference-data.service';

const SEQUENTIAL_SUFFIXES = 8;
const RANDOM_SUFFIXES = 5;

/** Base, base-2 ... base-9, then random suffixes: a handle is always found. */
function* handleCandidates(base: string): Generator<string> {
  yield base;
  for (let suffix = 2; suffix < 2 + SEQUENTIAL_SUFFIXES; suffix += 1) {
    yield handleWithSuffix(base, suffix);
  }
  for (let attempt = 0; attempt < RANDOM_SUFFIXES; attempt += 1) {
    yield handleWithSuffix(base, randomInt(1000, 1_000_000));
  }
}

/** Write side of profiles. Every write records its event in the same transaction. */
@Injectable()
export class ProfilesService {
  constructor(
    private readonly profiles: ProfileRepository,
    private readonly reference: ReferenceDataService,
    private readonly identity: IdentityFacade,
    private readonly media: MediaFacade,
    private readonly events: ProfileEventsRecorder,
    private readonly transactions: TransactionManager,
    private readonly clock: Clock,
  ) {}

  /**
   * Creates the base profile of an account if it does not exist yet: called by the handler of
   * identity.user.registered.v1 and before any profile access, so replays and races are safe.
   */
  async ensureProfile(userId: string): Promise<Profile> {
    const existing = await this.profiles.findByUserId(userId);
    if (existing) return existing;
    const user = await this.identity.findUser(userId);
    if (!user) throw new DomainError('IDENTITY_USER_NOT_FOUND', 'User not found');

    await this.transactions.run(async () => {
      for (const handle of handleCandidates(handleBaseFromName(user.name))) {
        if (await this.profiles.isHandleUnavailable(handle, userId)) continue;
        const now = this.clock.now();
        const inserted = await this.profiles.insertIfAbsent({
          userId,
          handle,
          displayName: user.name.trim(),
          headline: null,
          bio: null,
          countryCode: null,
          city: null,
          languages: [],
          links: { website: null, linkedin: null },
          avatarUrl: user.image,
          avatarMediaId: null,
          coverMediaId: null,
          intention: null,
          visibility: DEFAULT_VISIBILITY,
          createdAt: now,
          updatedAt: now,
        });
        if (inserted) {
          await this.events.record(ProfileCreated, userId, { handle });
          return;
        }
        // Not inserted: either the profile now exists (concurrent creation) or the handle was
        // taken in the meantime; only the second case tries another candidate.
        if (await this.profiles.findByUserId(userId)) return;
      }
      throw new Error(`No handle available for user ${userId}`);
    });
    return this.require(userId);
  }

  async updateBase(userId: string, patch: UpdateBaseProfileRequest): Promise<void> {
    await this.ensureProfile(userId);
    const fields = Object.keys(patch);
    if (fields.length === 0) return;
    if (patch.countryCode) await this.reference.country(patch.countryCode);
    await this.transactions.run(async () => {
      await this.profiles.updateBase(userId, patch, this.clock.now());
      await this.events.record(ProfileUpdated, userId, { fields: fields.sort() });
    });
  }

  async setIntention(userId: string, intention: Intention | null): Promise<void> {
    await this.ensureProfile(userId);
    await this.transactions.run(async () => {
      await this.profiles.setIntention(userId, intention, this.clock.now());
      await this.events.record(IntentionSet, userId, { intention });
    });
  }

  async changeHandle(userId: string, handle: string): Promise<void> {
    const profile = await this.ensureProfile(userId);
    assertHandleAllowed(handle);
    const previous = profile.base.handle;
    if (handle === previous) return;
    if (await this.profiles.isHandleUnavailable(handle, userId)) {
      throw new DomainError('PROFILES_HANDLE_TAKEN', 'Handle is already taken');
    }
    await this.transactions.run(async () => {
      await this.profiles.changeHandle(userId, previous, handle, this.clock.now());
      await this.events.record(HandleChanged, userId, { previous, current: handle });
    });
  }

  async updateVisibility(userId: string, patch: UpdateProfileVisibilityRequest): Promise<void> {
    const profile = await this.ensureProfile(userId);
    const visibility = { ...profile.base.visibility, ...patch };
    if (JSON.stringify(visibility) === JSON.stringify(profile.base.visibility)) return;
    await this.transactions.run(async () => {
      await this.profiles.setVisibility(userId, visibility, this.clock.now());
      await this.events.record(VisibilityChanged, userId, visibility);
    });
  }

  /**
   * Shows an uploaded file as photo or cover: the media is attached to the profile, the
   * previous one is detached (deleted later by the media orphan cleanup).
   */
  async setImage(userId: string, slot: ProfileImageSlot, mediaId: string): Promise<void> {
    const profile = await this.ensureProfile(userId);
    const current = slot === 'avatar' ? profile.base.avatarMediaId : profile.base.coverMediaId;
    if (current === mediaId) return;
    await this.transactions.run(async () => {
      if (current) await this.media.detach(current);
      await this.media.attach({
        mediaId,
        ownerId: userId,
        usage: slot === 'avatar' ? 'avatar' : 'profile_cover',
        resource: { type: 'profile', id: userId },
      });
      await this.profiles.setImage(userId, slot, mediaId, this.clock.now());
      await this.events.record(ProfileUpdated, userId, { fields: [slot] });
    });
  }

  async removeImage(userId: string, slot: ProfileImageSlot): Promise<void> {
    const profile = await this.ensureProfile(userId);
    const current = slot === 'avatar' ? profile.base.avatarMediaId : profile.base.coverMediaId;
    if (!current) return;
    await this.transactions.run(async () => {
      await this.media.detach(current);
      await this.profiles.setImage(userId, slot, null, this.clock.now());
      await this.events.record(ProfileUpdated, userId, { fields: [slot] });
    });
  }

  /** Imports the provider photo of a new profile through the media pipeline (worker). */
  async importProviderPhoto(userId: string): Promise<void> {
    const profile = await this.profiles.findByUserId(userId);
    if (!profile?.base.avatarUrl || profile.base.avatarMediaId) return;
    await this.media.requestImport({
      ownerId: userId,
      usage: 'avatar',
      url: profile.base.avatarUrl,
    });
  }

  /**
   * Shows an imported provider photo once processed, unless the member chose a photo in the
   * meantime. A failed import leaves the provider URL displayed.
   */
  async useImportedAvatar(userId: string, mediaId: string): Promise<void> {
    await this.transactions.run(async () => {
      const profile = await this.profiles.findByUserId(userId);
      if (!profile || profile.base.avatarMediaId) return;
      await this.media.attach({
        mediaId,
        ownerId: userId,
        usage: 'avatar',
        resource: { type: 'profile', id: userId },
      });
      await this.profiles.setImage(userId, 'avatar', mediaId, this.clock.now());
      await this.events.record(ProfileUpdated, userId, { fields: ['avatar'] });
    });
  }

  async createEntrepreneurFacet(
    userId: string,
    request: CreateEntrepreneurFacetRequest,
  ): Promise<void> {
    const profile = await this.ensureProfile(userId);
    if (profile.entrepreneur) {
      throw new DomainError('PROFILES_FACET_ALREADY_EXISTS', 'Entrepreneur facet exists');
    }
    await this.saveEntrepreneur(
      userId,
      {
        companyCity: null,
        teamSize: null,
        foundedYear: null,
        pitch: null,
        needs: [],
        soughtExpertise: [],
        fundingTarget: null,
        ...request,
      },
      'created',
    );
  }

  async updateEntrepreneurFacet(
    userId: string,
    patch: UpdateEntrepreneurFacetRequest,
  ): Promise<void> {
    const profile = await this.ensureProfile(userId);
    if (!profile.entrepreneur) {
      throw new DomainError('PROFILES_FACET_NOT_FOUND', 'No entrepreneur facet');
    }
    await this.saveEntrepreneur(userId, { ...profile.entrepreneur, ...patch }, 'updated');
  }

  async deleteEntrepreneurFacet(userId: string): Promise<void> {
    await this.transactions.run(async () => {
      if (!(await this.profiles.deleteEntrepreneurFacet(userId))) {
        throw new DomainError('PROFILES_FACET_NOT_FOUND', 'No entrepreneur facet');
      }
      await this.events.record(EntrepreneurFacetUpdated, userId, { change: 'deleted' });
    });
  }

  async createContributorFacet(
    userId: string,
    request: CreateContributorFacetRequest,
  ): Promise<void> {
    const profile = await this.ensureProfile(userId);
    if (profile.contributor) {
      throw new DomainError('PROFILES_FACET_ALREADY_EXISTS', 'Contributor facet exists');
    }
    await this.saveContributor(
      userId,
      {
        organizationName: null,
        interventionCountryCodes: [],
        sectorCodes: [],
        ticket: null,
        acceptedInstruments: [],
        patronageTypes: [],
        mentoringAvailable: false,
        openToExpertMissions: false,
        ...request,
      },
      'created',
    );
  }

  async updateContributorFacet(
    userId: string,
    patch: UpdateContributorFacetRequest,
  ): Promise<void> {
    const profile = await this.ensureProfile(userId);
    if (!profile.contributor) {
      throw new DomainError('PROFILES_FACET_NOT_FOUND', 'No contributor facet');
    }
    await this.saveContributor(userId, { ...profile.contributor, ...patch }, 'updated');
  }

  async deleteContributorFacet(userId: string): Promise<void> {
    await this.transactions.run(async () => {
      if (!(await this.profiles.deleteContributorFacet(userId))) {
        throw new DomainError('PROFILES_FACET_NOT_FOUND', 'No contributor facet');
      }
      await this.events.record(ContributorFacetUpdated, userId, { change: 'deleted' });
    });
  }

  private async saveEntrepreneur(
    userId: string,
    facet: EntrepreneurFacet,
    change: 'created' | 'updated',
  ): Promise<void> {
    assertEligibleCompanyCountry(await this.reference.country(facet.companyCountryCode));
    await this.reference.assertSectors([facet.sectorCode]);
    await this.reference.assertStage(facet.stageCode);
    await this.transactions.run(async () => {
      await this.profiles.saveEntrepreneurFacet(userId, facet, this.clock.now());
      await this.events.record(EntrepreneurFacetUpdated, userId, { change });
    });
  }

  private async saveContributor(
    userId: string,
    facet: ContributorFacet,
    change: 'created' | 'updated',
  ): Promise<void> {
    assertContributorFacet(facet);
    await this.reference.assertCountries(facet.interventionCountryCodes);
    await this.reference.assertSectors(facet.sectorCodes);
    await this.transactions.run(async () => {
      await this.profiles.saveContributorFacet(userId, facet, this.clock.now());
      await this.events.record(ContributorFacetUpdated, userId, { change });
    });
  }

  private async require(userId: string): Promise<Profile> {
    const profile = await this.profiles.findByUserId(userId);
    if (!profile) throw new DomainError('PROFILES_PROFILE_NOT_FOUND', 'Profile not found');
    return profile;
  }
}
